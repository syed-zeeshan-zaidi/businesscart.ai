import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { getVisitorStats, getVisitors, getAccounts } from '../api';
import { Account } from '../types';
import {
  UsersIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Stats {
  totalVisitors: number;
  totalBots: number;
  totalRegistered: number;
  totalOrdered: number;
  todayVisitors: number;
  weekVisitors: number;
  monthVisitors: number;
  topSources: { _id: string; count: number }[];
  topCountries: { _id: string; count: number }[];
  devices: { _id: string; count: number }[];
  browsers: { _id: string; count: number }[];
  totalRevenue: number;
  totalOrders: number;
}

interface Visitor {
  visitorId: string;
  sellerId: string;
  attribution: { source: string; medium: string; campaign: string; content: string; landingPage: string; referrer: string };
  geo: { country: string; region: string; city: string; timezone: string; ip: string; asn: string };
  device: string;
  os: string;
  browser: string;
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
  daysToRegister: number;
  daysToOrder: number;
  errorLog: string[];
}

const StatCard = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) => (
  <div className="bg-white p-5 rounded-lg shadow flex items-center gap-4">
    <Icon className="h-10 w-10 text-teal-700 shrink-0" />
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const BreakdownTable = ({ title, data }: { title: string; data: { _id: string; count: number }[] }) => {
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
                  <div className="bg-teal-700 h-2 rounded-full" style={{ width: `${pct}%` }} />
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
  const [timeRange, setTimeRange] = useState('');
  const perPage = 50;

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
    await loadVisitors(1, filters, scope || undefined, timeRange);
  };

  const clearFilters = async () => {
    setFilters({});
    setPage(1);
    await loadVisitors(1, {}, scope || undefined, timeRange);
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
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
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <StatCard icon={UsersIcon} label="Total Visitors" value={stats.totalVisitors} sub={`${stats.todayVisitors} today`} />
                <StatCard icon={UsersIcon} label="This Week" value={stats.weekVisitors} sub={`${stats.monthVisitors} this month`} />
                <StatCard icon={GlobeAltIcon} label="Registered" value={stats.totalRegistered} sub={`${stats.totalVisitors > 0 ? ((stats.totalRegistered / stats.totalVisitors) * 100).toFixed(1) : 0}% conversion`} />
                <StatCard icon={UsersIcon} label="Ordered" value={stats.totalOrdered} sub={`${stats.totalRegistered > 0 ? ((stats.totalOrdered / stats.totalRegistered) * 100).toFixed(1) : 0}% of registered`} />
                <StatCard icon={CurrencyDollarIcon} label="Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} sub={`${stats.totalOrders} orders`} />
                <StatCard icon={DevicePhoneMobileIcon} label="Bots" value={stats.totalBots} sub={`${stats.totalVisitors > 0 ? ((stats.totalBots / stats.totalVisitors) * 100).toFixed(1) : 0}%`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BreakdownTable title="Top Sources" data={stats.topSources} />
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
                  <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">
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
                  <select value={filters.registered ? 'registered' : filters.ordered ? 'ordered' : ''} onChange={(e) => {
                    const v = e.target.value;
                    setFilters({ ...filters, registered: v === 'registered' ? 'true' : '', ordered: v === 'ordered' ? 'true' : '' });
                  }} className="border rounded px-2 py-1 text-sm">
                    <option value="">All</option>
                    <option value="registered">Registered</option>
                    <option value="ordered">Ordered</option>
                  </select>
                </div>
                <button onClick={applyFilters} className="px-4 py-1.5 bg-teal-700 text-white text-sm rounded hover:bg-teal-800">Apply</button>
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
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
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
                                <span className="font-medium text-gray-800">{source}</span>
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
                            <td className="px-4 py-3 text-center text-gray-800">{totalOrders}</td>
                            <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{totalRevenue ? `$${totalRevenue.toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                          </tr>
                          {isExpanded && group.map((v) => (
                            <tr key={v.visitorId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(v)}>
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
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Visitor</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-800">{v.totalOrders || 0}</td>
                              <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{v.totalRevenue ? `$${v.totalRevenue.toFixed(2)}` : '-'}</td>
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

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Visitor Details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-5 text-sm">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">Visitor ID</p>
                    <p className="font-mono text-xs break-all">{selected.visitorId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Customer ID</p>
                    <p className="font-mono text-xs">{selected.customerId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Platform</p>
                    <p>{selected.sellerId ? companies.find(c => c.id === selected.sellerId)?.name || selected.sellerId : 'Portal'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p>{selected.isBot ? <span className="text-yellow-700">{selected.botName || 'Bot'}</span> : 'Human'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p>{selected.ordered ? 'Ordered' : selected.registered ? 'Registered' : 'Visitor'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Attribution</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">Source / Medium</p>
                    <p>{selected.attribution?.source || '-'} / {selected.attribution?.medium || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Campaign</p>
                    <p>{selected.attribution?.campaign || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Content</p>
                    <p>{selected.attribution?.content || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Landing Page</p>
                    <p>{selected.attribution?.landingPage || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Referrer</p>
                    <p className="break-all">{selected.attribution?.referrer || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Location & Device</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p>{formatLocation(selected.geo)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Timezone</p>
                    <p>{selected.geo?.timezone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">IP Address</p>
                    <p className="font-mono text-xs">{selected.geo?.ip || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">ASN</p>
                    <p>{selected.geo?.asn || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Device</p>
                    <p>{selected.device || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Browser / OS</p>
                    <p>{selected.browser || '-'} / {selected.os || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">First Visit</p>
                    <p>{formatDate(selected.firstVisit)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Visit</p>
                    <p>{formatDate(selected.lastVisit)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Sessions</p>
                    <p>{selected.totalSessions}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Page Views</p>
                    <p>{selected.totalPageViews}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conversion</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">Registered</p>
                    <p>{selected.registered ? formatDate(selected.registeredAt) : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Days to Register</p>
                    <p>{selected.daysToRegister !== null && selected.daysToRegister !== undefined ? selected.daysToRegister : '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">First Order</p>
                    <p>{selected.ordered ? formatDate(selected.firstOrderAt) : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Days to Order</p>
                    <p>{selected.daysToOrder !== null && selected.daysToOrder !== undefined ? selected.daysToOrder : '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Orders</p>
                    <p>{selected.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Revenue</p>
                    <p>${selected.totalRevenue?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>

              {selected.pages && selected.pages.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pages Visited ({selected.pages.length})</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.pages.map((p, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.milestones && selected.milestones.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Milestones ({selected.milestones.length})</h4>
                  <div className="space-y-2">
                    {selected.milestones.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded shrink-0">{m.event}</span>
                        <span className="text-gray-400 shrink-0">{formatDate(m.date)}</span>
                        {m.page && <span className="text-gray-500">{m.page}</span>}
                        {m.metadata && Object.keys(m.metadata).length > 0 && (
                          <span className="text-gray-400">{Object.entries(m.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.errorLog && selected.errorLog.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Error Log ({selected.errorLog.length})</h4>
                  <div className="bg-red-50 rounded p-2 text-xs text-red-700 space-y-1">
                    {selected.errorLog.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
