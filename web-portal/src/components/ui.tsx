// Shared portal UI primitives — one source of truth for the admin/company
// surfaces (Dashboard, Analytics, Billing, and the management pages as they
// migrate). Keeps the "band + tile + tabular-nums + teal accent" language
// consistent so every screen reads as one product.
import React from 'react';

// Card + table cell class strings (compose with alignment/extra utilities).
export const CARD = 'bg-white rounded-xl border border-gray-200 shadow-sm';
export const TH = 'text-[11px] font-extrabold uppercase tracking-wide text-gray-400 px-4 pt-4 pb-3 border-b border-gray-200';
export const TD = 'px-4 py-3 border-b border-gray-100';
export const ROW_HOVER = 'hover:bg-teal-50/40';

// Section header: uppercase micro-label + hairline rule.
export const Band: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3 mt-8 mb-3.5">
    <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-gray-400 whitespace-nowrap">{children}</span>
    <span className="h-px flex-1 bg-gray-200" />
  </div>
);

// Page header: title + optional subtitle + optional action buttons (children).
export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; children?: React.ReactNode }> = ({ title, subtitle, children }) => (
  <header className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-800">{title}</h1>
      {subtitle ? <p className="text-gray-500 text-sm mt-1">{subtitle}</p> : null}
    </div>
    {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
  </header>
);

// Quiet supporting stat tile: micro-label + tabular value + optional sub-line.
export const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; loading?: boolean }> = ({ label, value, sub, loading }) => (
  <div className={`${CARD} p-4 flex flex-col min-w-0`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
    {loading ? (
      <div className="animate-spin h-6 w-6 border-2 border-teal-700 border-t-transparent rounded-full mt-2" />
    ) : (
      <span className="mt-2 text-2xl font-extrabold tracking-tight leading-none text-gray-800 tabular-nums">{value}</span>
    )}
    {sub && !loading ? <span className="mt-1.5 text-xs font-semibold">{sub}</span> : null}
  </div>
);

export type PillTone = 'teal' | 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'indigo' | 'purple';
const PILL_TONE: Record<PillTone, string> = {
  teal: 'bg-teal-100 text-teal-800',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
};

// Small status/tag pill (uppercase micro-label).
export const Pill: React.FC<{ tone?: PillTone; children: React.ReactNode }> = ({ tone = 'gray', children }) => (
  <span className={`inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${PILL_TONE[tone]}`}>{children}</span>
);

// Order-status → pill tone, mirroring the merchant Orders lifecycle palette.
export const STATUS_TONE: Record<string, PillTone> = {
  pending: 'gray', processing: 'blue', shipped: 'indigo', delivered: 'teal',
  completed: 'green', cancelled: 'red', returned: 'amber', refunded: 'purple',
};

export const Spinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-spin h-6 w-6 border-2 border-teal-700 border-t-transparent rounded-full ${className}`} />
);

// Primary / secondary button class strings (match Dashboard header actions).
export const BTN_PRIMARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
export const BTN_SECONDARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
