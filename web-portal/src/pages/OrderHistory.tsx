import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Order as OrderType, Account as AccountType, CompanyData } from '../types';
import { getOrders, getAccount, deleteOrder, clearCart, addItemToCart } from '../api';
import { ChevronDownIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const OrderHistory: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string, logoUrl?: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchHistory = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const fetchedOrders = await getOrders();
      const sortedOrders = fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sortedOrders);
      localStorage.setItem('orderHistory', JSON.stringify(sortedOrders));
      
      const cachedAccount = localStorage.getItem('account');
      if (cachedAccount) {
        setAccount(JSON.parse(cachedAccount));
      } else {
        const fetchedAccount = await getAccount(userId);
        setAccount(fetchedAccount);
        localStorage.setItem('account', JSON.stringify(fetchedAccount));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load order history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    const decodedUser = decodeJWT(token);
    if (!decodedUser) {
      toast.error('Could not decode user information.');
      navigate('/login');
      return;
    }
    setUserRole(decodedUser.role);

    const cachedOrders = localStorage.getItem('orderHistory');
    const cachedAccount = localStorage.getItem('account');

    if (cachedOrders && cachedAccount) {
      const parsedOrders = JSON.parse(cachedOrders);
      const sortedOrders = parsedOrders.sort((a: OrderType, b: OrderType) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sortedOrders);
      setAccount(JSON.parse(cachedAccount));
      setLoading(false);
    } else {
      fetchHistory(decodedUser.id);
    }
  }, [isAuthenticated, navigate, decodeJWT, fetchHistory]);

  useEffect(() => {
    if (account && account.customer?.attachedCompanies && account.customer.attachedCompanies.length > 0) {
      const companies = account.customer.attachedCompanies.map((company: CompanyData) => ({
        id: company.companyCodeId || company._id || company.companyCode,
        name: company.name,
        companyCode: company.companyCode,
        logoUrl: company.logoUrl,
      }));
      
      setAvailableCompanies(companies);
      
      if (companies.length > 0) {
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [account]);

  const filteredOrders = useMemo(() => {
    if (!selectedCompanyId) return orders;
    if (!orders) return [];
    return orders.filter(order => {
      const company = account?.customer?.attachedCompanies?.find(c => c.companyCodeId === selectedCompanyId || c._id === selectedCompanyId || c.companyCode === selectedCompanyId);
      return company && (order.sellerId === company.companyCode || order.sellerId === company._id || order.sellerId === company.companyCodeId);
    });
  }, [orders, selectedCompanyId, account]);


  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Delete this order? This action cannot be undone.')) return;
    try {
      await deleteOrder(orderId);
      toast.success('Order deleted');
      setOrders(prev => prev.filter(o => o.id !== orderId));
      localStorage.removeItem('orderHistory');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleReorder = async (order: OrderType) => {
    const toastId = toast.loading('Preparing reorder...');
    try {
      await clearCart(order.sellerId);
      for (const item of order.items) {
        await addItemToCart({
          entity: {
            productId: item.productId,
            quantity: item.quantity,
            sellerId: order.sellerId,
            partnerId: item.partnerId,
            name: item.name,
            price: item.price,
            discountedPrice: item.discountedPrice,
            image: item.image,
          }
        });
      }
      toast.success('Items added to cart!', { id: toastId });
      navigate('/cart');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reorder', { id: toastId });
    }
  };

  const handleRefresh = () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decodedUser = decodeJWT(token);
      if (decodedUser) {
        fetchHistory(decodedUser.id);
      }
    }
  };

  const getCompanyName = (sellerId: string) => {
    if (!account || !account.customer || !account.customer.attachedCompanies) {
      return sellerId;
    }
    const company = account.customer.attachedCompanies.find((c: CompanyData) => c.companyCode === sellerId || c._id === sellerId || c.companyCodeId === sellerId);
    return company ? company.name : sellerId;
  };

  const selectedCompany = availableCompanies.find(c => c.id === selectedCompanyId);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Order History</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              className="bg-teal-700 text-white px-4 py-2 rounded-md hover:bg-teal-800 transition"
            >
              Refresh
            </button>
            {availableCompanies.length > 0 && (
              <div className="relative inline-block text-left w-full md:w-auto">
                <button
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="inline-flex items-center justify-between w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <div className="flex items-center">
                    {selectedCompany?.logoUrl && (
                      <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-8 max-w-40 mr-3 rounded-full" />
                    )}
                    <span className="font-bold">{selectedCompany?.name || 'Select Company'}</span>
                  </div>
                  <ChevronDownIcon className="ml-2 -mr-1 h-5 w-5" />
                </button>
                {isCompanyDropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      {availableCompanies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => {
                            setSelectedCompanyId(company.id);
                            setIsCompanyDropdownOpen(false);
                          }}
                          className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                          role="menuitem"
                        >
                          {company.logoUrl && (
                            <img src={company.logoUrl} alt={company.name} className="h-8 max-w-40 mr-3 rounded-full" />
                          )}
                          {company.name} ({company.companyCode})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="shadow-lg rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const refunded = (order.refunds || []).reduce((s, r) => s + r.amount, 0);
                const netTotal = Math.max(0, order.grandTotal - refunded);
                const isPartiallyRefunded = refunded > 0 && order.status !== 'refunded';
                return (
                <div key={order.id} className="bg-white shadow rounded-lg p-6 mb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <div>
                      <p className="text-lg font-semibold text-gray-800">Order ID: {order.id}</p>
                      <p className="text-sm text-gray-500">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-500">Company: {getCompanyName(order.sellerId)}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-left sm:text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <span>Status:</span>
                        <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : order.status === 'refunded' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                        {isPartiallyRefunded && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Partially refunded
                          </span>
                        )}
                        {userRole === 'admin' && (
                          <button onClick={() => handleDeleteOrder(order.id)} className="text-red-500 hover:text-red-700 ml-2" title="Delete order">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {refunded > 0 ? (
                        <>
                          <p className="text-sm text-gray-500 mt-1 line-through">${order.grandTotal.toFixed(2)}</p>
                          <p className="text-xl font-bold text-gray-800">${netTotal.toFixed(2)}</p>
                          <p className="text-xs text-purple-700">${refunded.toFixed(2)} refunded</p>
                        </>
                      ) : (
                        <p className="text-xl font-bold text-gray-800 mt-1">${order.grandTotal.toFixed(2)}</p>
                      )}
                      {order.trackingNumber && (
                        <p className="text-xs text-gray-600 mt-1">
                          {[order.trackingCarrier?.toUpperCase(), order.trackingNumber].filter(Boolean).join(' ')}
                          {order.trackingUrl && (
                            <> · <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-900 font-medium">Track</a></>
                          )}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 items-center">
                        <button onClick={() => handleReorder(order)} className="inline-flex items-center gap-1 text-sm text-teal-700 hover:text-teal-900 font-medium">
                          <ArrowPathIcon className="h-4 w-4" /> Reorder
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Items:</h4>
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <span> - {item.name} (x{item.quantity})</span>
                          </div>
                          <span className="font-medium text-gray-800">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {refunded > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="font-semibold text-purple-800 mb-2">Refunds</h4>
                      <ul className="space-y-2">
                        {(order.refunds || []).map((r) => (
                          <li key={r.id} className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-md p-3">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold text-purple-900">${r.amount.toFixed(2)} refunded</span>
                              <span className="text-xs text-gray-500">{new Date(r.refundedAt).toLocaleDateString()}</span>
                            </div>
                            {r.reason && <p className="text-xs text-gray-600 mt-1">{r.reason}</p>}
                            {r.itemAdjustments && r.itemAdjustments.length > 0 && (
                              <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                                {r.itemAdjustments.map((a, i) => {
                                  const item = order.items.find((it) => it.productId === a.productID);
                                  return (
                                    <li key={i}>Returned {a.quantity}x {item ? item.name : a.productID}</li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {selectedCompanyId ? `No orders found for ${selectedCompany?.name}` : 'You have no orders.'}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedCompanyId ? 'There are no past orders for this company.' : 'Start shopping now to see your order history here!'}
            </p>
            <button
              onClick={() => navigate('/catalog')}
              className="bg-teal-700 text-white px-6 py-2 rounded-md hover:bg-teal-800 transition"
            >
              Go to Catalog
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrderHistory;