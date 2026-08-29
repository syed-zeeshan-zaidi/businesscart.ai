// src/components/UserForm.tsx
import React, { useState, useEffect } from 'react';
import { getAccounts, register, updateAccount, deleteAccount, updateCustomerConfiguration, getAccount, exportCustomers } from '../api';
import { Account, CustomerConfiguration, CustomerGroup } from '../types';
import Navbar from './Navbar';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, Cog6ToothIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, CARD, TH, TD, ROW_HOVER, Pill, PillTone, Spinner, BTN_PRIMARY, BTN_SECONDARY } from './ui';
import Pagination from './Pagination';

const ROLE_TONE: Record<string, PillTone> = { admin: 'purple', company: 'teal', customer: 'blue', partner: 'indigo', b2c: 'gray' };
const ACCT_STATUS_TONE: Record<string, PillTone> = { active: 'green', pending: 'amber', suspended: 'red', inactive: 'gray' };

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

  // State for the new configuration modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configuringCustomer, setConfiguringCustomer] = useState<Account | null>(null);
  const [configData, setConfigData] = useState<Partial<CustomerConfiguration>>({});
  const [configGroupID, setConfigGroupID] = useState<string>('');
  // Company's defined groups (loaded once for the dropdown)
  const [companyGroups, setCompanyGroups] = useState<CustomerGroup[]>([]);

  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const decoded = decodeJWT(token);
          setCurrentUser(decoded);
          // If logged-in user is a company, load their customer groups for the config modal dropdown
          if (decoded?.role === 'company' && decoded?.id) {
            try {
              const acc = await getAccount(decoded.id);
              setCompanyGroups(acc?.company?.customerGroups || []);
            } catch {
              // Non-fatal — modal will simply show "(no group)" only
            }
          }
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
      setAccounts(Array.isArray(data) ? data : []);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
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
      const payload: any = { name: formData.name?.trim(), email: formData.email?.trim(), role: formData.role, password: formData.password };
      if (formData.role === 'company') {
        payload.company = { name: formData.name?.trim(), companyCode: formData.code?.trim() || '', paymentMethods: [], address: { street: '', city: '', state: '', zip: '' }, sellingArea: { radius: 0, center: { lat: 0, lng: 0 } }, status: 'active' };
      }
      if (formData.role === 'customer') {
        payload.customer = { customerConfigs: formData.customerCodes?.map((c) => ({ codeId: '', customerCode: c.trim() })) || [] };
      }
      if (editingId) {
        if (!payload.password) delete payload.password;
        await updateAccount(editingId, payload);
        toast.success('Account updated');
      } else {
        await register(payload);
        toast.success('Account created');
      }
      setFormData({ name: '', email: '', password: '', role: 'customer', code: '', customerCodes: [] });
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
      code: account.role === 'company' ? account.company?.companyCode || '' : '',
      customerCodes: account.role === 'customer' ? account.customer?.customerConfigs?.map((c) => c.customerCode) || [] : [],
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

  // --- Handlers for Configuration Modal ---
  const handleOpenConfigModal = (account: Account) => {
    if (!currentUser || currentUser.role !== 'company') return;
    const companyId = currentUser.id;
    const customerEntry = account.customer?.customerConfigs?.find(c => c.codeId === companyId);
    const existingConfig = customerEntry?.configuration;
    setConfigData(existingConfig || { discountPercentage: 0 });
    setConfigGroupID(customerEntry?.groupID || '');
    setConfiguringCustomer(account);
    setIsConfigModalOpen(true);
  };

  const handleSaveConfiguration = async () => {
    if (!configuringCustomer) return;
    const loadingToast = toast.loading('Saving configuration...');
    try {
      // Backend accepts groupID alongside configuration fields in one call (Step 4)
      const payload: Partial<CustomerConfiguration> & { groupID?: string } = {
        ...configData,
        groupID: configGroupID, // empty string explicitly clears the group
      };
      await updateCustomerConfiguration(configuringCustomer._id, payload);
      toast.dismiss(loadingToast);
      toast.success('Configuration saved!');
      setIsConfigModalOpen(false);
      setConfiguringCustomer(null);
      // Invalidate cache and refetch to get updated data
      invalidateCache();
      fetchAccounts();
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err.response?.data?.message || 'Failed to save configuration.');
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setConfigData(prev => ({ ...prev, [name]: checked }));
    } else {
      setConfigData(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value }));
    }
  };

  const handleConfigMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, field: keyof CustomerConfiguration) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    setConfigData(prev => ({ ...prev, [field]: values }));
  };

  const handleCertChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfigData(prev => ({ ...prev, resaleCertificate: { ...prev.resaleCertificate, [name]: value || undefined } }));
  };

  const indexOfLast = currentPage * accountsPerPage;
  const indexOfFirst = indexOfLast - accountsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <PageHeader title="Accounts" subtitle="Customers, companies, and partners on the platform.">
          <button onClick={handleRefresh} disabled={isLoading} className={`${BTN_SECONDARY} disabled:opacity-50`}>Refresh</button>
          {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try { await exportCustomers(); toast.success('CSV downloaded'); } catch { toast.error('Export failed'); }
                }}
                className={`${BTN_SECONDARY} flex items-center gap-1.5`}
                aria-label="Export accounts"
                title="Export accounts"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={() => { setEditingId(null); setFormData({ name: '', email: '', password: '', role: 'customer', code: '', customerCodes: [] }); setIsModalOpen(true); }} className={`${BTN_PRIMARY} flex items-center gap-1`}>
                <PlusIcon className="h-4 w-4" /> Add account
              </button>
            </>
          )}
        </PageHeader>

        <div className="mt-6 mb-4">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search accounts…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
        </div>

        <div className={`${CARD} overflow-x-auto`}>
          {isLoading && accounts.length === 0 ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : (
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr>
                  <th className={`${TH} text-left`}>Name</th>
                  <th className={`${TH} text-left`}>Email</th>
                  <th className={`${TH} text-left`}>Role</th>
                  <th className={`${TH} text-left`}>Status</th>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'company') && <th className={`${TH} text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {currentAccounts.map((account) => (
                  <tr key={account._id} className={ROW_HOVER}>
                    <td className={`${TD} font-semibold text-gray-800`}>{account.name}</td>
                    <td className={`${TD} text-gray-600`}>{account.email}</td>
                    <td className={TD}><Pill tone={ROLE_TONE[account.role] || 'gray'}>{account.role}</Pill></td>
                    <td className={TD}><Pill tone={ACCT_STATUS_TONE[account.accountStatus] || 'gray'}>{account.accountStatus}</Pill></td>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
                      <td className={`${TD} text-right space-x-1 whitespace-nowrap`}>
                        <button onClick={() => handleEdit(account)} className="text-yellow-600 p-2 hover:bg-yellow-50 rounded" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                        {currentUser?.role === 'company' && account.role === 'customer' && (
                          <button onClick={() => handleOpenConfigModal(account)} className="text-teal-700 p-2 hover:bg-teal-50 rounded" title="Customer settings"><Cog6ToothIcon className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => { setAccountToDelete(account._id); setIsDeleteConfirmOpen(true); }} className="text-red-600 p-2 hover:bg-red-50 rounded" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredAccounts.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 tabular-nums">
            Showing {indexOfFirst + 1}-{Math.min(indexOfLast, filteredAccounts.length)} of {filteredAccounts.length} accounts
          </div>
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} align="center" />

        {/* Modal for Add/Edit */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <div className="fixed inset-0 bg-black bg-opacity-25" />
                        </Transition.Child>
                        <div className="fixed inset-0 flex items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                                    <Dialog.Title className="text-lg font-medium mb-4">{editingId ? 'Edit Account' : 'Add Account'}</Dialog.Title>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {errors.length > 0 && (
                                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                                                <strong className="font-bold">Error!</strong>
                                                <ul className="mt-2 list-disc pl-5">
                                                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-sm font-medium">Name</label>
                                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Email</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Password</label>
                                            <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded" placeholder={editingId ? 'Leave blank to keep current' : ''} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Role</label>
                                            <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded">
                                                <option value="customer">Customer</option>
                                                <option value="company">Company</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                        {formData.role === 'company' && (
                                            <div>
                                                <label className="block text-sm font-medium">Company Code</label>
                                                <input type="text" name="code" value={formData.code} onChange={handleChange} className="w-full p-2 border rounded" />
                                            </div>
                                        )}
                                        {formData.role === 'customer' && (
                                            <div>
                                                <label className="block text-sm font-medium">Customer Codes (comma-separated)</label>
                                                <input type="text" name="customerCodes" value={formData.customerCodes?.join(', ')} onChange={(e) => setFormData(prev => ({ ...prev, customerCodes: e.target.value.split(',').map(c => c.trim()) }))} className="w-full p-2 border rounded" />
                                            </div>
                                        )}
                                        <div className="flex justify-end space-x-2 pt-4">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                                            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-teal-700 text-white rounded">{isLoading ? 'Saving...' : 'Save'}</button>
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
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <div className="fixed inset-0 bg-black bg-opacity-25" />
                        </Transition.Child>
                        <div className="fixed inset-0 flex items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                                    <Dialog.Title className="text-lg font-medium mb-2">Confirm Deletion</Dialog.Title>
                                    <p>Are you sure you want to delete this account? This action cannot be undone.</p>
                                    <div className="flex justify-end space-x-2 pt-6">
                                        <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                                        <button type="button" onClick={handleDelete} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded">{isLoading ? 'Deleting...' : 'Delete'}</button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
          </Dialog>
        </Transition>

        {/* Configuration Modal */}
        <Transition appear show={isConfigModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsConfigModalOpen(false)}>
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100">
                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <Dialog.Title className="text-lg font-medium mb-4">Customer Settings — {configuringCustomer?.name}</Dialog.Title>

                  {/* SEGMENT — primary mechanism, prominent at top */}
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Segment</h4>
                    <div className="bg-teal-50 border border-teal-200 rounded-md p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Group</label>
                      <select
                        value={configGroupID}
                        onChange={(e) => setConfigGroupID(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">(no group — uses base prices)</option>
                        {companyGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}{g.groupPriceDiscount ? ` — ${g.groupPriceDiscount}% off` : ''}
                          </option>
                        ))}
                      </select>
                      {companyGroups.length === 0 ? (
                        <p className="text-xs text-gray-500 italic mt-2">No groups defined. Add groups in Company Settings → Customer Groups.</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">Group determines this customer&apos;s price discount and which restricted products they can see.</p>
                      )}
                    </div>
                  </div>

                  {/* ADVANCED OVERRIDES — rare exceptions */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Advanced Overrides</h4>
                    <p className="text-xs text-gray-500 italic mb-3">Optional. Override company defaults for this customer only. Leave fields blank to use defaults.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium">Discount Percentage (%) <span className="text-xs text-gray-400">(overrides group discount)</span></label>
                      <input type="number" name="discountPercentage" value={configData.discountPercentage ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="e.g., 10.5" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Credit Limit ($)</label>
                      <input type="number" name="creditLimit" value={configData.creditLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no limit" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Min Order Value / MOV ($)</label>
                        <input type="number" name="minOrderAmountLimit" value={configData.minOrderAmountLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no min" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Max Order Amount ($)</label>
                        <input type="number" name="maxOrderAmountLimit" value={configData.maxOrderAmountLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no max" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Min Order Quantity (MOQ)</label>
                        <input type="number" name="minOrderQuantityLimit" value={configData.minOrderQuantityLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no min" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Max Order Quantity</label>
                        <input type="number" name="maxOrderQuantityLimit" value={configData.maxOrderQuantityLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no max" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Monthly Order Limit</label>
                        <input type="number" name="monthlyOrderLimit" value={configData.monthlyOrderLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no limit" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Yearly Order Limit</label>
                        <input type="number" name="yearlyOrderLimit" value={configData.yearlyOrderLimit ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="0 = no limit" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Lead Time (days)</label>
                        <input type="number" name="leadTime" value={configData.leadTime ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="e.g., 3" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Tax Rate (%) Override</label>
                        <input type="number" step="0.01" min="0" max="100" name="taxRate" value={configData.taxRate ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="e.g., 0 for tax-exempt" />
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Resale / Tax-Exemption Certificate</span>
                        <span className="text-xs text-gray-400">Justifies a 0% tax-exempt customer</span>
                      </div>
                      {(() => {
                        const cert = configData.resaleCertificate || {};
                        const isExempt = configData.taxRate === 0;
                        const hasCert = !!(cert.number && cert.state);
                        const today = new Date().toISOString().slice(0, 10);
                        const expired = !!cert.expiryDate && cert.expiryDate < today;
                        const soon = !!cert.expiryDate && !expired && (new Date(cert.expiryDate).getTime() - Date.now()) < 60 * 24 * 3600 * 1000;
                        let cls = '', msg = '';
                        if (isExempt && !hasCert) { cls = 'bg-red-50 text-red-700 border-red-200'; msg = 'Tax-exempt (0%) with no resale certificate on file. The seller is liable for uncollected tax in an audit.'; }
                        else if (isExempt && expired) { cls = 'bg-red-50 text-red-700 border-red-200'; msg = `Resale certificate expired on ${cert.expiryDate}. Renew before exempting further orders.`; }
                        else if (isExempt && soon) { cls = 'bg-amber-50 text-amber-700 border-amber-200'; msg = `Resale certificate expires on ${cert.expiryDate}. Renewal due soon.`; }
                        else if (hasCert) { cls = 'bg-green-50 text-green-700 border-green-200'; msg = `Resale certificate on file${cert.expiryDate ? ` (expires ${cert.expiryDate})` : ''}.`; }
                        else { return null; }
                        return <div className={`text-xs rounded border px-3 py-2 ${cls}`}>{msg}</div>;
                      })()}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium">Issuing State</label>
                          <input name="state" value={configData.resaleCertificate?.state ?? ''} onChange={handleCertChange} maxLength={2} className="w-full p-2 border rounded uppercase" placeholder="e.g., CA" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">Certificate / Permit Number</label>
                          <input name="number" value={configData.resaleCertificate?.number ?? ''} onChange={handleCertChange} className="w-full p-2 border rounded" placeholder="Buyer's resale / sales-tax ID" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium">Type</label>
                          <select name="type" value={configData.resaleCertificate?.type ?? ''} onChange={handleCertChange} className="w-full p-2 border rounded">
                            <option value="">Select</option>
                            <option value="resale">Resale</option>
                            <option value="exemption">Exemption</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium">Issue Date</label>
                          <input type="date" name="issueDate" value={configData.resaleCertificate?.issueDate ?? ''} onChange={handleCertChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">Expiry Date</label>
                          <input type="date" name="expiryDate" value={configData.resaleCertificate?.expiryDate ?? ''} onChange={handleCertChange} className="w-full p-2 border rounded" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">The certificate document itself stays in your own records; this records its details for audit reference.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Shipping Rate ($) Override</label>
                        <input type="number" step="0.01" min="0" name="shippingRate" value={configData.shippingRate ?? ''} onChange={handleConfigChange} className="w-full p-2 border rounded" placeholder="e.g., 0 for free shipping" />
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" name="quotesAllowed" checked={configData.quotesAllowed ?? true} onChange={handleConfigChange} className="rounded" />
                        <span className="text-sm font-medium">Quotes (RFQ) Allowed</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" name="taxableGoods" checked={configData.taxableGoods ?? true} onChange={handleConfigChange} className="rounded" />
                        <span className="text-sm font-medium">Taxable Goods</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Allowed Payment Methods (Override)</label>
                      <select multiple name="paymentMethods" value={configData.paymentMethods || []} onChange={(e) => handleConfigMultiSelectChange(e, 'paymentMethods')} className="w-full h-28 p-2 border rounded">
                        <option value="credit_card">Credit Card</option>
                        <option value="purchase_order">Purchase Order</option>
                        <option value="on_account">On Account (Net Terms)</option>
                        <option value="stripe_pay">Stripe</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Allowed Delivery Methods (Override)</label>
                      <select multiple name="deliveryMethods" value={configData.deliveryMethods || []} onChange={(e) => handleConfigMultiSelectChange(e, 'deliveryMethods')} className="w-full h-20 p-2 border rounded">
                        <option value="pickup">Pickup</option>
                        <option value="dropoff">Dropoff</option>
                        <option value="shipping_out">Shipping Out</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Shipping Out Options (Override)</label>
                      <select multiple name="shippingOutOptions" value={configData.shippingOutOptions || []} onChange={(e) => handleConfigMultiSelectChange(e, 'shippingOutOptions')} className="w-full h-16 p-2 border rounded">
                        <option value="standard">Standard</option>
                        <option value="express">Express</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-6">
                    <button type="button" onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                    <button
                      type="button"
                      onClick={handleSaveConfiguration}
                      disabled={isLoading}
                      className="px-4 py-2 bg-teal-700 text-white rounded disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >Save Configuration</button>
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