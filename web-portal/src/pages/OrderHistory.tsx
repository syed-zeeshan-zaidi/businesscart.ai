
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Order as OrderType, Account as AccountType, CompanyData } from '../types';
import { getOrders, getAccount } from '../api';

const OrderHistory: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderType[] | null>(null);
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedAccount] = await Promise.all([
        getOrders(),
        getAccount(userId),
      ]);
      setOrders(fetchedOrders);
      setAccount(fetchedAccount);
      localStorage.setItem('orderHistory', JSON.stringify(fetchedOrders));
      localStorage.setItem('accountDetails', JSON.stringify(fetchedAccount));
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

    const cachedOrders = localStorage.getItem('orderHistory');
    const cachedAccount = localStorage.getItem('accountDetails');

    if (cachedOrders && cachedAccount) {
      const parsedAccount = JSON.parse(cachedAccount);
      if (parsedAccount._id === decodedUser.id) {
        setOrders(JSON.parse(cachedOrders));
        setAccount(parsedAccount);
        setLoading(false);
      } else {
        fetchHistory(decodedUser.id);
      }
    } else {
      fetchHistory(decodedUser.id);
    }
  }, [isAuthenticated, navigate, decodeJWT, fetchHistory]);

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

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Order History</h1>
          <button
            onClick={handleRefresh}
            className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {orders.map((order) => (
                <div key={order.id} className="px-6 py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-semibold">Order ID: {order.id}</p>
                      <p className="text-sm text-gray-500">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-500">Company: {getCompanyName(order.sellerId)}</p>
                    </div>
                    <p className="text-lg font-bold">${order.grandTotal.toFixed(2)}</p>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold">Items:</h4>
                    <ul className="list-disc list-inside">
                      {order.items.map((item) => (
                        <li key={item.productId}>{item.name} (x{item.quantity})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">You have no orders.</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default OrderHistory;
