import React, { useState, useEffect } from 'react';
import { getAccounts } from '../api';
import { Account } from '../types';
import Navbar from './Navbar';
import toast, { Toaster } from 'react-hot-toast';

const CACHE_KEY = 'accounts_cache';
const CACHE_DURATION = 30 * 60 * 1000;

const invalidateCache = () => localStorage.removeItem(CACHE_KEY);

const CompanyForm = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      // 1. same cache as UserForm
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setAccounts(data);
          setIsLoading(false);
          return;
        }
      }

      // 2. fresh fetch
      const data = await getAccounts();
      setAccounts(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    invalidateCache();
    fetchAccounts();
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const companyAccounts = accounts.filter((a) => a.role === 'company');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Company Directory</h2>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {companyAccounts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800">No Company Accounts</h2>
            <p className="text-gray-600 mt-2">There are currently no accounts with the “company” role.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companyAccounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {acc.company?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {acc.company?.companyCode || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {acc.company?.status || acc.accountStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyForm;