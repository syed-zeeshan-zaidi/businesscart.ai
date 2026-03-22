import React, { useState, useEffect, useCallback } from 'react';
import { getAccounts, updateAccount, getAccount, regenerateStorefront, getGatewayConfigs, saveGatewayConfig, deleteGatewayConfig, GatewayConfigResponse } from '../api';
import { Account, CompanyData } from '../types';
import Navbar from './Navbar';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const CACHE_KEY = 'accounts_cache';
const CACHE_DURATION = 30 * 60 * 1000;
const invalidateCache = () => localStorage.removeItem(CACHE_KEY);

/* ---------- constants ---------- */
const PAYMENT_OPTIONS = [
  'credit_card',
  'purchase_order',
  'amazon_pay',
  'stripe_pay',
  'pickup_&_pay',
  'deliver_pay'
] as const;

const DELIVERY_OPTIONS = ['pickup', 'dropoff', 'shipping_out'] as const;
const SHIPPING_OPTIONS = ['standard', 'express'] as const;

type DeliveryMethod = typeof DELIVERY_OPTIONS[number];
type ShippingOutOption = typeof SHIPPING_OPTIONS[number];

/* ---------- gateway credential field definitions ---------- */
const GATEWAY_FIELDS: Record<string, {
  displayName: string;
  fields: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }>;
}> = {
  amazon_pay: {
    displayName: 'Amazon Pay',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', type: 'text' },
      { key: 'storeId', label: 'Store ID', type: 'text' },
      { key: 'publicKeyId', label: 'Public Key ID', type: 'text' },
      { key: 'privateKey', label: 'Private Key (PEM)', type: 'textarea' },
      { key: 'region', label: 'Region', type: 'select', options: ['na', 'eu', 'jp'] },
    ],
  },
  stripe_pay: {
    displayName: 'Stripe',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'text' },
    ],
  },
  credit_card: {
    displayName: 'Authorize.net (Credit Card)',
    fields: [
      { key: 'apiLoginId', label: 'API Login ID', type: 'text' },
      { key: 'transactionKey', label: 'Transaction Key', type: 'text' },
    ],
  },
};

// Payment methods that need gateway credentials (others are offline and just work)
const METHODS_NEEDING_CREDENTIALS = Object.keys(GATEWAY_FIELDS);

/* ---------- gateway config panel per payment method ---------- */
const GatewayConfigPanel: React.FC<{
  gateway: string;
  sellerId: string;
  existingConfig?: GatewayConfigResponse;
  onSaved: () => void;
  onDeleted: () => void;
}> = ({ gateway, sellerId, existingConfig, onSaved, onDeleted }) => {
  const fieldDef = GATEWAY_FIELDS[gateway];

  const [sandbox, setSandbox] = useState(existingConfig?.sandbox ?? true);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [sandboxCredentials, setSandboxCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!existingConfig);

  if (!fieldDef) return null;

  const isConfigured = !!existingConfig;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        gateway,
        displayName: fieldDef.displayName,
        sandbox,
      };
      if (Object.values(credentials).some(v => v)) payload.credentials = credentials;
      if (Object.values(sandboxCredentials).some(v => v)) payload.sandboxCredentials = sandboxCredentials;

      await saveGatewayConfig(sellerId, payload);
      toast.success(`${fieldDef.displayName} gateway saved`);
      setCredentials({});
      setSandboxCredentials({});
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to save ${fieldDef.displayName}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${fieldDef.displayName} gateway configuration?`)) return;
    try {
      await deleteGatewayConfig(sellerId, gateway);
      toast.success(`${fieldDef.displayName} gateway removed`);
      onDeleted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove gateway');
    }
  };

  const renderFields = (values: Record<string, string>, setValues: (v: Record<string, string>) => void, label: string) => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {fieldDef.fields.map(field => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              rows={3}
              value={values[field.key] || ''}
              onChange={e => setValues({ ...values, [field.key]: e.target.value })}
              placeholder={isConfigured ? '(stored - enter new value to update)' : ''}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-teal-500 focus:border-teal-500"
            />
          ) : field.type === 'select' ? (
            <select
              value={values[field.key] || field.options?.[0] || ''}
              onChange={e => setValues({ ...values, [field.key]: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
            >
              {field.options?.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={values[field.key] || ''}
              onChange={e => setValues({ ...values, [field.key]: e.target.value })}
              placeholder={isConfigured ? '(stored - enter new value to update)' : ''}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold text-gray-800">{fieldDef.displayName}</span>
          {isConfigured && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${existingConfig.sandbox ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {existingConfig.sandbox ? 'Sandbox' : 'Live'}
            </span>
          )}
          {!isConfigured && <span className="text-xs text-gray-400">Not configured</span>}
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={sandbox}
              onChange={e => setSandbox(e.target.checked)}
              className="h-4 w-4 text-yellow-500 focus:ring-yellow-400 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Sandbox mode (use test credentials)</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderFields(credentials, setCredentials, 'Production Credentials')}
            {renderFields(sandboxCredentials, setSandboxCredentials, 'Sandbox Credentials')}
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-md hover:bg-teal-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : isConfigured ? 'Update Gateway' : 'Save Gateway'}
            </button>
            {isConfigured && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 transition"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- reusable multi-select ---------- */
const MultiSelect: React.FC<{
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (list: string[]) => void;
}> = ({ label, options, value, onChange }) => {
  const toggle = (opt: string) =>
    onChange(
      value.includes(opt)
        ? value.filter((v) => v !== opt)
        : [...value, opt]
    );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="inline-flex items-center" onMouseDown={(e) => e.preventDefault()}>
            <input
              type="checkbox"
              checked={value.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              {opt.replace(/_/g, ' ').toUpperCase()}
            </span>
          </label>
        ))}
      </div>
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
  userRole: string | null;
}

const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  account,
  onClose,
  onSave,
  alwaysOpen = false,
  userRole
}) => {
  const [companyData, setCompanyData] = useState<Partial<CompanyData>>(
    account.company || {}
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [gatewayConfigs, setGatewayConfigs] = useState<GatewayConfigResponse[]>([]);

  useEffect(() => {
    setCompanyData(account.company || {});
  }, [account]);

  const fetchGatewayConfigs = useCallback(async () => {
    try {
      const configs = await getGatewayConfigs(account._id);
      setGatewayConfigs(configs || []);
    } catch {
      // No configs yet — that's fine
      setGatewayConfigs([]);
    }
  }, [account._id]);

  useEffect(() => {
    fetchGatewayConfigs();
  }, [fetchGatewayConfigs]);

  useEffect(() => {
    if (!alwaysOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [alwaysOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1) {
      setCompanyData(prev => {
        const newState = { ...prev };
        let currentLevel: any = newState;
        for (let i = 0; i < nameParts.length - 1; i++) {
          currentLevel[nameParts[i]] = { ...currentLevel[nameParts[i]] };
          currentLevel = currentLevel[nameParts[i]];
        }
        const finalKey = nameParts[nameParts.length - 1];
        if (type === 'checkbox') {
          currentLevel[finalKey] = (e.target as HTMLInputElement).checked;
        } else {
          currentLevel[finalKey] = value;
        }
        return newState;
      });
    } else if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setCompanyData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setCompanyData((prev) => ({ ...prev, [name]: value }));
    }
  };

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

  const handleRegenerateStorefront = async () => {
    if (!account._id) {
      toast.error('Account ID is missing.');
      return;
    }
    setIsGenerating(true);
    try {
      await regenerateStorefront(account._id);
      toast.success('Storefront generation triggered successfully!');
      // It's a background process, so we might want to refresh the account data later
      // or just let the user know it's in progress.
      // For now, let's just refresh the account data after a short delay
      // to potentially get the updated previewDomain or status.
      setTimeout(() => {
        onSave(account); // This triggers a refetch of the account in the parent CompanyForm
      }, 3000); // Give some time for the generation process to start
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to trigger storefront generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderInput = (name: string, label: string, placeholder = '', readOnly = false, type = 'text') => {
    const value = name.split('.').reduce((o: any, i) => o?.[i], companyData);
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          type={type}
          id={name}
          name={name}
          value={String(value ?? '')}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={readOnly}
          className={`mt-1 block w-full px-4 py-2 bg-white border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
        />
      </div>
    );
  };

  const renderCheckbox = (name: keyof CompanyData, label: string) => (
    <label className="flex items-center space-x-3 bg-white p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={Boolean(companyData[name])}
        onChange={handleChange}
        className="h-5 w-5 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
      />
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </label>
  );

  const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200/80 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center space-x-3">
        {icon}
        <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );

  const ProfileIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
  const AddressIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const ConfigIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const PaymentIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
  const SalesIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const LimitsIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
  const StorefrontIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;

  const modalContent = (
    <div className={`relative mx-auto p-4 sm:p-6 ${alwaysOpen ? 'w-full' : 'top-10 mb-10 max-w-5xl'}`}>
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex justify-between items-center border-b p-5">
          <h3 className="text-2xl font-bold text-gray-800">
            {alwaysOpen ? 'Your Company Details' : `Edit Company: ${account.company?.name}`}
          </h3>
          {!alwaysOpen && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="p-6 space-y-8 bg-gray-50/50">
          <Section title="Company Profile" icon={<ProfileIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {renderInput('name', 'Company Name')}
              {renderInput('logoUrl', 'Logo URL', 'https://example.com/logo.png')}
              {renderInput('companyCode', 'Company Code', '', true)}
              {renderInput('companyCodeId', 'Company Code ID', '', true)}
            </div>
          </Section>

          <Section title="Business Address" icon={<AddressIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {renderInput('address.street', 'Street Address')}
              {renderInput('address.city', 'City')}
              {renderInput('address.state', 'State / Province')}
              {renderInput('address.zip', 'ZIP / Postal Code')}
            </div>
          </Section>

          <Section title="Sales & Credit" icon={<SalesIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              {renderInput('saleRepresentative', 'Sales Rep')}
              {renderInput('creditLimit', 'Credit Limit', '', false, 'number')}
              {renderInput('uniqueIdentifier', 'Unique Identifier')}
            </div>
          </Section>

          <Section title="Order Limits" icon={<LimitsIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {renderInput('minOrderAmountLimit', 'Min Order Amount', '', false, 'number')}
              {renderInput('maxOrderAmountLimit', 'Max Order Amount', '', false, 'number')}
              {renderInput('minOrderQuantityLimit', 'Min Order Quantity', '', false, 'number')}
              {renderInput('maxOrderQuantityLimit', 'Max Order Quantity', '', false, 'number')}
              {renderInput('monthlyOrderLimit', 'Monthly Order Limit', '', false, 'number')}
              {renderInput('yearlyOrderLimit', 'Yearly Order Limit', '', false, 'number')}
            </div>
          </Section>

          <Section title="Configuration" icon={<ConfigIcon />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  id="status"
                  value={companyData.status || 'active'}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {renderInput('leadTime', 'Lead Time (days)', '', false, 'number')}
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCheckbox('taxableGoods', 'Taxable Goods')}
                {renderCheckbox('quotesAllowed', 'Quotes Allowed')}
              </div>
            </div>
          </Section>

          <Section title="D2C Storefront" icon={<StorefrontIcon />}>
            <div className="space-y-6">
              <div className="flex items-center">
                <label className="flex items-center space-x-3 bg-white p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    name="d2c.enabled"
                    checked={Boolean(companyData.d2c?.enabled)}
                    onChange={handleChange}
                    disabled={userRole !== 'admin'}
                    className={`h-5 w-5 text-teal-700 focus:ring-teal-500 border-gray-300 rounded ${userRole !== 'admin' ? 'cursor-not-allowed opacity-50' : ''}`}
                  />
                  <span className="text-sm font-medium text-gray-800">Enable Storefront</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Primary Color</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="color"
                      name="d2c.primaryColor"
                      value={companyData.d2c?.primaryColor || '#000000'}
                      onChange={handleChange}
                      className="h-9 w-9 rounded overflow-hidden cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      name="d2c.primaryColor"
                      value={companyData.d2c?.primaryColor || '#000000'}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Secondary Color</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="color"
                      name="d2c.secondaryColor"
                      value={companyData.d2c?.secondaryColor || '#ffffff'}
                      onChange={handleChange}
                      className="h-9 w-9 rounded overflow-hidden cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      name="d2c.secondaryColor"
                      value={companyData.d2c?.secondaryColor || '#ffffff'}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                </div>

                {renderInput('d2c.contactEmail', 'Contact Email', 'support@example.com', false, 'email')}
                {renderInput('d2c.contactPhone', 'Contact Phone', '+1 234 567 890')}
                {renderInput('d2c.customDomain', 'Custom Domain', 'shop.example.com', userRole !== 'admin')}
                {renderInput('d2c.heroTitle', 'Hero Title', 'e.g., Premium Collection')}
                {renderInput('d2c.heroSlogan', 'Hero Slogan', 'e.g., Direct from origin...')}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hero Text Color</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="color"
                      name="d2c.heroTextColor"
                      value={companyData.d2c?.heroTextColor || '#ffffff'}
                      onChange={handleChange}
                      className="h-9 w-9 rounded overflow-hidden cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      name="d2c.heroTextColor"
                      value={companyData.d2c?.heroTextColor || '#ffffff'}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hero Bg Color</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="color"
                      name="d2c.heroBgColor"
                      value={companyData.d2c?.heroBgColor || companyData.d2c?.primaryColor || '#000000'}
                      onChange={handleChange}
                      className="h-9 w-9 rounded overflow-hidden cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      name="d2c.heroBgColor"
                      value={companyData.d2c?.heroBgColor || companyData.d2c?.primaryColor || '#000000'}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Preview Domain</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                      https://
                    </span>
                    <input
                      type="text"
                      disabled
                      value={companyData.d2c?.previewDomain || 'Generated after save...'}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border-gray-300 bg-gray-100 text-gray-500 sm:text-sm"
                    />
                  </div>
                  {companyData.d2c?.previewDomain && (
                    <a href={`https://${companyData.d2c.previewDomain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:text-teal-500 mt-1 inline-block font-medium">
                      Open Storefront &rarr;
                    </a>
                  )}
                </div>
              </div>
              {companyData.d2c?.enabled && (
                <button
                  onClick={handleRegenerateStorefront}
                  disabled={isGenerating}
                  className={`px-4 py-2 mt-4 rounded-md text-sm font-medium transition flex items-center justify-center space-x-2
                    ${isGenerating ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isGenerating ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356-2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m0 0H15" /></svg>
                  )}
                  <span>{isGenerating ? 'Generating...' : 'Regenerate Storefront'}</span>
                </button>
              )}
            </div>
          </Section>

          <Section title="Payment & Delivery Options" icon={<PaymentIcon />}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <MultiSelect
                label="Payment Methods"
                options={PAYMENT_OPTIONS}
                value={(companyData.paymentMethods as string[]) || []}
                onChange={(list) => setCompanyData((prev) => ({ ...prev, paymentMethods: list }))}
              />
              <MultiSelect
                label="Delivery Methods"
                options={DELIVERY_OPTIONS}
                value={(companyData.deliveryMethods as DeliveryMethod[]) || []}
                onChange={(list) => setCompanyData((prev) => ({ ...prev, deliveryMethods: list as DeliveryMethod[] }))}
              />
              <MultiSelect
                label="Shipping-out Options"
                options={SHIPPING_OPTIONS}
                value={(companyData.shippingOutOptions as ShippingOutOption[]) || []}
                onChange={(list) => setCompanyData((prev) => ({ ...prev, shippingOutOptions: list as ShippingOutOption[] }))}
              />
            </div>
          </Section>

          {/* Gateway credentials for payment methods that need them */}
          {((companyData.paymentMethods as string[]) || []).some(m => METHODS_NEEDING_CREDENTIALS.includes(m)) && (
            <Section title="Payment Gateway Configuration" icon={<PaymentIcon />}>
              <p className="text-sm text-gray-500 mb-4">Configure credentials for each payment provider. Each gateway saves independently.</p>
              <div className="space-y-3">
                {((companyData.paymentMethods as string[]) || [])
                  .filter(m => METHODS_NEEDING_CREDENTIALS.includes(m))
                  .map(method => (
                    <GatewayConfigPanel
                      key={method}
                      gateway={method}
                      sellerId={account._id}
                      existingConfig={gatewayConfigs.find(c => c.gateway === method)}
                      onSaved={fetchGatewayConfigs}
                      onDeleted={fetchGatewayConfigs}
                    />
                  ))}
              </div>
            </Section>
          )}
        </div>

        <div className="mt-4 p-5 border-t flex justify-end space-x-4 bg-white rounded-b-xl">
          {!alwaysOpen && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold text-sm"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-teal-700 text-white font-bold rounded-lg hover:bg-teal-800 transition shadow-sm text-sm flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );

  return alwaysOpen ? (
    modalContent
  ) : (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center">
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
        <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full" />
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
            className="bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {userRole === 'admin' && <AdminView accounts={accounts} onEdit={setEditingAccount} />}
        {userRole === 'company' && selfAccount && (
          <EditCompanyModal account={selfAccount} onSave={handleSave} onClose={() => { }} alwaysOpen userRole={userRole} />
        )}
        {editingAccount && userRole === 'admin' && (
          <EditCompanyModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={handleSave} userRole={userRole} />
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
                <button onClick={() => onEdit(acc)} className="text-teal-700 hover:text-teal-900">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyForm;