import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from './Navbar';
import { useAuth } from '../hooks/useAuth';
import { getProducts, getOrders, getAccounts } from '../api';
import { Account, Order } from '../types';
import { computeTier, TierInfo } from '../tier';
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  UsersIcon,
  CubeIcon,
  BuildingOffice2Icon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  name?: string;
  role: 'customer' | 'company' | 'admin';
  email: string;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return Promise.resolve(data as T);
      }
    } catch { /* corrupted cache — refetch */ }
  }
  return fetcher().then(data => {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  });
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, customers: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [lowStock, setLowStock] = useState<{ name: string; stock: number; id: string }[]>([]);
  const [companyStats, setCompanyStats] = useState<{ name: string; products: number; orders: number; revenue: number; customers: number }[]>([]);
  const [adminStats, setAdminStats] = useState({ companies: 0, newSignups: 0 });
  const [tier, setTier] = useState<TierInfo | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setUser(null); return; }
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.user) setUser(payload.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load user';
      toast.error(msg);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!user || !['company', 'admin'].includes(user.role)) return;

    const load = async () => {
      setLoading(true);
      try {
        const [products, orders, accounts] = await Promise.all([
          cached('dash_products', getProducts),
          cached('dash_orders', () => getOrders()),
          cached('dash_accounts', getAccounts),
        ]);

        const revenue = (orders as Order[]).reduce((sum: number, o: Order) => sum + (o.grandTotal || 0), 0);
        const customerCount = user.role === 'admin'
          ? (accounts as Account[]).filter((a: Account) => ['customer', 'b2c'].includes(a.role)).length
          : (accounts as Account[]).filter((a: Account) => a.role === 'customer').length;

        const orderList = (orders as Order[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentOrders(orderList.slice(0, 5));

        // Compute current pricing tier from this month's non-cancelled orders.
        // Tier is derived, never stored on the company — see exclude/APPLICATION.md.
        if (user.role === 'company') {
          setTier(computeTier(orderList));
        }

        // Monthly revenue (last 6 months)
        const months: Record<string, { revenue: number; orders: number }> = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          months[key] = { revenue: 0, orders: 0 };
        }
        orderList.forEach(o => {
          const d = new Date(o.createdAt);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (months[key]) {
            months[key].revenue += o.grandTotal || 0;
            months[key].orders += 1;
          }
        });
        setMonthlyRevenue(Object.entries(months).map(([key, val]) => {
          const [, m] = key.split('-');
          return { month: monthNames[parseInt(m)], ...val };
        }));

        // Low stock products (stock <= 5, non-zero)
        const productList = products as { name: string; stock: number; _id: string }[];
        setLowStock(productList.filter(p => p.stock > 0 && p.stock <= 5).map(p => ({ name: p.name, stock: p.stock, id: p._id })));

        setStats({
          products: productList.length,
          orders: orderList.length,
          revenue,
          customers: customerCount,
        });

        // Admin-only: company performance breakdown
        if (user.role === 'admin') {
          const accountList = accounts as Account[];
          const companies = accountList.filter(a => a.role === 'company');

          // Count signups this month
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const newSignups = accountList.filter(a => {
            const created = (a as unknown as { createdAt: string }).createdAt;
            return created && new Date(created) >= monthStart;
          }).length;

          setAdminStats({ companies: companies.length, newSignups });

          // Per-company breakdown
          const companyMap: Record<string, { name: string; products: number; orders: number; revenue: number; customers: number }> = {};
          companies.forEach(c => {
            companyMap[c._id] = { name: c.company?.name || c.name, products: 0, orders: 0, revenue: 0, customers: 0 };
          });

          productList.forEach(p => {
            const sid = (p as unknown as { sellerID: string }).sellerID;
            if (companyMap[sid]) companyMap[sid].products++;
          });

          orderList.forEach(o => {
            if (companyMap[o.sellerId]) {
              companyMap[o.sellerId].orders++;
              companyMap[o.sellerId].revenue += o.grandTotal || 0;
            }
          });

          // Count customers per company (from attachedCompanies)
          accountList.filter(a => a.role === 'customer').forEach(cust => {
            const attached = (cust as unknown as { attachedCompanies?: { companyId: string }[] }).attachedCompanies;
            if (attached) {
              attached.forEach(ac => {
                if (companyMap[ac.companyId]) companyMap[ac.companyId].customers++;
              });
            }
          });

          setCompanyStats(Object.values(companyMap).sort((a, b) => b.revenue - a.revenue));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const StatCard = ({ icon: Icon, label, value, prefix }: { icon: React.ElementType; label: string; value: number; prefix?: string }) => (
    <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
      <Icon className="h-10 w-10 text-teal-700 shrink-0" />
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        {loading ? (
          <div className="animate-spin h-6 w-6 border-2 border-teal-700 border-t-transparent rounded-full mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-800">{prefix}{prefix === '$' ? Math.round(value).toLocaleString('en-US') : value.toLocaleString('en-US')}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              {user ? `Welcome, ${user.name || user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : 'Welcome to your Dashboard'}
            </h1>
            <p className="text-gray-500 mt-1">Here's what's happening with your business.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {user?.role === 'company' && (
                <>
                  <button onClick={() => navigate('/products')} className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800">Add Product</button>
                  <button onClick={() => navigate('/orders')} className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">View Orders</button>
                  <button onClick={() => navigate('/companies')} className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">Storefront Settings</button>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <button onClick={() => navigate('/codes')} className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800">Manage Codes</button>
                  <button onClick={() => navigate('/orders')} className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">View Orders</button>
                  <button onClick={() => navigate('/analytics')} className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">Analytics</button>
                </>
              )}
            </div>
          </div>

          {/* Pricing Tier — company role only. Auto-derived from this month's order count. */}
          {user?.role === 'company' && tier && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Pricing Tier</h2>
                <span className="text-xs text-gray-500">
                  {tier.monthOrderCount} order{tier.monthOrderCount !== 1 ? 's' : ''} this month
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-4">
                <p className="text-3xl font-extrabold text-teal-700">{tier.tier}</p>
                <p className="text-sm text-gray-600">
                  {tier.perOrderCap !== null
                    ? `$${tier.monthlyFee}/mo + ${(tier.perOrderRate * 100).toFixed(2)}% per order, capped at $${tier.perOrderCap}`
                    : `$${tier.monthlyFee.toLocaleString('en-US')}/mo + ${(tier.perOrderRate * 100).toFixed(2)}% per order`}
                </p>
              </div>
              {tier.nextTierThreshold !== null ? (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div
                      className="bg-teal-700 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (tier.monthOrderCount / tier.nextTierThreshold) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {tier.ordersToNextTier} more order{tier.ordersToNextTier !== 1 ? 's' : ''} this month → graduate to {tier.nextTierName}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">Top tier — no further graduation.</p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm text-gray-600">Estimated bill this month</span>
                <span className="text-2xl font-bold text-gray-800">${tier.estimatedBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-2 ${user?.role === 'admin' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-4 mb-6`}>
            <StatCard icon={CurrencyDollarIcon} label="Total Revenue" value={stats.revenue} prefix="$" />
            <StatCard icon={ShoppingCartIcon} label="Total Orders" value={stats.orders} />
            <StatCard icon={CubeIcon} label="Products" value={stats.products} />
            <StatCard icon={UsersIcon} label="Customers" value={stats.customers} />
            {user?.role === 'admin' && (
              <>
                <StatCard icon={BuildingOffice2Icon} label="Companies" value={adminStats.companies} />
                <StatCard icon={UserPlusIcon} label="New This Month" value={adminStats.newSignups} />
              </>
            )}
          </div>

          {/* Revenue Chart + Low Stock */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Revenue Chart */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue (Last 6 Months)</h3>
                {monthlyRevenue.length > 0 && (() => {
                  const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1);
                  return (
                    <div className="flex items-end gap-3 h-48">
                      {monthlyRevenue.map((m) => (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500 font-medium">${m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(1)}k` : m.revenue.toFixed(0)}</span>
                          <div className="w-full rounded-t-lg bg-teal-700 transition-all" style={{ height: `${Math.max((m.revenue / maxRev) * 100, 2)}%`, minHeight: '4px' }} />
                          <span className="text-xs text-gray-400">{m.month}</span>
                          <span className="text-[10px] text-gray-400">{m.orders} order{m.orders !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Low Stock Alerts */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Low Stock Alerts</h3>
                {lowStock.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2 text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <p className="text-sm font-medium text-green-600">All stocked up</p>
                    <p className="text-xs">No products below 5 units</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {lowStock.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate mr-2">{p.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${p.stock <= 2 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.stock} left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-teal-700 border-t-transparent rounded-full" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No orders yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3 text-gray-800">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">${order.grandTotal?.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{order.status || 'pending'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Admin: Company Performance */}
          {user?.role === 'admin' && !loading && companyStats.length > 0 && (
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Company Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium text-center">Products</th>
                      <th className="px-4 py-3 font-medium text-center">Customers</th>
                      <th className="px-4 py-3 font-medium text-center">Orders</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {companyStats.map((c) => (
                      <tr key={c.name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.products}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.customers}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.orders}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">${Math.round(c.revenue).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default Dashboard;
