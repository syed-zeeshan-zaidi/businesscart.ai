
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Account as AccountType } from '../types';
import { getAccount } from '../api';

const Account: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const fetchedAccount = await getAccount(userId);
      setAccount(fetchedAccount);
      localStorage.setItem('accountDetails', JSON.stringify(fetchedAccount));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load account details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const cachedAccount = localStorage.getItem('accountDetails');
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

    if (cachedAccount) {
      const parsedAccount = JSON.parse(cachedAccount);
      if (parsedAccount._id === decodedUser.id) {
        setAccount(parsedAccount);
        setLoading(false);
      } else {
        fetchAccount(decodedUser.id);
      }
    } else {
      fetchAccount(decodedUser.id);
    }
  }, [isAuthenticated, navigate, decodeJWT, fetchAccount]);

  const handleRefresh = () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decodedUser = decodeJWT(token);
      if (decodedUser) {
        fetchAccount(decodedUser.id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Your Account</h1>
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
        ) : account ? (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Account Information</h2>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-4">
                <p><strong>Name:</strong> {account.name}</p>
                <p><strong>Email:</strong> {account.email}</p>
                <p><strong>Role:</strong> {account.role}</p>
                <p><strong>Status:</strong> {account.accountStatus}</p>
              </div>
              {account.company && (
                <div className="px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-800">Company Details</h3>
                  <p><strong>Company Name:</strong> {account.company.name}</p>
                  <p><strong>Company Status:</strong> {account.company.status}</p>
                </div>
              )}
              {account.customer && account.customer.attachedCompanies && (
                <div className="px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-800">Associated Companies</h3>
                  <ul>
                    {account.customer.attachedCompanies.map((company) => (
                      <li key={company.companyCode}>{company.name} ({company.companyCode})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Could not load account details.</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default Account;
