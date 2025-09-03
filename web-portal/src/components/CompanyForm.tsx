import React, { useState, useEffect, useCallback } from 'react';
import { getAccounts, updateAccount, getAccount } from '../api';
import { Account, CompanyData } from '../types';
import Navbar from './Navbar';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const CACHE_KEY = 'accounts_cache';
const CACHE_DURATION = 30 * 60 * 1000;
const invalidateCache = () => localStorage.removeItem(CACHE_KEY);

/* ------------------------------------------------------------------ */
/* 1.  Hard-coded payment methods (exact strings the API accepts)     */
/* ------------------------------------------------------------------ */
const PAYMENT_OPTIONS = [
  'credit_card',
  'purchase_order',
  'amazon_pay',
  'google_pay',
  'stripe_pay',
  'pickup_pay',
  'deliver_pay'
] as const;

/* ------------------------------------------------------------------ */
/* 2.  Re-usable multi-select checkbox group                          */
/* ------------------------------------------------------------------ */
const PaymentMethodsSelect: React.FC<{
  value: string[];
  onChange: (list: string[]) => void;
}> = ({ value, onChange }) => {
  const toggle = (opt: string) =>
    onChange(
      value.includes(opt)
        ? value.filter((v) => v !== opt)
        : [...value, opt]
    );

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {PAYMENT_OPTIONS.map((opt) => (
        <label key={opt} className="inline-flex items-center">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            {opt.replace(/_/g, ' ').toUpperCase()}
          </span>
        </label>
      ))}
    </div>
  );
};

/* ==================================================================== */
/*                         EDIT COMPANY MODAL                            */
/* ==================================================================== */
interface EditCompanyModalProps {
  account: Account;
  onClose: () => void;
  onSave: (updatedAccount: Account) => void;
  alwaysOpen?: boolean;
}

const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  account,
  onClose,
  onSave,
  alwaysOpen = false
}) => {
  const [companyData, setCompanyData] = useState<Partial<CompanyData>>(
    account.company || {}
  );

  useEffect(() => {
    setCompanyData(account.company || {});
  }, [account]);

  /* -------------- unified change handler -------------------------- */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setCompanyData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setCompanyData((prev) => ({ ...prev, [name]: value }));
    }
  };

  /* -------------- save ------------------------------------------ */
  const handleSave = async () => {
    try {
      const updatedAccount = await updateAccount(account._id, {
        company: companyData as CompanyData
      });
      toast.success('Company data updated successfully');
      onSave(updatedAccount);
      if (!alwaysOpen) onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update company data');
    }
  };

  /* -------------- field renderer -------------------------------- */
  const renderField = (key: keyof CompanyData) => {
    const value = companyData[key];
    const isDisabled = key === 'companyCode' || key === 'companyCodeId';

    /* ---- special case: paymentMethods --------------------------- */
    if (key === 'paymentMethods') {
      return (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700">
            Payment Methods
          </label>
          <PaymentMethodsSelect
            value={(value as string[]) || []}
            onChange={(list) =>
              setCompanyData((prev) => ({ ...prev, paymentMethods: list }))
            }
          />
        </div>
      );
    }

    /* ---- boolean → checkbox ------------------------------------ */
    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center">
          <input
            type="checkbox"
            name={key}
            checked={value}
            onChange={handleChange}
            disabled={isDisabled}
            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm font-medium text-gray-700">
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
          </label>
        </div>
      );
    }

    /* ---- default → text input ---------------------------------- */
    return (
      <div key={key}>
        <label className="block text-sm font-medium text-gray-700">
          {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
        </label>
        <input
          type="text"
          name={key}
          value={String(value ?? '')}
          onChange={handleChange}
          disabled={isDisabled}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm disabled:bg-gray-200"
        />
      </div>
    );
  };

  /* -------------- modal shell ----------------------------------- */
  const modalContent = (
    <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="text-lg font-medium text-gray-900">
          Edit Company: {account.company?.name}
        </h3>
        {!alwaysOpen && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.keys(companyData).map((k) => renderField(k as keyof CompanyData))}
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        {!alwaysOpen && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  );

  return alwaysOpen ? (
    modalContent
  ) : (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      {modalContent}
    </div>
  );
};

/* ==================================================================== */
/*                         COMPANY FORM PAGE                             */
/* ==================================================================== */
const CompanyForm = () => {
  const { decodeJWT } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selfAccount, setSelfAccount] = useState<Account | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) setUserRole(decodeJWT(token)?.role || null);
  }, [decodeJWT]);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setAccounts(data);
          setIsLoading(false);
          return;
        }
      }
      const data = await getAccounts();
      setAccounts(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSelfAccount = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const decoded = decodeJWT(token);
    if (!decoded?.id) return;
    setIsLoading(true);
    try {
      const acc = await getAccount(decoded.id);
      setSelfAccount(acc);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch your account');
    } finally {
      setIsLoading(false);
    }
  }, [decodeJWT]);

  useEffect(() => {
    if (userRole === 'admin') fetchAccounts();
    else if (userRole === 'company') fetchSelfAccount();
  }, [userRole, fetchAccounts, fetchSelfAccount]);

  const handleRefresh = () => {
    if (userRole === 'admin') {
      invalidateCache();
      fetchAccounts();
    } else if (userRole === 'company') fetchSelfAccount();
  };

  const handleSave = (updatedAccount: Account) => {
    if (userRole === 'admin') {
      setAccounts((prev) => prev.map((acc) => (acc._id === updatedAccount._id ? updatedAccount : acc)));
      invalidateCache();
    } else if (userRole === 'company') setSelfAccount(updatedAccount);
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            {userRole === 'admin' ? 'Company Directory' : 'Your Company Details'}
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {userRole === 'admin' && <AdminView accounts={accounts} onEdit={setEditingAccount} />}
        {userRole === 'company' && selfAccount && (
          <EditCompanyModal account={selfAccount} onSave={handleSave} onClose={() => {}} alwaysOpen />
        )}
        {editingAccount && userRole === 'admin' && (
          <EditCompanyModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={handleSave} />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Admin table view                                                   */
/* ------------------------------------------------------------------ */
interface AdminViewProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ accounts, onEdit }) => {
  const companyAccounts = accounts.filter((a) => a.role === 'company');

  if (companyAccounts.length === 0)
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-semibold text-gray-800">No Company Accounts</h2>
        <p className="text-gray-600 mt-2">There are currently no accounts with the “company” role.</p>
      </div>
    );

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Code</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {companyAccounts.map((acc) => (
            <tr key={acc._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{acc.company?.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.company?.companyCode || '—'}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {acc.company?.status || acc.accountStatus}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onClick={() => onEdit(acc)} className="text-teal-600 hover:text-teal-900">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyForm;