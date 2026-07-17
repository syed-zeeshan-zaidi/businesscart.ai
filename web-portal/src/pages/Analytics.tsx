import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { getVisitorStats, getVisitors, getAccounts } from '../api';
import { Account } from '../types';
import {
  UsersIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  ShoppingCartIcon,
  EnvelopeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface Stats {
  totalVisitors: number;
  totalBots: number;
  totalRegistered: number;
  totalOrdered: number;
  totalCartAdds: number;
  totalCheckoutStarts: number;
  totalContactedUs: number;
  todayVisitors: number;
  weekVisitors: number;
  monthVisitors: number;
  topSources: { _id: string; count: number }[];
  topCountries: { _id: string; count: number }[];
  devices: { _id: string; count: number }[];
  browsers: { _id: string; count: number }[];
  totalRevenue: number;
  totalOrders: number;
  productViewsSent: number;
  conversionsSent: number;
  conversionsFailed: number;
  conversionsAvgMatch: number;
  conversionsByProvider?: { _id: string; count: number }[];
  cartAddsBySource?: { _id: string; count: number }[];
  checkoutBySource?: { _id: string; count: number }[];
  orderedBySource?: { _id: string; count: number }[];
  registeredBySource?: { _id: string; count: number }[];
  revenueBySource?: { _id: string; count: number }[];
}

interface Visitor {
  visitorId: string;
  sellerId: string;
  attribution: { source: string; medium: string; campaign: string; content: string; term: string; landingPage: string; referrer: string; clickIds?: Record<string, string> };
  geo: { country: string; region: string; city: string; timezone: string; ip: string; asn: string };
  device: string;
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  isBot: boolean;
  botName: string;
  firstVisit: string;
  lastVisit: string;
  totalSessions: number;
  totalPageViews: number;
  pages: string[];
  milestones: { event: string; page: string; date: string; metadata?: Record<string, unknown> }[];
  customerId: string;
  registered: boolean;
  registeredAt: string;
  ordered: boolean;
  firstOrderAt: string;
  totalOrders: number;
  totalRevenue: number;
  viewContentSent?: number;
  createdAt?: string;
  updatedAt?: string;
  daysToRegister: number;
  daysToOrder: number;
  errorLog: string[];
}

// Consistent channel palette: the same colour means the same channel on every
// tile (Google stays blue from Visitors to Revenue). Unknown sources → "other".
const CHANNEL_COLORS: Record<string, string> = {
  google: '#4285F4',
  meta: '#7c3aed', facebook: '#7c3aed', fb: '#7c3aed', instagram: '#7c3aed', ig: '#7c3aed',
  direct: '#64748b',
  bing: '#0ea5a4',
  organic: '#10b981',
};
const OTHER_COLOR = '#c3cbd6';
const channelColor = (name: string) => CHANNEL_COLORS[(name || '').toLowerCase()] || OTHER_COLOR;

// ChannelBar: a slim segmented bar (top 3 + "other") plus labelled counts, so a
// tile shows its total AND where that total came from in one glance. Collapses
// to nothing below a volume threshold rather than rendering a bar of zeros.
const ChannelBar = ({ data, topN = 3, format = (n: number) => n.toLocaleString() }: { data?: { _id: string; count: number }[]; topN?: number; format?: (n: number) => string }) => {
  const rows = (data ?? []).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  const total = rows.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const top = rows.slice(0, topN);
  const otherCount = rows.slice(topN).reduce((s, d) => s + d.count, 0);
  const segments = otherCount > 0 ? [...top, { _id: 'other', count: otherCount }] : top;
  return (
    <div className="mt-3">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map((d) => (
          <div key={d._id || 'other'} style={{ width: `${(d.count / total) * 100}%`, backgroundColor: channelColor(d._id) }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {top.map((d) => (
          <span key={d._id || 'other'} className="flex items-center gap-1 text-[11px] text-gray-500">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: channelColor(d._id) }} />
            <span className="capitalize">{d._id || 'other'}</span>
            <span className="font-semibold text-gray-700 tabular-nums">{format(d.count)}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// Money formatter for revenue-by-source chips ($3,940).
const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// StatCard: small icon + label header (icon identifies the metric without
// competing with the number), big value, optional sub + channel breakdown.
const StatCard = ({ icon: Icon, label, value, sub, breakdown, format, className = '' }: { icon: React.ElementType; label: string; value: string | number; sub?: string; breakdown?: { _id: string; count: number }[]; format?: (n: number) => string; className?: string }) => (
  <div className={`bg-white rounded-lg shadow p-4 flex flex-col ${className}`}>
    <div className="flex items-center gap-1.5 text-gray-500">
      <Icon className="h-4 w-4 text-teal-700 shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-wide truncate">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-bold text-gray-800 tabular-nums leading-none">{value}</p>
    {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    {breakdown && <ChannelBar data={breakdown} format={format} />}
  </div>
);

// FunnelArrow connects two funnel stages, carrying the step-conversion rate.
// Desktop only; on mobile the tiles stack and the arrows are hidden.
const FunnelArrow = ({ pct }: { pct?: string }) => (
  <div className="hidden lg:flex w-6 flex-none flex-col items-center justify-center text-gray-300" aria-hidden="true">
    <span className="text-lg leading-none">&rarr;</span>
    {pct && <span className="mt-0.5 text-[10px] text-gray-400 tabular-nums">{pct}</span>}
  </div>
);

const CHANNEL_LEGEND: [string, string][] = [['Google', 'google'], ['Meta / FB', 'meta'], ['Direct', 'direct'], ['Organic', 'organic'], ['Other', 'other']];
const ChannelLegend = () => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-4 p-0 list-none">
    {CHANNEL_LEGEND.map(([name, key]) => (
      <li key={key} className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: key === 'other' ? OTHER_COLOR : channelColor(key) }} />
        {name}
      </li>
    ))}
  </ul>
);

const BandLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{children}</span>
    <span className="h-px flex-1 bg-gray-200" />
  </div>
);

// step-conversion rate a/b as a display string, or undefined when b is 0.
const rate = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : undefined);



const BreakdownTable = ({ title, data, colorBy }: { title: string; data: { _id: string; count: number }[]; colorBy?: (id: string) => string }) => {
  const [expanded, setExpanded] = useState(false);
  const limit = 5;
  const visible = expanded ? data : data?.slice(0, limit);
  const hasMore = data && data.length > limit;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const max = data[0]?.count || 1;
            const pct = Math.round((item.count / max) * 100);
            return (
              <div key={item._id || 'unknown'}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item._id || 'Unknown'}</span>
                  <span className="text-gray-500">{item.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: colorBy ? colorBy(item._id) : '#0f766e' }} />
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-teal-700 hover:text-teal-800 mt-1"
            >
              {expanded ? 'Show less' : `Show all ${data.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const formatDate = (d: string) => {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatLocation = (geo: { country?: string; region?: string; city?: string }) =>
  [geo?.city, geo?.region, geo?.country].filter(Boolean).join(', ') || '-';

const Analytics: React.FC = () => {
  const { decodeJWT } = useAuth();
  const token = localStorage.getItem('accessToken');
  const user = token ? decodeJWT(token) : null;
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState<Stats | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Visitor | null>(null);
  const [scope, setScope] = useState(isAdmin ? 'portal' : '');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState('30d'); // default to Last 30 Days (was '' = all-time, which aggregates the whole visitors collection on every page load)
  const perPage = 100;

  const loadStats = async (sellerId?: string, since?: string) => {
    try {
      const data = await getVisitorStats(sellerId, since || undefined);
      setStats(data);
    } catch (err: any) {
      toast.error('Failed to load stats');
    }
  };

  const loadVisitors = async (p: number, f: Record<string, string>, sellerId?: string, since?: string) => {
    try {
      const params: Record<string, string> = { page: String(p), perPage: String(perPage) };
      if (sellerId) params.sellerId = sellerId;
      if (since) params.since = since;
      Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await getVisitors(params);
      setVisitors(data.visitors || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error('Failed to load visitors');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (isAdmin) {
        try {
          const accounts = await getAccounts();
          setCompanies(accounts.filter((a: Account) => a.role === 'company').map((a: Account) => ({ id: a._id, name: a.company?.name || a.name })));
        } catch { /* ignore */ }
      }
      await Promise.all([loadStats(scope || undefined, timeRange), loadVisitors(1, {}, scope || undefined, timeRange)]);
      setLoading(false);
    };
    init();
  }, []);

  const handleScopeChange = async (newScope: string) => {
    setScope(newScope);
    setPage(1);
    setFilters({});
    setExpandedGroups(new Set());
    setRefreshing(true);
    await Promise.all([loadStats(newScope || undefined, timeRange), loadVisitors(1, {}, newScope || undefined, timeRange)]);
    setRefreshing(false);
  };

  const handleTimeRangeChange = async (newRange: string) => {
    setTimeRange(newRange);
    setPage(1);
    setExpandedGroups(new Set());
    setRefreshing(true);
    await Promise.all([loadStats(scope || undefined, newRange), loadVisitors(1, filters, scope || undefined, newRange)]);
    setRefreshing(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(scope || undefined, timeRange), loadVisitors(page, filters, scope || undefined, timeRange)]);
    setRefreshing(false);
  };

  const handlePageChange = async (newPage: number) => {
    setPage(newPage);
    await loadVisitors(newPage, filters, scope || undefined, timeRange);
  };

  const applyFilters = async () => {
    setPage(1);
    setRefreshing(true);
    await loadVisitors(1, filters, scope || undefined, timeRange);
    setRefreshing(false);
  };

  const clearFilters = async () => {
    setFilters({});
    setPage(1);
    setRefreshing(true);
    await loadVisitors(1, {}, scope || undefined, timeRange);
    setRefreshing(false);
  };

  const totalPages = Math.ceil(total / perPage);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <div className="flex-1 flex flex-col">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-teal-700 border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Visitor Analytics</h1>
            {isAdmin && (
              <select
                value={scope}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
              >
                <option value="">All (Portal + Storefronts)</option>
                <option value="portal">Portal Only</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                disabled={refreshing}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white disabled:opacity-50"
              >
                <option value="">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              {refreshing && <ArrowPathIcon className="h-4 w-4 text-teal-700 animate-spin" />}
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-3 py-1.5 bg-teal-700 text-white text-sm rounded-lg hover:bg-teal-800 disabled:opacity-50 ml-auto">
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {stats && (
            <>
              <ChannelLegend />

              <BandLabel>Acquisition funnel</BandLabel>
              <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-3 mb-8">
                <StatCard className="flex-[1_1_45%] lg:flex-1 min-w-0" icon={UsersIcon} label="Visitors" value={stats.totalVisitors}
                  sub={`${stats.todayVisitors} today · ${stats.totalBots} bots (${stats.totalVisitors > 0 ? ((stats.totalBots / stats.totalVisitors) * 100).toFixed(1) : 0}%)`}
                  breakdown={stats.topSources} />
                <FunnelArrow pct={rate(stats.totalCartAdds, stats.totalVisitors)} />
                <StatCard className="flex-[1_1_45%] lg:flex-1 min-w-0" icon={ShoppingCartIcon} label="Cart Adds" value={stats.totalCartAdds} breakdown={stats.cartAddsBySource} />
                <FunnelArrow pct={rate(stats.totalCheckoutStarts ?? 0, stats.totalCartAdds)} />
                <StatCard className="flex-[1_1_45%] lg:flex-1 min-w-0" icon={ShoppingCartIcon} label="Checkout Started" value={stats.totalCheckoutStarts ?? 0} breakdown={stats.checkoutBySource} />
                <FunnelArrow pct={rate(stats.totalOrdered, stats.totalCheckoutStarts ?? 0)} />
                <StatCard className="flex-[1_1_45%] lg:flex-1 min-w-0" icon={UsersIcon} label="Ordered" value={stats.totalOrdered} breakdown={stats.orderedBySource} />
                <FunnelArrow />
                <StatCard className="flex-[1_1_45%] lg:flex-1 min-w-0" icon={CurrencyDollarIcon} label="Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} sub={`${stats.totalOrders} orders`} breakdown={stats.revenueBySource} format={money} />
              </div>

              <BandLabel>Diagnostics &amp; ad delivery</BandLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={GlobeAltIcon} label="Registered" value={stats.totalRegistered}
                  sub={`${stats.totalVisitors > 0 ? ((stats.totalRegistered / stats.totalVisitors) * 100).toFixed(1) : 0}% conversion`}
                  breakdown={stats.registeredBySource} />
                {isAdmin && (scope === '' || scope === 'portal') && (
                  <StatCard icon={EnvelopeIcon} label="Contacted Us" value={stats.totalContactedUs}
                    sub={stats.totalVisitors > 0 ? `${((stats.totalContactedUs / stats.totalVisitors) * 100).toFixed(1)}% of visitors` : '—'} />
                )}
                <StatCard icon={GlobeAltIcon} label="Ad Conversions Sent" value={stats.conversionsSent ?? 0}
                  sub={`${stats.conversionsFailed ?? 0} failed · ${stats.conversionsAvgMatch > 0 ? `${stats.conversionsAvgMatch.toFixed(0)} match fields` : '—'}`}
                  breakdown={stats.conversionsByProvider} />
                <StatCard icon={EyeIcon} label="Product Views Sent" value={stats.productViewsSent ?? 0} sub="ViewContent → Meta / Google" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BreakdownTable title="Top Sources" data={stats.topSources} colorBy={channelColor} />
                <BreakdownTable title="Top Countries" data={stats.topCountries} />
                <BreakdownTable title="Devices" data={stats.devices} />
                <BreakdownTable title="Browsers" data={stats.browsers} />
              </div>
            </>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-800">Visitors</h2>
                <span className="text-sm text-gray-500">{total} total</span>
              </div>
              <div className="flex items-center gap-2">
                {Object.values(filters).some(Boolean) && (
                  <button onClick={clearFilters} disabled={refreshing} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                    <XMarkIcon className="h-4 w-4" /> Clear
                  </button>
                )}
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded border">
                  <FunnelIcon className="h-4 w-4" /> Filter
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Source</label>
                  <input value={filters.source || ''} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="border rounded px-2 py-1 text-sm w-32" placeholder="e.g. google" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Country</label>
                  <input value={filters.country || ''} onChange={(e) => setFilters({ ...filters, country: e.target.value })} className="border rounded px-2 py-1 text-sm w-24" placeholder="e.g. US" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Device</label>
                  <select value={filters.device || ''} onChange={(e) => setFilters({ ...filters, device: e.target.value })} className="border rounded px-2 py-1 text-sm">
                    <option value="">All</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Type</label>
                  <select value={filters.isBot || ''} onChange={(e) => setFilters({ ...filters, isBot: e.target.value })} className="border rounded px-2 py-1 text-sm">
                    <option value="">All</option>
                    <option value="false">Humans</option>
                    <option value="true">Bots</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select
                    value={
                      filters.registered ? 'registered'
                      : filters.ordered ? 'ordered'
                      : filters.addedToCart ? 'addedToCart'
                      : filters.contactedUs ? 'contactedUs'
                      : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilters({
                        ...filters,
                        registered: v === 'registered' ? 'true' : '',
                        ordered: v === 'ordered' ? 'true' : '',
                        addedToCart: v === 'addedToCart' ? 'true' : '',
                        contactedUs: v === 'contactedUs' ? 'true' : '',
                      });
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">All</option>
                    <option value="registered">Registered</option>
                    <option value="ordered">Ordered</option>
                    <option value="addedToCart">Added to Cart</option>
                    {isAdmin && <option value="contactedUs">Contacted Us</option>}
                  </select>
                </div>
                <button onClick={applyFilters} disabled={refreshing} className="flex items-center gap-2 px-4 py-1.5 bg-teal-700 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {refreshing && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {refreshing ? 'Applying...' : 'Apply'}
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Landing Page</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Device</th>
                    <th className="px-4 py-3 font-medium">Pages</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Orders</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    <th className="px-4 py-3 font-medium">First Visit</th>
                    <th className="px-4 py-3 font-medium">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visitors.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No visitors found</td></tr>
                  ) : (
                    Object.entries(
                      visitors.reduce<Record<string, Visitor[]>>((groups, v) => {
                        const key = v.attribution?.source || 'Unknown';
                        (groups[key] = groups[key] || []).push(v);
                        return groups;
                      }, {})
                    ).map(([source, group]) => {
                      const isExpanded = expandedGroups.has(source);
                      const totalPageViews = group.reduce((s, v) => s + (v.totalPageViews || 0), 0);
                      const totalSessions = group.reduce((s, v) => s + (v.totalSessions || 0), 0);
                      const totalOrders = group.reduce((s, v) => s + (v.totalOrders || 0), 0);
                      const totalRevenue = group.reduce((s, v) => s + (v.totalRevenue || 0), 0);
                      const registered = group.filter(v => v.registered).length;
                      const ordered = group.filter(v => v.ordered).length;
                      return (
                        <React.Fragment key={source}>
                          <tr
                            className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                            onClick={() => setExpandedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(source)) { next.delete(source); } else { next.add(source); }
                              return next;
                            })}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: channelColor(source) }} />
                                <span className="font-medium text-gray-800 capitalize">{source}</span>
                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{group.length}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 text-center">
                              <span className="text-gray-800">{totalPageViews}</span>
                              <div className="text-xs text-gray-400">{totalSessions} sessions</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {ordered > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{ordered}</span>}
                                {registered > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{registered}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-800">{totalOrders}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{totalRevenue ? `$${totalRevenue.toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                          </tr>
                          {isExpanded && group.map((v) => (
                            <tr key={v.visitorId} className={`hover:bg-gray-50 cursor-pointer ${v.isBot ? 'opacity-60' : ''}`} onClick={() => setSelected(v)}>
                              <td className="px-4 py-3 pl-10">
                                <div className="text-gray-800">{v.attribution?.source || '-'}</div>
                                <div className="text-xs text-gray-400">{v.attribution?.medium || ''}{v.attribution?.campaign ? ` / ${v.attribution.campaign}` : ''}</div>
                                {v.isBot && <span className="inline-block mt-0.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 rounded">{v.botName || 'Bot'}</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate" title={v.attribution?.landingPage || ''}>
                                {v.attribution?.landingPage || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-gray-800">{formatLocation(v.geo)}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-gray-800">{v.device}</div>
                                <div className="text-xs text-gray-400">{v.browser} / {v.os}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-gray-800">{v.totalPageViews}</span>
                                <div className="text-xs text-gray-400">{v.totalSessions} sessions</div>
                              </td>
                              <td className="px-4 py-3">
                                {v.ordered ? (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Ordered</span>
                                ) : v.registered ? (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Registered</span>
                                ) : v.milestones?.some(m => m.event === 'add_to_cart') ? (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Added Cart</span>
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Visitor</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-800">{v.totalOrders || 0}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{v.totalRevenue ? `$${v.totalRevenue.toFixed(2)}` : '-'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(v.firstVisit)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(v.lastVisit)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t flex items-center justify-between">
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)} className="p-1.5 rounded border hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} className="p-1.5 rounded border hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selected && (() => {
        const contacted = (selected.milestones || []).some(m => m.event === 'contact_request') || (selected.pages || []).includes('/contact-us');
        const isLead = !selected.ordered && !selected.registered && contacted && !selected.isBot;
        const statusLabel = selected.ordered ? 'Customer' : selected.registered ? 'Registered' : isLead ? 'Lead' : selected.isBot ? (selected.botName || 'Bot') : 'Visitor';
        const clickIds = selected.attribution?.clickIds || {};
        const paidClickKey = (['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'] as const).find(k => clickIds[k]);
        const isPaid = !!paidClickKey;
        const outcome = selected.ordered ? `$${(selected.totalRevenue || 0).toFixed(2)} · ${selected.totalOrders} order${selected.totalOrders === 1 ? '' : 's'}` : isLead ? 'Contact submitted' : selected.registered ? 'Registered account' : '';
        const mediumColor: Record<string, string> = { organic: 'bg-green-100 text-green-700', social: 'bg-blue-100 text-blue-700', cpc: 'bg-purple-100 text-purple-700', llm: 'bg-orange-100 text-orange-700', bot: 'bg-yellow-100 text-yellow-700', direct: 'bg-gray-100 text-gray-600', referral: 'bg-indigo-100 text-indigo-700' };
        const mColor = mediumColor[selected.attribution?.medium] || 'bg-gray-100 text-gray-600';
        const borderColor = selected.ordered ? 'border-green-500' : selected.registered ? 'border-blue-500' : isLead ? 'border-teal-500' : selected.isBot ? 'border-yellow-500' : 'border-gray-400';

        const prettyEvent = (e: string) => ({ add_to_cart: 'Added to cart', initiate_checkout: 'Started checkout', order: 'Purchased', register: 'Registered', contact_request: 'Submitted contact form', login: 'Logged in', view_content: 'Product view', landed: 'Landed', last: 'Last seen' } as Record<string, string>)[e] || e.replace(/_/g, ' ');
        const eventDot = (e: string) => ({ landed: 'bg-blue-500', order: 'bg-green-500', register: 'bg-blue-500', add_to_cart: 'bg-orange-500', initiate_checkout: 'bg-amber-500', contact_request: 'bg-teal-600', login: 'bg-purple-500', last: 'bg-gray-300' } as Record<string, string>)[e] || 'bg-gray-400';
        const renderMeta = (metadata: Record<string, unknown>) => Object.entries(metadata).flatMap(([k, v]) => {
          if (k === 'capi' && Array.isArray(v)) {
            return (v as { provider?: string; status?: string }[]).map((r, ri) => (
              <span key={`capi${ri}`} className={`text-xs px-2 py-0.5 rounded font-medium ${r?.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r?.provider} {r?.status === 'sent' ? '✓' : '✕'}</span>
            ));
          }
          if (v === null || v === undefined || v === '') return [];
          if (k === 'items' && Array.isArray(v)) return [<span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{v.length} item{v.length === 1 ? '' : 's'}</span>];
          const money = (k === 'amount' || k === 'price') && typeof v === 'number';
          const display = money ? `$${(v as number).toFixed(2)}` : typeof v === 'object' ? JSON.stringify(v) : String(v);
          return [<span key={k} className={`text-xs px-2 py-0.5 rounded ${money ? 'bg-teal-50 text-teal-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>{money ? display : `${k}: ${display}`}</span>];
        });
        const journey: { event: string; name: string; date: string; page: string; metadata: Record<string, unknown> }[] = [
          { event: 'landed', name: 'Landed', date: selected.firstVisit, page: selected.attribution?.landingPage || '', metadata: { source: `${selected.attribution?.source || 'direct'} / ${selected.attribution?.medium || 'direct'}`, ...(selected.attribution?.campaign ? { campaign: selected.attribution.campaign } : {}), ...(selected.attribution?.content ? { content: selected.attribution.content } : {}) } },
          ...(selected.milestones || []).map(m => ({ event: m.event, name: prettyEvent(m.event), date: m.date, page: m.page || '', metadata: (m.metadata || {}) as Record<string, unknown> })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (journey.length && new Date(selected.lastVisit).getTime() > new Date(journey[journey.length - 1].date).getTime() + 1500) {
          journey.push({ event: 'last', name: 'Last seen', date: selected.lastVisit, page: '', metadata: {} });
        }

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
            <div className="bg-gray-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

              {/* Hero */}
              <div className={`bg-white rounded-t-xl p-5 border-b border-l-4 ${borderColor}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{statusLabel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${mColor}`}>{selected.attribution?.source || 'direct'} / {selected.attribution?.medium || 'direct'}</span>
                      {isPaid && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Paid · {paidClickKey}</span>}
                    </div>
                    {outcome && <p className="text-sm mt-1 font-medium text-gray-700">{outcome}</p>}
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate">{selected.sellerId ? companies.find(c => c.id === selected.sellerId)?.name || 'Storefront' : 'Portal'} · {selected.device} · {selected.browser} / {selected.os} · {formatLocation(selected.geo)}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2"><XMarkIcon className="h-5 w-5" /></button>
                </div>

                {/* Metric strip */}
                <div className="grid grid-cols-4 rounded-lg overflow-hidden border border-gray-100 divide-x divide-gray-100">
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 text-gray-500"><UsersIcon className="h-4 w-4 text-teal-700 shrink-0" /><span className="text-[11px] font-semibold uppercase tracking-wide">Sessions</span></div>
                    <p className="mt-2 text-2xl font-bold text-gray-800 tabular-nums leading-none">{selected.totalSessions}</p>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 text-gray-500"><EyeIcon className="h-4 w-4 text-teal-700 shrink-0" /><span className="text-[11px] font-semibold uppercase tracking-wide">Page Views</span></div>
                    <p className="mt-2 text-2xl font-bold text-gray-800 tabular-nums leading-none">{selected.totalPageViews}</p>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 text-gray-500">{selected.sellerId ? <ShoppingCartIcon className="h-4 w-4 text-teal-700 shrink-0" /> : <EnvelopeIcon className="h-4 w-4 text-teal-700 shrink-0" />}<span className="text-[11px] font-semibold uppercase tracking-wide">{selected.sellerId ? 'Orders' : 'Contacted'}</span></div>
                    <p className={`mt-2 text-2xl font-bold tabular-nums leading-none ${(selected.sellerId ? selected.totalOrders > 0 : contacted) ? 'text-green-600' : 'text-gray-800'}`}>{selected.sellerId ? selected.totalOrders : (contacted ? 'Yes' : 'No')}</p>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 text-gray-500">{selected.sellerId ? <CurrencyDollarIcon className="h-4 w-4 text-teal-700 shrink-0" /> : <GlobeAltIcon className="h-4 w-4 text-teal-700 shrink-0" />}<span className="text-[11px] font-semibold uppercase tracking-wide">{selected.sellerId ? 'Revenue' : 'Views→Ads'}</span></div>
                    <p className={`mt-2 text-2xl font-bold tabular-nums leading-none ${selected.sellerId ? ((selected.totalRevenue || 0) > 0 ? 'text-teal-700' : 'text-gray-800') : 'text-gray-800'}`}>{selected.sellerId ? `$${selected.totalRevenue?.toFixed(2) || '0.00'}` : (selected.viewContentSent || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Journey */}
              <div className="bg-white mx-4 mt-4 rounded-lg shadow p-4">
                <div className="flex items-center gap-3 mb-4"><span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Journey</span><span className="text-[11px] font-bold text-teal-700">· {journey.length} event{journey.length === 1 ? '' : 's'}</span><span className="h-px flex-1 bg-gray-200" /></div>
                <div className="relative pl-5 border-l-2 border-gray-200 space-y-4">
                  {journey.map((ev, i) => (
                    <div key={i} className="relative">
                      <div className={`absolute -left-[26px] top-1 w-3 h-3 rounded-full ${eventDot(ev.event)} ring-2 ring-white`} />
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{ev.name}</span>
                        <span className="text-[11px] text-gray-400 font-mono">{formatDate(ev.date)}</span>
                      </div>
                      {ev.page && <p className="text-xs text-gray-500 mt-0.5 break-all">{ev.page}</p>}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">{renderMeta(ev.metadata)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribution & click IDs */}
              <div className="bg-white mx-4 mt-3 rounded-lg shadow p-4">
                <div className="flex items-center gap-3 mb-3"><span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Attribution &amp; click IDs</span><span className="h-px flex-1 bg-gray-200" /></div>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-400">Landing</span><span className="text-gray-700 text-right break-all">{selected.attribution?.landingPage || '-'}</span>
                  {selected.attribution?.referrer && (<><span className="text-gray-400">Referrer</span><span className="text-gray-700 text-right break-all">{selected.attribution.referrer}</span></>)}
                  {selected.attribution?.campaign && (<><span className="text-gray-400">Campaign</span><span className="text-gray-700 text-right">{selected.attribution.campaign}</span></>)}
                  {selected.attribution?.content && (<><span className="text-gray-400">Content</span><span className="text-gray-700 text-right">{selected.attribution.content}</span></>)}
                  {selected.attribution?.term && (<><span className="text-gray-400">Keyword</span><span className="text-gray-700 text-right">{selected.attribution.term}</span></>)}
                  {Object.entries(clickIds).map(([k, v]) => v ? (<React.Fragment key={k}><span className="text-gray-400 uppercase">{k}</span><span className="text-indigo-600 font-mono text-xs text-right break-all">{v}</span></React.Fragment>) : null)}
                  {selected.viewContentSent ? (<><span className="text-gray-400">Views sent to ads</span><span className="text-gray-700 text-right">{selected.viewContentSent}</span></>) : null}
                </div>
              </div>

              {/* Pages set */}
              {selected.pages && selected.pages.length > 0 && (
                <div className="bg-white mx-4 mt-3 rounded-lg shadow p-4">
                  <div className="flex items-center gap-3 mb-3"><span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Pages visited ({selected.pages.length})</span><span className="h-px flex-1 bg-gray-200" /></div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.pages.map((p, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded break-all">{p}</span>)}
                  </div>
                </div>
              )}

              {/* Environment (quiet) */}
              <div className="bg-white mx-4 mt-3 rounded-lg shadow p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
                  <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">First</span>{formatDate(selected.firstVisit)}</span>
                  <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">Last</span>{formatDate(selected.lastVisit)}</span>
                  {selected.geo?.timezone && <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">TZ</span>{selected.geo.timezone}</span>}
                  {(selected.geo?.ip || selected.geo?.asn) && <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">IP/ASN</span><span className="font-mono">{selected.geo?.ip || '-'} {selected.geo?.asn ? `(${selected.geo.asn})` : ''}</span></span>}
                  {selected.screenWidth > 0 && <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">Screen</span>{selected.screenWidth}×{selected.screenHeight}</span>}
                  {selected.language && <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">Lang</span>{selected.language}</span>}
                  {selected.updatedAt && <span><span className="text-gray-400 uppercase tracking-wide mr-1.5">Updated</span>{formatDate(selected.updatedAt)}</span>}
                </div>
              </div>

              {/* Error Log */}
              {selected.errorLog && selected.errorLog.length > 0 && (
                <div className="bg-white mx-4 mt-3 rounded-lg shadow p-4">
                  <div className="flex items-center gap-3 mb-3"><span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Errors ({selected.errorLog.length})</span><span className="h-px flex-1 bg-red-100" /></div>
                  <div className="bg-red-50 rounded p-3 text-xs text-red-700 space-y-1 font-mono">
                    {selected.errorLog.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </div>
              )}

              {/* IDs Footer */}
              <div className="mx-4 mt-3 mb-4 px-4 py-3 bg-gray-200/70 rounded-lg text-[11px] text-gray-500 font-mono flex flex-wrap gap-x-6 gap-y-1">
                <span>vid: {selected.visitorId}</span>
                {selected.customerId && <span>cid: {selected.customerId}</span>}
                {selected.sellerId && <span>sid: {selected.sellerId}</span>}
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Analytics;
