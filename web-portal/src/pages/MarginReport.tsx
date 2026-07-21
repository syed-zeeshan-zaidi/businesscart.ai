import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { getProducts } from '../api';
import { Product } from '../types';
import { CARD, TH, TD, ROW_HOVER, PageHeader, Tile, Pill, Spinner } from '../components/ui';

type SortKey = 'name' | 'cost' | 'price' | 'marginDollar' | 'marginPct';

interface Row {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
  marginDollar: number;
  marginPct: number;
}

// Confidential margin report. Cost is returned by the API only to admin/company
// roles (Roadmap #40 leak fix), so buyers can never reach this page's data.
const MarginReport: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, decodeJWT } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const decoded = token ? decodeJWT(token) : null;
  const role: string = decoded?.role || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('marginPct');
  const [asc, setAsc] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (role !== 'admin' && role !== 'company') {
      toast.error('Margin report is not available for this role');
      navigate('/dashboard');
      return;
    }
    getProducts()
      .then(setProducts)
      .catch(() => toast.error('Could not load products'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, role, navigate]);

  const rows = useMemo<Row[]>(() => {
    return products
      .filter((p) => (p.cost ?? 0) > 0 && p.price > 0)
      .map((p) => {
        const cost = p.cost as number;
        const marginDollar = p.price - cost;
        return {
          id: p._id,
          name: p.name,
          sku: p.sku || '',
          cost,
          price: p.price,
          marginDollar,
          marginPct: (marginDollar / p.price) * 100,
        };
      });
  }, [products]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, asc]);

  const summary = useMemo(() => {
    const withoutCost = products.filter((p) => !(p.cost ?? 0)).length;
    const avgPct = rows.length ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length : 0;
    const belowTen = rows.filter((r) => r.marginPct < 10).length;
    return { priced: rows.length, withoutCost, avgPct, belowTen };
  }, [products, rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(key === 'name');
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (asc ? ' ↑' : ' ↓') : '');
  const marginTone = (pct: number) => (pct < 0 ? 'red' : pct < 10 ? 'amber' : 'green');

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <PageHeader
              title="Margin Report"
              subtitle="Cost, price, and gross margin per product. Confidential, visible to your team only."
            />

            {loading ? (
              <div className="flex justify-center py-20"><Spinner /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <Tile label="Products with cost" value={summary.priced} />
                  <Tile label="Avg gross margin" value={`${summary.avgPct.toFixed(1)}%`} />
                  <Tile label="Under 10% margin" value={summary.belowTen} sub={summary.belowTen ? <span className="text-amber-600">Review pricing</span> : <span className="text-green-600">All healthy</span>} />
                  <Tile label="Missing cost" value={summary.withoutCost} sub={summary.withoutCost ? <span className="text-gray-500">Set to include</span> : null} />
                </div>

                {sorted.length === 0 ? (
                  <div className={`${CARD} p-10 text-center text-gray-500`}>
                    No products have a cost set yet. Add a cost on a product to see its margin here.
                  </div>
                ) : (
                  <div className={`${CARD} overflow-x-auto`}>
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr>
                          <th className={`${TH} text-left cursor-pointer`} onClick={() => toggleSort('name')}>Product{arrow('name')}</th>
                          <th className={`${TH} text-right cursor-pointer`} onClick={() => toggleSort('cost')}>Cost{arrow('cost')}</th>
                          <th className={`${TH} text-right cursor-pointer`} onClick={() => toggleSort('price')}>Price{arrow('price')}</th>
                          <th className={`${TH} text-right cursor-pointer`} onClick={() => toggleSort('marginDollar')}>Margin ${arrow('marginDollar')}</th>
                          <th className={`${TH} text-right cursor-pointer`} onClick={() => toggleSort('marginPct')}>Margin %{arrow('marginPct')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r) => (
                          <tr key={r.id} className={ROW_HOVER}>
                            <td className={TD}>
                              <div className="font-semibold text-gray-800">{r.name}</div>
                              {r.sku && <div className="text-xs text-gray-400">{r.sku}</div>}
                            </td>
                            <td className={`${TD} text-right tabular-nums text-gray-600`}>${r.cost.toFixed(2)}</td>
                            <td className={`${TD} text-right tabular-nums text-gray-800`}>${r.price.toFixed(2)}</td>
                            <td className={`${TD} text-right tabular-nums font-semibold ${r.marginDollar < 0 ? 'text-red-600' : 'text-gray-800'}`}>${r.marginDollar.toFixed(2)}</td>
                            <td className={`${TD} text-right`}><Pill tone={marginTone(r.marginPct)}>{r.marginPct.toFixed(1)}%</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MarginReport;
