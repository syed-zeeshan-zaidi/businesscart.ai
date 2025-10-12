import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Cart as CartType, Account } from '../types';
import { getCart, updateCartItem, removeItemFromCart, clearCart, createQuote, getAccount, getCustomerConfigurations } from '../api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const CACHE_KEY_PREFIX = 'cart_cache_';

const Cart: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string, logoUrl?: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  const invalidateCache = (companyId: string) => {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${companyId}`);
  };

  const fetchCart = useCallback(async (companyId: string) => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const fetchedCart = await getCart(companyId);
      setCart(fetchedCart);
      localStorage.setItem(`${CACHE_KEY_PREFIX}${companyId}`, JSON.stringify({ 
        data: fetchedCart, 
        timestamp: Date.now() 
      }));
    } catch (err: any) {
      setCart(null);
      invalidateCache(companyId);
      toast.error(err.response?.data?.message || `Failed to load cart for company ${companyId}`);
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
    if (!decodedUser || decodedUser.role !== 'customer') {
      toast.error('Access denied. Only customers can view their cart.');
      navigate('/home');
      return;
    }

    const loadCompanies = async () => {
      try {
        const accountData = await getAccount(decodedUser.id);
        setAccount(accountData);
        
        if (accountData.customer?.attachedCompanies && accountData.customer.attachedCompanies.length > 0) {
          const companies = accountData.customer.attachedCompanies.map(company => ({
            id: company.companyCodeId || company._id || company.companyCode,
            name: company.name,
            companyCode: company.companyCode,
            logoUrl: company.logoUrl, // Include logoUrl
          }));
          
          setAvailableCompanies(companies);
          
          if (companies.length > 0) {
            setSelectedCompanyId(companies[0].id);
          }
        } else {
          toast.error('No companies available for shopping');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load data');
      } finally {
        setInitialLoadComplete(true);
      }
    };

    loadCompanies();
  }, [isAuthenticated, navigate, decodeJWT]);

  useEffect(() => {
    if (selectedCompanyId && initialLoadComplete) {
      fetchCart(selectedCompanyId);
    }
  }, [selectedCompanyId, initialLoadComplete, fetchCart]);

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (!selectedCompanyId || quantity < 1) return;
    
    setLoading(true);
    try {
      const updatedCart = await updateCartItem(itemId, { entity: { quantity } }, selectedCompanyId);
      setCart(updatedCart);
      toast.success('Item quantity updated!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update item quantity');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedCompanyId) return;
    
    setLoading(true);
    try {
      const updatedCart = await removeItemFromCart(itemId, selectedCompanyId);
      setCart(updatedCart);
      toast.success('Item removed from cart!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = async () => {
    if (!selectedCompanyId) return;
    
    setLoading(true);
    try {
      const clearedCart = await clearCart(selectedCompanyId);
      setCart(clearedCart);
      toast.success('Cart cleared!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company to checkout.');
      return;
    }
    
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    const company = account?.customer?.attachedCompanies?.find(c => c.companyCodeId === selectedCompanyId);
    const paymentMethods = company?.paymentMethods || [];
    const deliveryMethods = company?.deliveryMethods || [];
    const shippingOutOptions = company?.shippingOutOptions || [];
    const companyLocations = company?.companyLocations || [];
    const customerAddresses = account?.customer?.customerAddresses || [];
    const configurations = await getCustomerConfigurations();

    setLoading(true);
    const toastId = toast.loading('Creating quote...');
    try {
      const quote = await createQuote({ 
        sellerId: selectedCompanyId,
        paymentMethods: paymentMethods,
        deliveryMethods: deliveryMethods,
        shippingOutOptions: shippingOutOptions,
        companyLocations: companyLocations,
        customerAddresses: customerAddresses,
        configurations,
        quoteType: 'standard',
      });
      toast.success('Proceeding to checkout!', { id: toastId });
      navigate(`/checkout/${quote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestQuote = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company to request a quote.');
      return;
    }
    
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    const company = account?.customer?.attachedCompanies?.find(c => c.companyCodeId === selectedCompanyId);
    const paymentMethods = company?.paymentMethods || [];
    const deliveryMethods = company?.deliveryMethods || [];
    const shippingOutOptions = company?.shippingOutOptions || [];
    const companyLocations = company?.companyLocations || [];
    const customerAddresses = account?.customer?.customerAddresses || [];
    const configurations = await getCustomerConfigurations();

    setLoading(true);
    const toastId = toast.loading('Creating quote...');
    try {
      const quote = await createQuote({ 
        sellerId: selectedCompanyId,
        paymentMethods: paymentMethods,
        deliveryMethods: deliveryMethods,
        shippingOutOptions: shippingOutOptions,
        companyLocations: companyLocations,
        customerAddresses: customerAddresses,
        configurations,
        quoteType: 'negotiable',
      });
      toast.success('Quote requested successfully!', { id: toastId });
      navigate(`/quote/${quote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const selectedCompany = availableCompanies.find(c => c.id === selectedCompanyId);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Your Shopping Cart</h1>
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

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!loading && (!cart || !cart.items || cart.items.length === 0) ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-4">
              {selectedCompanyId 
                ? `No items in cart for ${selectedCompany?.name || 'selected company'}`
                : 'Select a company to view your cart'
              }
            </p>
            <button
              onClick={() => navigate('/catalog')}
              className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 transition"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          cart && cart.items && cart.items.length > 0 && (
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Cart for {selectedCompany?.name || 'selected company'}
                </h2>
                <p className="text-sm text-gray-600">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              </div>

              <ul className="divide-y divide-gray-200">
                {cart.items.map((item) => (
                  <li key={item.id} className="p-4 sm:p-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-24 h-24 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden">
                        <img
                          src={item.image || 'https://via.placeholder.com/96x96'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:justify-between">
                          <h3 className="text-lg font-semibold text-gray-800 truncate pr-2">{item.name}</h3>
                          <p className="text-lg font-semibold text-gray-800 sm:text-right">
                            ${item.lineItemTotal.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 bg-gray-200 text-gray-600 rounded-l-md hover:bg-gray-300 disabled:opacity-50"
                              disabled={item.quantity <= 1 || loading}
                            >
                              -
                            </button>
                            <span className="px-4 py-1 border-t border-b border-gray-300 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 bg-gray-200 text-gray-600 rounded-r-md hover:bg-gray-300"
                              disabled={loading}
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="text-lg font-semibold text-gray-800 text-center sm:text-left">
                    Total: ${cart.totalPrice?.toFixed(2) || '0.00'}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:space-x-3 w-full sm:w-auto gap-2">
                    <button
                      onClick={handleClearCart}
                      className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      Clear Cart
                    </button>
                    <button
                      onClick={handleRequestQuote}
                      className="w-full sm:w-auto px-6 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Request a Quote'}
                    </button>
                    <button
                      onClick={handleCheckout}
                      className="w-full sm:w-auto px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Proceed to Checkout'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;