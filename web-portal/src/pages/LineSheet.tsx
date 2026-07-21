import React, { useEffect, useMemo, useState } from 'react';
import { getProducts, getAccount, getAccounts } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types';
import { PrinterIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// Read-only, print-optimized wholesale line sheet. Reuses existing catalog/account
// API calls only (no backend changes). The buyer/rep exports via the browser's
// "Save as PDF". Sellers (company + admin roles) generate line sheets and can
// curate a subset (search / category / per-product) so a sheet does not have to
// carry the entire catalog. All curation controls are screen-only (hidden in print).

interface CompanyOpt {
  id: string;
  name: string;
  logoUrl?: string;
}

const currency = (n: number) => `$${n.toFixed(2)}`;

const LineSheet: React.FC = () => {
  const { decodeJWT } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [selfCompany, setSelfCompany] = useState<CompanyOpt | null>(null);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Display options.
  const [showImages, setShowImages] = useState(true);
  const [showQtyCol, setShowQtyCol] = useState(true);

  // Curation (default empty = whole catalog; excluding narrows the sheet).
  const [search, setSearch] = useState('');
  const [includedCats, setIncludedCats] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) throw new Error('Not authenticated');
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.id) throw new Error('Could not read user from token');

        const [fetchedProducts, account] = await Promise.all([
          getProducts(),
          getAccount(decoded.id),
        ]);
        setProducts(fetchedProducts);
        setRole(account.role);

        if (account.role === 'company') {
          setSelfCompany({
            id: account._id,
            name: account.company?.name || account.name,
            logoUrl: account.company?.logoUrl,
          });
        } else if (account.role === 'admin') {
          const accounts = await getAccounts();
          const opts = accounts
            .filter((a) => a.role === 'company')
            .map((a) => ({ id: a._id, name: a.company?.name || a.name, logoUrl: a.company?.logoUrl }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setCompanies(opts);
          if (opts.length > 0) setCompanyId(opts[0].id);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load line sheet');
      } finally {
        setLoading(false);
      }
    })();
  }, [decodeJWT]);

  const activeCompany = useMemo<CompanyOpt | null>(() => {
    if (role === 'company') return selfCompany;
    return companies.find((c) => c.id === companyId) || null;
  }, [role, selfCompany, companies, companyId]);

  // Company role is already scoped by the API; admin filters the pooled result by sellerID.
  const sheetProducts = useMemo(() => {
    const scoped = role === 'admin' && companyId
      ? products.filter((p) => p.sellerID === companyId)
      : products;
    return scoped.filter((p) => p.active !== false);
  }, [products, role, companyId]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of sheetProducts) set.add(p.category?.trim() || 'Uncategorized');
    return Array.from(set).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [sheetProducts]);

  // The curated set that actually prints.
  const included = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sheetProducts.filter((p) => {
      if (excludedIds.has(p._id)) return false;
      const cat = p.category?.trim() || 'Uncategorized';
      if (includedCats.size > 0 && !includedCats.has(cat)) return false;
      if (q && !(p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [sheetProducts, excludedIds, includedCats, search]);

  // Group the curated set by category, deterministic ordering (Uncategorized last).
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of included) {
      const key = p.category?.trim() || 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const cats = Array.from(map.keys()).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
    return cats.map((cat) => ({
      category: cat,
      items: map.get(cat)!.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [included]);

  const toggleCat = (cat: string) => {
    setIncludedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleId = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetCuration = () => {
    setSearch('');
    setIncludedCats(new Set());
    setExcludedIds(new Set());
  };

  const deselectAll = () => setExcludedIds(new Set(sheetProducts.map((p) => p._id)));

  // Admin switching company: clear stale curation so it does not leak across companies.
  const onCompanyChange = (id: string) => {
    setCompanyId(id);
    resetCuration();
  };

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const curated = included.length !== sheetProducts.length;

  if (role && role !== 'company' && role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-gray-600 text-center">Line sheets are available to company and admin accounts.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col line-sheet-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .line-sheet-root { background: #fff !important; }
          .ls-row { break-inside: avoid; page-break-inside: avoid; }
          .ls-cat { break-inside: avoid; page-break-after: avoid; }
          .ls-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print"><Navbar /></div>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="no-print mb-4 flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Line Sheet</h1>
            <p className="text-sm text-gray-500">Printable wholesale catalog. Curate a subset, then use your browser&apos;s &quot;Save as PDF&quot; to export.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {role === 'admin' && (
              <select
                value={companyId}
                onChange={(e) => onCompanyChange(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
              >
                {companies.length === 0 && <option value="">No companies</option>}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={showImages} onChange={(e) => setShowImages(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Images
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={showQtyCol} onChange={(e) => setShowQtyCol(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Order column
            </label>
            <button
              onClick={() => window.print()}
              disabled={loading || included.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PrinterIcon className="h-5 w-5" /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* Curation controls (screen-only) */}
        {!loading && !error && sheetProducts.length > 0 && (
          <div className="no-print mb-6 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by product name or SKU"
                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
              <span className="text-sm text-gray-500">
                {included.length} of {sheetProducts.length} shown{curated ? ' (curated)' : ''}
              </span>
              <button onClick={deselectAll} className="text-sm font-medium text-gray-600 hover:text-gray-900">Clear all</button>
              <button onClick={resetCuration} className="text-sm font-medium text-teal-700 hover:text-teal-900">Reset</button>
            </div>

            {allCategories.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">
                  {includedCats.size === 0 ? 'All categories' : 'Showing:'}
                </span>
                {allCategories.map((cat) => {
                  const on = includedCats.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && <p className="text-gray-500">Loading catalog...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="ls-sheet bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                {activeCompany?.logoUrl && (
                  <img src={activeCompany.logoUrl} alt={activeCompany.name} className="h-12 w-12 rounded-full object-cover" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{activeCompany?.name || 'Catalog'}</h2>
                  <p className="text-[11px] uppercase tracking-widest text-gray-500">Wholesale Line Sheet</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{today}</p>
                <p>{included.length} product{included.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            {included.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">
                {sheetProducts.length === 0 ? 'No active products to list.' : 'No products match the current selection.'}
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.category} className="mb-6">
                  <h3 className="ls-cat text-sm font-bold uppercase tracking-wide text-teal-700 border-b border-gray-100 pb-1 mb-2">{group.category}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs">
                        <th className="no-print py-1 pr-2 w-6"></th>
                        {showImages && <th className="py-1 pr-2 w-14"></th>}
                        <th className="py-1 pr-2">Product</th>
                        <th className="py-1 pr-2">SKU</th>
                        <th className="py-1 pr-2 text-right">Price</th>
                        <th className="py-1 pr-2">Quantity breaks</th>
                        {showQtyCol && <th className="py-1 pl-2 text-right w-20">Order Qty</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((p) => {
                        const deal = p.discountedPrice && p.discountedPrice > 0 && p.discountedPrice < p.price ? p.discountedPrice : null;
                        return (
                          <tr key={p._id} className="ls-row border-t border-gray-100 align-top">
                            <td className="no-print py-2 pr-2">
                              <input
                                type="checkbox"
                                checked={!excludedIds.has(p._id)}
                                onChange={() => toggleId(p._id)}
                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                aria-label={`Include ${p.name}`}
                              />
                            </td>
                            {showImages && (
                              <td className="py-2 pr-2">
                                {p.images?.[0]
                                  ? <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded object-cover" />
                                  : <div className="h-10 w-10 rounded bg-gray-100" />}
                              </td>
                            )}
                            <td className="py-2 pr-2 font-medium text-gray-900">{p.name}</td>
                            <td className="py-2 pr-2 text-gray-600">{p.sku || '-'}</td>
                            <td className="py-2 pr-2 text-right text-gray-900 whitespace-nowrap">
                              {deal ? (
                                <><span className="line-through text-gray-400 mr-1">{currency(p.price)}</span>{currency(deal)}</>
                              ) : currency(p.price)}
                            </td>
                            <td className="py-2 pr-2 text-gray-600">
                              {p.priceTiers && p.priceTiers.length > 0
                                ? p.priceTiers.slice().sort((a, b) => a.minQty - b.minQty).map((t) => `${t.minQty}+: ${currency(t.price)}`).join('   ')
                                : '-'}
                            </td>
                            {showQtyCol && (
                              <td className="py-2 pl-2">
                                <div className="ml-auto h-6 w-16 border-b border-gray-300" />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}

            <div className="border-t border-gray-200 mt-6 pt-3 text-xs text-gray-400 flex justify-between gap-4">
              <span>Prices subject to change. Contact your account manager to place an order.</span>
              <span>{activeCompany?.name}</span>
            </div>
          </div>
        )}
      </main>

      <div className="no-print"><Footer /></div>
    </div>
  );
};

export default LineSheet;
