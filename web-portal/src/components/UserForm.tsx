// src/components/UserForm.tsx
import React, { useState, useEffect } from 'react';
import { getAccounts, register, updateAccount, deleteAccount } from '../api';
import { Account } from '../types';
import Navbar from './Navbar';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const CACHE_KEY = 'accounts_cache';
const CACHE_DURATION = 30 * 60 * 1000;

type FormData = Partial<Account> & {
  code?: string;
  customerCodes?: string[];
  password?: string;
};

interface DecodedUser {
  id: string;
  role: 'admin' | 'company' | 'customer' | 'partner';
  email: string;
  associate_company_ids?: string[];
}

const UserForm = () => {
  const { decodeJWT } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const accountsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    role: 'customer',
    code: '',
    customerCodes: [],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<DecodedUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const decoded = decodeJWT(token);
          setCurrentUser(decoded);
        } catch (err) {
          console.error('Error decoding JWT', err);
        }
      }
      await fetchAccounts();
      setIsInitialized(true);
    };
    initialize();
  }, [decodeJWT]);

  useEffect(() => {
    if (!isInitialized) return;

    const searched = searchQuery
      ? accounts.filter(
          (account) =>
            (account.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (account.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : accounts;

    setFilteredAccounts(searched);
    setCurrentPage(1);
  }, [searchQuery, accounts, isInitialized]);

const fetchAccounts = async () => {
  setIsLoading(true);

  // 1. Try cache first
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      setAccounts(data);
      setIsLoading(false);
      return;
    }
  }

  try {
    const data = await getAccounts();
    if (!Array.isArray(data)) {
      setAccounts([]);
      return;
    }

    setAccounts(data);
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Error fetching accounts');
  } finally {
    setIsLoading(false);
  }
};

const invalidateCache = () => localStorage.removeItem(CACHE_KEY);

const handleRefresh = () => {
  invalidateCache();
  fetchAccounts();
};

  const validateForm = () => {
    const errs: string[] = [];
    if (!formData.name?.trim()) errs.push('Name is required');
    if (!formData.email?.trim()) errs.push('Email is required');
    if (!editingId && !formData.password?.trim()) errs.push('Password is required');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errs.push('Invalid email format');
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateForm();
    if (errs.length) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        name: formData.name?.trim(),
        email: formData.email?.trim(),
        role: formData.role,
        password: formData.password,
      };

      // role-specific sub-documents
      if (formData.role === 'company') {
        payload.company = {
          name: formData.name?.trim(),
          companyCode: formData.code?.trim() || '',
          paymentMethods: [],
          address: { street: '', city: '', state: '', zip: '' },
          sellingArea: { radius: 0, center: { lat: 0, lng: 0 } },
          status: 'active',
        };
      }

      if (formData.role === 'customer') {
        payload.customer = {
          customerCodes:
            formData.customerCodes?.map((c) => ({
              codeId: '',
              customerCode: c.trim(),
            })) || [],
        };
      }

      if (editingId) {
        if (!payload.password) delete payload.password;
        await updateAccount(editingId, payload);
        toast.success('Account updated');
      } else {
        await register(payload);
        toast.success('Account created');
      }

      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'customer',
        code: '',
        customerCodes: [],
      });
      setEditingId(null);
      setIsModalOpen(false);
      await fetchAccounts();
      setErrors([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

const handleEdit = (account: Account) => {
  setFormData({
    name: account.name || '',
    email: account.email || '',
    password: '',
    role: account.role || 'customer',
    code:
      account.role === 'company'
        ? account.company?.companyCode || ''
        : '',
    customerCodes:
      account.role === 'customer'
        ? account.customer?.customerCodes?.map((c) => c.customerCode) || []
        : [],
  });
  setEditingId(account._id);
  setIsModalOpen(true);
};

  const handleDelete = async () => {
    if (!accountToDelete) return;
    setIsLoading(true);
    try {
      await deleteAccount(accountToDelete);
      toast.success('Account deleted');
      setIsDeleteConfirmOpen(false);
      setAccountToDelete(null);
      await fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error deleting account');
    } finally {
      setIsLoading(false);
    }
  };

  const indexOfLast = currentPage * accountsPerPage;
  const indexOfFirst = indexOfLast - accountsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);

  const DebugInfo = () => {
    if (import.meta.env.MODE !== 'development') return null;
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Total: {accounts.length}</div>
          <div>Filtered: {filteredAccounts.length}</div>
          <div>Page: {currentPage}</div>
          <div>User: {currentUser?.role || 'none'}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Accounts</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Refresh
            </button>
            {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'customer',
                    code: '',
                    customerCodes: [],
                  });
                  setIsModalOpen(true);
                }}
                className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700"
              >
                <PlusIcon className="h-5 w-5 inline mr-1" />
                Add Account
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="w-full p-2 pl-10 border rounded-md"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading && accounts.length === 0 ? (
            <div className="p-8 text-center">Loading...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No accounts found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium">Status</th>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
                    <th className="px-6 py-3 text-right text-xs font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentAccounts.map((account) => (
                  <tr key={account._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{account.name}</td>
                    <td className="px-6 py-4">{account.email}</td>
                    <td className="px-6 py-4">{account.role}</td>
                    <td className="px-6 py-4">{account.accountStatus}</td>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleEdit(account)} className="text-yellow-600">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setAccountToDelete(account._id)} className="text-red-600">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center space-x-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 border rounded ${currentPage === i + 1 ? 'bg-teal-600 text-white' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        <DebugInfo />

        {/* Modal for Add/Edit */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
              >
                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                  <Dialog.Title className="text-lg font-medium mb-4">
                    {editingId ? 'Edit Account' : 'Add Account'}
                  </Dialog.Title>
                  {errors.length > 0 && (
                    <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
                      {errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Name"
                      className="w-full p-2 border rounded"
                      required
                    />
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email"
                      className="w-full p-2 border rounded"
                      required
                    />
                    <input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={editingId ? 'New password (optional)' : 'Password'}
                      className="w-full p-2 border rounded"
                      required={!editingId}
                    />
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                    >
                      <option value="customer">Customer</option>
                      <option value="company">Company</option>
                      <option value="partner">Partner</option>
                      {currentUser?.role === 'admin' && <option value="admin">Admin</option>}
                    </select>
                    
                    {formData.role === 'company' && (
                      <input
                        name="code"
                        value={formData.code}
                        onChange={handleChange}
                        placeholder="Company Code"
                        className="w-full p-2 border rounded"
                      />
                    )}
                    {formData.role === 'customer' && (
                      <input
                        name="customerCodes"
                        value={(formData.customerCodes || []).join(', ')}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerCodes: e.target.value
                              .split(',')
                              .map((c) => c.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Customer Codes (comma-separated)"
                        className="w-full p-2 border rounded"
                      />
                    )}
                    <div className="flex justify-end space-x-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 border rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-teal-600 text-white rounded"
                      >
                        {editingId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Delete Confirm */}
        <Transition appear show={isDeleteConfirmOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteConfirmOpen(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
              >
                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
                  <Dialog.Title className="text-lg font-medium mb-4">Confirm Delete</Dialog.Title>
                  <p className="text-sm text-gray-600 mb-4">This action cannot be undone.</p>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-4 py-2 border rounded">
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export default UserForm;