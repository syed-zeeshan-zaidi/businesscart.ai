import React, { useState, useEffect, useCallback } from 'react';
import { getAccounts, updateAccount, getAccount, regenerateStorefront, getGatewayConfigs, saveGatewayConfig, deleteGatewayConfig, getLogoUploadUrl, uploadFileToS3, GatewayConfigResponse } from '../api';
import { Account, CompanyData, CustomerGroup, MAX_CUSTOMER_GROUPS } from '../types';
import Navbar from './Navbar';
import toast, { Toaster } from 'react-hot-toast';
import { CARD, TH, ROW_HOVER, Pill } from './ui';
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
const GroupsIcon = () => <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;

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
  const [expanded, setExpanded] = useState(false);

  // Sync the checkbox to server truth whenever existingConfig arrives or changes.
  // Without this, the checkbox latches on first render (when existingConfig may
  // still be loading) and can desync from the "Live"/"Sandbox" badge — which is
  // dangerous: clicking Update would silently flip the stored sandbox flag and
  // route real checkouts at empty sandbox credentials.
  useEffect(() => {
    if (existingConfig) setSandbox(existingConfig.sandbox);
  }, [existingConfig?.sandbox, existingConfig?.id]);

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

  const renderFields = (values: Record<string, string>, setValues: (v: Record<string, string>) => void, label: string) => {
    const last4Map = label.startsWith('Production')
      ? existingConfig?.credentialLast4
      : existingConfig?.sandboxCredentialLast4;
    const placeholderFor = (key: string) => {
      const hint = last4Map?.[key];
      if (hint) return `\u2022\u2022\u2022\u2022${hint} (enter new value to replace)`;
      return isConfigured ? '(stored - enter new value to update)' : '';
    };
    return (
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
                placeholder={placeholderFor(field.key)}
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
                placeholder={placeholderFor(field.key)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
              />
            )}
          </div>
        ))}
      </div>
    );
  };

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

/* ---------- ad-platform conversion credentials (mirrors GatewayConfigPanel) ---------- */
const AdConversionsPanel: React.FC<{
  sellerId: string;
  initialInfo?: { configured: boolean; enabled: boolean; pixelId?: string; tokenLast4?: string };
}> = ({ sellerId, initialInfo }) => {
  const [expanded, setExpanded] = useState(false);
  const [pixelId, setPixelId] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initialInfo?.enabled ?? true);
  const [info, setInfo] = useState(initialInfo);
  const configured = !!info?.configured;

  const handleSave = async () => {
    const creds: Record<string, string> = {};
    if (pixelId.trim()) creds.pixel_id = pixelId.trim();
    if (token.trim()) creds.access_token = token.trim();
    const willBeConfigured = configured || Object.keys(creds).length > 0;
    if (enabled && !willBeConfigured) {
      toast.error('Enter a Pixel/Dataset ID and Access Token before enabling');
      return;
    }
    setSaving(true);
    try {
      const payload: { adConversionsEnabled: Record<string, boolean>; adConversions?: Record<string, Record<string, string>> } = {
        adConversionsEnabled: { meta: enabled },
      };
      if (Object.keys(creds).length > 0) payload.adConversions = { meta: creds };
      await updateAccount(sellerId, payload);
      toast.success('Meta conversions saved');
      setInfo({
        configured: willBeConfigured,
        enabled,
        pixelId: creds.pixel_id || info?.pixelId,
        tokenLast4: creds.access_token ? creds.access_token.slice(-4) : info?.tokenLast4,
      });
      setToken('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save Meta conversions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold text-gray-800">Meta (Facebook / Instagram)</span>
          {!configured
            ? <span className="text-xs text-gray-400">Not configured</span>
            : info?.enabled
              ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">Live</span>
              : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">Paused</span>}
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
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Enabled (send events to Meta)</span>
          </label>
          <p className="text-sm text-gray-500">Server-side Conversions API. Find these in Meta Events Manager &rarr; your dataset &rarr; Settings &rarr; Conversions API. The access token is encrypted and never shown again.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Pixel / Dataset ID</label>
              <input
                type="text"
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                placeholder={info?.pixelId || ''}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Conversions API Access Token</label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={info?.tokenLast4 ? `••••${info.tokenLast4} (enter new value to replace)` : ''}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-md hover:bg-teal-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : configured ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Google Ads conversions (Data Manager API; mirrors AdConversionsPanel) ---------- */
const GoogleConversionsPanel: React.FC<{
  sellerId: string;
  initialInfo?: { configured: boolean; enabled: boolean; customerId?: string; conversionActionId?: string; viewContentActionId?: string; addToCartActionId?: string; checkoutActionId?: string; tokenLast4?: string };
}> = ({ sellerId, initialInfo }) => {
  const [expanded, setExpanded] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [conversionActionId, setConversionActionId] = useState('');
  const [caViewContent, setCaViewContent] = useState('');
  const [caAddToCart, setCaAddToCart] = useState('');
  const [caCheckout, setCaCheckout] = useState('');
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initialInfo?.enabled ?? true);
  const [info, setInfo] = useState(initialInfo);
  const configured = !!info?.configured;

  const handleSave = async () => {
    const creds: Record<string, string> = {};
    if (clientId.trim()) creds.client_id = clientId.trim();
    if (clientSecret.trim()) creds.client_secret = clientSecret.trim();
    if (refreshToken.trim()) creds.refresh_token = refreshToken.trim();
    if (customerId.trim()) creds.customer_id = customerId.trim();
    if (conversionActionId.trim()) creds.conversion_action_id = conversionActionId.trim();
    if (caViewContent.trim()) creds.conversion_action_id_viewcontent = caViewContent.trim();
    if (caAddToCart.trim()) creds.conversion_action_id_addtocart = caAddToCart.trim();
    if (caCheckout.trim()) creds.conversion_action_id_initiatecheckout = caCheckout.trim();
    const willBeConfigured = configured || Object.keys(creds).length > 0;
    if (enabled && !willBeConfigured) {
      toast.error('Enter your Google Ads credentials before enabling');
      return;
    }
    setSaving(true);
    try {
      const payload: { adConversionsEnabled: Record<string, boolean>; adConversions?: Record<string, Record<string, string>> } = {
        adConversionsEnabled: { google: enabled },
      };
      if (Object.keys(creds).length > 0) payload.adConversions = { google: creds };
      await updateAccount(sellerId, payload);
      toast.success('Google conversions saved');
      setInfo({
        configured: willBeConfigured,
        enabled,
        customerId: creds.customer_id || info?.customerId,
        conversionActionId: creds.conversion_action_id || info?.conversionActionId,
        viewContentActionId: creds.conversion_action_id_viewcontent || info?.viewContentActionId,
        addToCartActionId: creds.conversion_action_id_addtocart || info?.addToCartActionId,
        checkoutActionId: creds.conversion_action_id_initiatecheckout || info?.checkoutActionId,
        tokenLast4: creds.refresh_token ? creds.refresh_token.slice(-4) : info?.tokenLast4,
      });
      setClientSecret('');
      setRefreshToken('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save Google conversions');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, setter: (v: string) => void, placeholder: string, type: 'text' | 'password' = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => setter(e.target.value)}
        placeholder={placeholder}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-teal-500 focus:border-teal-500"
      />
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
          <span className="text-sm font-semibold text-gray-800">Google Ads</span>
          {!configured
            ? <span className="text-xs text-gray-400">Not configured</span>
            : info?.enabled
              ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">Live</span>
              : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">Paused</span>}
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
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Enabled (send conversions to Google Ads)</span>
          </label>
          <p className="text-sm text-gray-500">Server-side Data Manager API. Create an OAuth client in Google Cloud, generate a refresh token with the <code className="text-xs bg-gray-100 px-1 rounded">https://www.googleapis.com/auth/datamanager</code> scope, and find your Customer ID + Conversion Action ID (a WEBPAGE conversion) in Google Ads. Secrets are encrypted and never shown again.</p>
          <div className="space-y-3">
            {field('OAuth Client ID', clientId, setClientId, info?.configured ? '(saved — enter to replace)' : '')}
            {field('OAuth Client Secret', clientSecret, setClientSecret, info?.configured ? '•••• (enter new value to replace)' : '', 'password')}
            {field('OAuth Refresh Token', refreshToken, setRefreshToken, info?.tokenLast4 ? `••••${info.tokenLast4} (enter new value to replace)` : '', 'password')}
            {field('Customer ID', customerId, setCustomerId, info?.customerId || '')}
            {field('Purchase Conversion Action ID (primary)', conversionActionId, setConversionActionId, info?.conversionActionId || '')}
          </div>
          <details className="mt-1">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer select-none">Secondary events (optional)</summary>
            <p className="text-xs text-gray-400 mt-1 mb-2"><b>Purchase</b> always sends to the primary action above. ViewContent / Add to Cart / Checkout send <b>only</b> if you map each to its own Google conversion action here (set those as Secondary/observation in Google Ads). Unmapped events are not sent.</p>
            <div className="space-y-3">
              {field('ViewContent action ID', caViewContent, setCaViewContent, info?.viewContentActionId || 'optional')}
              {field('Add to Cart action ID', caAddToCart, setCaAddToCart, info?.addToCartActionId || 'optional')}
              {field('Checkout action ID', caCheckout, setCaCheckout, info?.checkoutActionId || 'optional')}
            </div>
          </details>
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-md hover:bg-teal-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : configured ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gatewayConfigs, setGatewayConfigs] = useState<GatewayConfigResponse[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);

  // Release the last blob preview when the modal goes away, so an operator who
  // opens several companies does not accumulate them for the page's lifetime.
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  // Picking a file does NOT upload it. The S3 key is fixed per company, so an
  // immediate PUT would overwrite the live logo everywhere (portal navbar,
  // storefront favicon, og:image, reviews feed) before the operator pressed Save,
  // with no way to undo it from Cancel. Hold the file and upload during save, the
  // same deferred pattern ProductForm uses for product images.
  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Logo must be under 1 MB');
      return;
    }
    // createObjectURL outside the state updater: StrictMode double-invokes updaters
    // in dev, which would mint two blob URLs and leak the one it discards.
    const url = URL.createObjectURL(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setPendingLogo(file);
  };

  // Uploads the held logo, if any, and returns the CDN URL to persist. Called from
  // handleSave so an abandoned edit never touches the live asset.
  const uploadPendingLogo = async (): Promise<string | null> => {
    if (!pendingLogo) return null;
    setLogoUploading(true);
    try {
      const { uploadUrl, imageUrl } = await getLogoUploadUrl(pendingLogo.type, account._id);
      await uploadFileToS3(uploadUrl, pendingLogo);
      return imageUrl;
    } finally {
      setLogoUploading(false);
    }
  };

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

  /* ---------- Customer Groups handlers ---------- */
  const addCustomerGroup = () => {
    const groups = companyData.customerGroups || [];
    if (groups.length >= MAX_CUSTOMER_GROUPS) {
      toast.error(`Maximum ${MAX_CUSTOMER_GROUPS} customer groups allowed`);
      return;
    }
    const newGroup: CustomerGroup = {
      id: crypto.randomUUID(),
      name: '',
      groupPriceDiscount: 0,
    };
    setCompanyData(prev => ({ ...prev, customerGroups: [...(prev.customerGroups || []), newGroup] }));
  };

  const updateCustomerGroup = (idx: number, field: keyof CustomerGroup, value: string | number) => {
    setCompanyData(prev => {
      const groups = [...(prev.customerGroups || [])];
      groups[idx] = { ...groups[idx], [field]: value };
      return { ...prev, customerGroups: groups };
    });
  };

  const removeCustomerGroup = (idx: number) => {
    setCompanyData(prev => {
      const groups = [...(prev.customerGroups || [])];
      groups.splice(idx, 1);
      return { ...prev, customerGroups: groups };
    });
  };

  const handleSave = async () => {
    // Local validation: max groups, names, discount range
    const groups = companyData.customerGroups || [];
    if (groups.length > MAX_CUSTOMER_GROUPS) {
      toast.error(`Maximum ${MAX_CUSTOMER_GROUPS} customer groups allowed`);
      return;
    }
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g.name?.trim()) {
        toast.error(`Group #${i + 1}: name is required`);
        return;
      }
      if (g.groupPriceDiscount !== undefined && (g.groupPriceDiscount < 0 || g.groupPriceDiscount > 100)) {
        toast.error(`Group "${g.name}": discount must be 0-100`);
        return;
      }
    }
    // Coerce numeric form fields to numbers at the wire boundary. <input type=number>
    // returns string per HTML spec, so without this the API-first backend (which now
    // rejects type-mismatched values) would 400 on every save. Empty strings drop the
    // field entirely so partial updates preserve the existing stored value. Form state
    // stays as strings to keep decimal typing fluid (e.g., "15." mid-keystroke).
    const NUMERIC_FIELDS: (keyof CompanyData)[] = [
      'creditLimit', 'leadTime', 'taxRate', 'shippingRate',
      'minOrderAmountLimit', 'maxOrderAmountLimit',
      'minOrderQuantityLimit', 'maxOrderQuantityLimit',
      'monthlyOrderLimit', 'yearlyOrderLimit',
    ];
    const wirePayload: Record<string, unknown> = { ...companyData };
    for (const f of NUMERIC_FIELDS) {
      const v = wirePayload[f];
      if (v === '' || v === undefined || v === null) {
        delete wirePayload[f];
        continue;
      }
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isNaN(n)) {
          toast.error(`${f} must be a number`);
          return;
        }
        wirePayload[f] = n;
      }
    }

    // Upload the held logo only after every validation has passed, so a rejected
    // save never overwrites the live asset. The fixed S3 key means this PUT is
    // destructive and irreversible, hence last.
    let uploadedLogoUrl: string | null = null;
    try {
      uploadedLogoUrl = await uploadPendingLogo();
    } catch {
      toast.error('Logo upload failed, nothing was saved');
      return;
    }
    if (uploadedLogoUrl) wirePayload.logoUrl = uploadedLogoUrl;

    setIsSaving(true);
    try {
      const updatedAccount = await updateAccount(account._id, {
        company: wirePayload as unknown as CompanyData
      });
      setPendingLogo(null);
      toast.success('Company data updated successfully');
      onSave(updatedAccount);
      if (!alwaysOpen) onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update company data');
    } finally {
      setIsSaving(false);
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
      const feedCount = (companyData.feeds || []).length;
      toast.success(feedCount > 0
        ? `Storefront and ${feedCount} feed(s) generated successfully!`
        : 'Storefront generation triggered successfully!'
      );
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
              <div>
                <label className="block text-sm font-medium text-gray-700">Logo</label>
                <div className="mt-1 flex items-center gap-3">
                  {(logoPreview || companyData.logoUrl) && (
                    <img src={logoPreview || companyData.logoUrl} alt="" className="h-10 w-10 rounded object-contain bg-white border border-gray-200 shrink-0" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoPick}
                    disabled={logoUploading}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {logoUploading
                    ? 'Uploading…'
                    : pendingLogo
                      ? 'Selected. The logo is replaced when you press Save.'
                      /* SVG is deliberately not offered: Facebook, LinkedIn and X do not
                         render SVG og:images, so accepting it would silently break every
                         social preview while looking fine in the browser tab. */
                      : 'Square PNG, JPEG or WebP. At least 512×512, under 1 MB. Used as the storefront favicon, nav logo and social preview. Replacing it can take up to 24 hours to show.'}
                </p>
              </div>
              {renderInput('companyCode', 'Company Code', '', true)}
              {renderInput('companyCodeId', 'Company Code ID', '', true)}
            </div>
            {companyData.partnerCode && (
              <div className="bg-gray-50 rounded-md p-3 space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium w-28">Partner Invite</span>
                  <code className="text-gray-500 bg-white px-2 py-0.5 rounded truncate flex-1 mx-2">{companyData.partnerCode}</code>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(companyData.partnerCode || ''); toast.success('Copied!'); }} className="text-teal-700 hover:text-teal-500 font-medium">Copy</button>
                  </div>
                </div>
              </div>
            )}
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
              {renderInput('minOrderAmountLimit', 'Min Order Value (MOV)', '', false, 'number')}
              {renderInput('maxOrderAmountLimit', 'Max Order Amount', '', false, 'number')}
              {renderInput('minOrderQuantityLimit', 'Min Order Quantity (MOQ)', '', false, 'number')}
              {renderInput('maxOrderQuantityLimit', 'Max Order Quantity', '', false, 'number')}
              {renderInput('monthlyOrderLimit', 'Monthly Order Limit', '', false, 'number')}
              {renderInput('yearlyOrderLimit', 'Yearly Order Limit', '', false, 'number')}
            </div>
          </Section>

          <Section title="Customer Groups" icon={<GroupsIcon />}>
            <p className="text-sm text-gray-500">
              Define B2B customer segments. Each group has a uniform price discount applied to all visible products.
              Maximum {MAX_CUSTOMER_GROUPS} groups per company. B2C storefront customers are not affected by groups.
            </p>
            {(companyData.customerGroups || []).length === 0 && (
              <p className="text-sm text-gray-400 italic">No groups defined yet.</p>
            )}
            <div className="space-y-4">
              {(companyData.customerGroups || []).map((g, idx) => (
                <div key={g.id} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Group Name</label>
                    <input
                      type="text"
                      value={g.name}
                      onChange={(e) => updateCustomerGroup(idx, 'name', e.target.value)}
                      placeholder="e.g., Wholesale, VIP, Retail"
                      className="mt-1 block w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={g.groupPriceDiscount ?? 0}
                      onChange={(e) => updateCustomerGroup(idx, 'groupPriceDiscount', parseFloat(e.target.value) || 0)}
                      className="mt-1 block w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => removeCustomerGroup(idx)}
                      className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCustomerGroup}
              disabled={(companyData.customerGroups || []).length >= MAX_CUSTOMER_GROUPS}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              + Add Group {(companyData.customerGroups || []).length >= MAX_CUSTOMER_GROUPS && `(max ${MAX_CUSTOMER_GROUPS} reached)`}
            </button>
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
              {renderInput('taxRate', 'Tax Rate (%)', 'e.g., 8.25', false, 'number')}
              {renderInput('shippingRate', 'Shipping Rate ($)', 'e.g., 10.00', false, 'number')}
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderCheckbox('taxableGoods', 'Taxable Goods')}
                {renderCheckbox('quotesAllowed', 'Quotes (RFQ) Allowed')}
                {renderCheckbox('couponsEnabled', 'Coupons Enabled')}
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

                <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <strong>Storefront pages</strong> render your text directly with no platform default content. Allowed HTML tags: <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;br&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;em&gt;</code>, <code>&lt;ul&gt;</code>, <code>&lt;li&gt;</code>. All other tags and attributes (links, images, scripts, styles) are escaped for safety.
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">About Us (shown on storefront homepage)</label>
                  <textarea
                    name="d2c.aboutText"
                    value={companyData.d2c?.aboutText || ''}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Tell your customers about your business. This appears on your storefront homepage."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Privacy Policy</label>
                  <textarea
                    name="d2c.privacyText"
                    value={companyData.d2c?.privacyText || ''}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Your full privacy policy. If left blank the storefront privacy page will be empty."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Terms of Service</label>
                  <textarea
                    name="d2c.termsText"
                    value={companyData.d2c?.termsText || ''}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Your full terms of service. If left blank the storefront terms page will be empty."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Shipping & Returns Policy</label>
                  <textarea
                    name="d2c.shippingText"
                    value={companyData.d2c?.shippingText || ''}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Your full shipping and returns policy. If left blank the storefront shipping page will be empty."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Shipping Badge (optional)</label>
                  <input
                    name="d2c.shippingBadge"
                    value={companyData.d2c?.shippingBadge || ''}
                    onChange={handleChange}
                    placeholder="e.g., Free Shipping Over $50"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">Shown on product pages. Default: "Shipping Available"</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Returns Badge (optional)</label>
                  <input
                    name="d2c.returnsBadge"
                    value={companyData.d2c?.returnsBadge || ''}
                    onChange={handleChange}
                    placeholder="e.g., 30-Day Money Back Guarantee"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">Shown on product pages. Default: "Returns & Refunds"</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Gender for Feeds (optional)</label>
                  <select
                    name="d2c.feedGender"
                    value={companyData.d2c?.feedGender || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Used in Google/Bing feeds when product has no Gender attribute</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Age Group for Feeds (optional)</label>
                  <select
                    name="d2c.feedAgeGroup"
                    value={companyData.d2c?.feedAgeGroup || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="Adult">Adult</option>
                    <option value="Kids">Kids</option>
                    <option value="Toddler">Toddler</option>
                    <option value="Infant">Infant</option>
                    <option value="Newborn">Newborn</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Used in Google/Bing feeds when product has no Age Group attribute</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Links (optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input name="d2c.facebookUrl" value={companyData.d2c?.facebookUrl || ''} onChange={handleChange} placeholder="Facebook URL" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                    <input name="d2c.instagramUrl" value={companyData.d2c?.instagramUrl || ''} onChange={handleChange} placeholder="Instagram URL" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                    <input name="d2c.twitterUrl" value={companyData.d2c?.twitterUrl || ''} onChange={handleChange} placeholder="X (Twitter) URL" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                    <input name="d2c.linkedinUrl" value={companyData.d2c?.linkedinUrl || ''} onChange={handleChange} placeholder="LinkedIn URL" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                    <input name="d2c.tiktokUrl" value={companyData.d2c?.tiktokUrl || ''} onChange={handleChange} placeholder="TikTok URL" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                    <input name="d2c.whatsappNumber" value={companyData.d2c?.whatsappNumber || ''} onChange={handleChange} placeholder="WhatsApp number (e.g., 16575010200)" className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
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
                    ${isGenerating ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-teal-700 text-white hover:bg-teal-800'}`}
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

          {companyData.d2c?.enabled && (
            <Section title="Shopping Channel Feeds" icon={<StorefrontIcon />}>
              {(() => {
                const channels = [
                  { key: 'google', prefix: 'gs', ext: '.xml', label: 'Google', submitUrl: 'https://merchants.google.com/' },
                  { key: 'google_reviews', prefix: 'gr', ext: '.xml', label: 'Google Reviews', submitUrl: 'https://merchants.google.com/' },
                  { key: 'facebook', prefix: 'fb', ext: '.csv', label: 'Facebook', submitUrl: 'https://business.facebook.com/commerce/' },
                  { key: 'bing', prefix: 'bg', ext: '.tsv', label: 'Bing', submitUrl: 'https://merchants.ads.microsoft.com/' },
                  { key: 'pinterest', prefix: 'pt', ext: '.csv', label: 'Pinterest', submitUrl: 'https://business.pinterest.com/catalogs/' },
                  { key: 'tiktok', prefix: 'tt', ext: '.csv', label: 'TikTok', submitUrl: 'https://seller-us.tiktok.com/' },
                ];
                const enabledFeeds = companyData.feeds || [];
                const domain = companyData.d2c?.customDomain || companyData.d2c?.previewDomain;
                return (
                  <>
                    <div className="flex flex-wrap gap-4 mb-3">
                      {channels.map(ch => (
                        <label key={ch.key} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabledFeeds.includes(ch.key)}
                            onChange={() => {
                              const next = enabledFeeds.includes(ch.key)
                                ? enabledFeeds.filter((f: string) => f !== ch.key)
                                : [...enabledFeeds, ch.key];
                              setCompanyData(prev => ({ ...prev, feeds: next }));
                            }}
                            className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{ch.label}</span>
                        </label>
                      ))}
                    </div>
                    {enabledFeeds.length > 0 && domain && companyData.uniqueIdentifier && (
                      <div className="bg-gray-50 rounded-md p-3 space-y-2">
                        {channels.filter(ch => enabledFeeds.includes(ch.key)).map(ch => {
                          const url = `https://${domain}/feeds/${ch.prefix}-${companyData.uniqueIdentifier}${ch.ext}`;
                          return (
                            <div key={ch.key} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-medium w-20">{ch.label}</span>
                              <code className="text-gray-500 bg-white px-2 py-0.5 rounded truncate flex-1 mx-2">{url}</code>
                              <div className="flex space-x-2">
                                <button type="button" onClick={() => { navigator.clipboard.writeText(url); toast.success('Copied!'); }} className="text-teal-700 hover:text-teal-500 font-medium">Copy</button>
                                <a href={ch.submitUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-teal-500 font-medium">Submit&rarr;</a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Feeds regenerate automatically with products. Save and regenerate storefront to create files.</p>
                  </>
                );
              })()}
            </Section>
          )}

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

          {/* Server-side ad-platform conversion tracking (Meta CAPI; Google later) */}
          <Section title="Ad Conversion Tracking" icon={<PaymentIcon />}>
            <p className="text-sm text-gray-500 mb-4">Send server-side purchase &amp; funnel events to ad platforms for accurate attribution and optimization. Credentials are encrypted; tokens are never shown again.</p>
            <div className="space-y-3">
              <AdConversionsPanel sellerId={account._id} initialInfo={account.adConversionsInfo?.meta} />
              <GoogleConversionsPanel sellerId={account._id} initialInfo={account.adConversionsInfo?.google} />
            </div>
          </Section>
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
            disabled={isSaving}
            className={`px-6 py-2.5 font-bold rounded-lg transition shadow-sm text-sm flex items-center space-x-2 ${isSaving ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-teal-700 text-white hover:bg-teal-800'}`}
          >
            {isSaving ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            )}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
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
      const sorted = [...data].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAccounts(sorted);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: sorted, timestamp: Date.now() }));
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

  // Admin edit: fetch the full account (getAccountByID populates the masked
  // adConversionsInfo, which the list endpoint does not) so credential status
  // renders correctly. Falls back to the list object on error.
  const handleEditAccount = async (acc: Account) => {
    try {
      setEditingAccount(await getAccount(acc._id));
    } catch {
      setEditingAccount(acc);
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
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

        {userRole === 'admin' && <AdminView accounts={accounts} onEdit={handleEditAccount} />}
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
      <div className={`${CARD} p-10 text-center`}>
        <p className="text-sm font-semibold text-gray-700">No company accounts</p>
        <p className="text-sm text-gray-500 mt-1">There are no accounts with the “company” role yet.</p>
      </div>
    );

  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="min-w-[500px] w-full text-sm">
        <thead>
          <tr>
            <th className={`${TH} text-left`}>Company name</th>
            <th className={`${TH} text-left`}>Company code</th>
            <th className={`${TH} text-left`}>Status</th>
            <th className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companyAccounts.map((acc) => {
            const st = acc.company?.status || acc.accountStatus || '';
            const tone = st === 'active' ? 'green' : st === 'suspended' ? 'red' : st === 'pending' ? 'amber' : 'gray';
            return (
              <tr key={acc._id} className={ROW_HOVER}>
                <td className="px-6 py-3 whitespace-nowrap font-semibold text-gray-800">{acc.company?.name}</td>
                <td className="px-6 py-3 whitespace-nowrap font-mono text-xs text-gray-500">{acc.company?.companyCode || '—'}</td>
                <td className="px-6 py-3 whitespace-nowrap"><Pill tone={tone}>{st}</Pill></td>
                <td className="px-6 py-3 whitespace-nowrap text-right">
                  <button onClick={() => onEdit(acc)} className="text-teal-700 hover:text-teal-900 font-semibold">Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyForm;