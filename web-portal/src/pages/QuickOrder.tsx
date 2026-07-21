import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { getProducts, getAccount, addItemToCart } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { PageHeader, CARD, BTN_PRIMARY } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { clampQty, qtyRuleLabel } from '../qtyRules';
import { Product } from '../types';
import {
  PlusIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, MagnifyingGlassIcon,
  ClockIcon, ExclamationTriangleIcon, ShoppingCartIcon,
} from '@heroicons/react/24/outline';

// Buyer-facing bulk quick-order page ("order cockpit"): a single focused input area
// with four methods (SKU autocomplete, paste, CSV, browse grid) on the left, and a
// live order panel on the right. Everything feeds one validated line list, then adds
// to cart via the existing addItemToCart (server enforces MOQ/limits + per-customer
// price). Portal-only. Products come from the shared 30-min cache the Catalog page
// writes. The "Schedule" strip is a disabled placeholder (no endpoint) per Roadmap #1.

interface Line {
  sku?: string;        // SKU / paste / CSV entries (resolved by SKU match)
  productId?: string;  // grid / autocomplete entries (pins the exact product)
  qty: number;
}
type Status = 'ok' | 'notfound' | 'ambiguous';
interface Resolved { key: string; sku?: string; qty: number; matches: Product[]; product?: Product; status: Status; }
type Method = 'sku' | 'paste' | 'csv' | 'browse';

const CACHE_KEY_PREFIX = 'user_products_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes, shared with the Catalog page

const currency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const priceOf = (p: Product) => (p.discountedPrice && p.discountedPrice > 0 && p.discountedPrice < p.price ? p.discountedPrice : p.price);
const lineKey = (l: Line) => (l.productId ? `p:${l.productId}` : `s:${(l.sku || '').toLowerCase()}`);

const buildSellerNames = (
  account: { customer?: { attachedCompanies?: { companyCodeId?: string; name: string }[] } } | null | undefined,
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const c of account?.customer?.attachedCompanies || []) {
    if (c.companyCodeId) map[c.companyCodeId] = c.name;
  }
  return map;
};

// One item per line; sku and qty separated by comma, semicolon, tab or whitespace.
// Header rows (non-numeric qty) are skipped.
const parseBulk = (text: string): Line[] => {
  const out: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[\s,;]+/).filter(Boolean);
    if (parts.length === 0) continue;
    const sku = parts[0].replace(/^"|"$/g, '').trim();
    if (!sku) continue;
    const qty = parts.length > 1 ? parseInt(parts[1].replace(/[^0-9]/g, ''), 10) : 1;
    if (isNaN(qty) || qty < 1) continue; // skip a 0/negative qty line rather than silently ordering 1
    out.push({ sku, qty });
  }
  return out;
};

const EYEBROW = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';

const QuickOrder: React.FC = () => {
  const { decodeJWT } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [method, setMethod] = useState<Method>('sku');
  const [lines, setLines] = useState<Line[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const [skuInput, setSkuInput] = useState('');
  const [qtyInput, setQtyInput] = useState(1);
  const [skuFocused, setSkuFocused] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [gridSearch, setGridSearch] = useState('');
  const [gridCats, setGridCats] = useState<Set<string>>(new Set());
  const [gridQty, setGridQty] = useState<Record<string, number>>({});

  const getCacheKey = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.user?.id;
      return userId ? `${CACHE_KEY_PREFIX}_${userId}` : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) throw new Error('Not authenticated');
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.id) throw new Error('Could not read user from token');

        const cacheKey = getCacheKey();
        if (cacheKey) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
              setProducts(parsed.products || []);
              setSellerNames(buildSellerNames(parsed.account));
              setLoading(false);
              return;
            }
          }
        }
        const [fetchedProducts, account] = await Promise.all([getProducts(), getAccount(decoded.id)]);
        setProducts(fetchedProducts);
        setSellerNames(buildSellerNames(account));
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ products: fetchedProducts, account, timestamp: Date.now() }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load quick order');
      } finally {
        setLoading(false);
      }
    })();
  }, [decodeJWT, getCacheKey]);

  const upsertLines = (items: Line[]) => {
    if (items.length === 0) return;
    setLines((prev) => {
      const map = new Map(prev.map((l) => [lineKey(l), { ...l }]));
      for (const it of items) {
        const k = lineKey(it);
        const existing = map.get(k);
        if (existing) existing.qty += it.qty;
        else map.set(k, { ...it });
      }
      return Array.from(map.values());
    });
  };

  const addSkuLine = () => {
    const sku = skuInput.trim();
    if (!sku) return;
    upsertLines([{ sku, qty: qtyInput > 0 ? qtyInput : 1 }]);
    setSkuInput('');
    setQtyInput(1);
  };

  const skuSuggestions = useMemo(() => {
    const q = skuInput.trim().toLowerCase();
    if (q.length < 3) return [];
    return products
      .filter((p) => p.active !== false && ((p.sku || '').toLowerCase().includes(q) || p.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [skuInput, products]);

  const selectSuggestion = (p: Product) => {
    upsertLines([{ productId: p._id, qty: qtyInput > 0 ? qtyInput : 1 }]);
    setSkuInput('');
    setQtyInput(1);
  };

  const addPaste = () => {
    const parsed = parseBulk(pasteText);
    if (parsed.length === 0) { toast.error('No valid "SKU quantity" lines found'); return; }
    upsertLines(parsed);
    setPasteText('');
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      const parsed = parseBulk(text);
      if (parsed.length === 0) toast.error('No valid rows found in file');
      else { upsertLines(parsed); toast.success(`Loaded ${parsed.length} row${parsed.length === 1 ? '' : 's'}`); }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const blob = new Blob(['SKU,Quantity\nEXAMPLE-SKU-1,1\nEXAMPLE-SKU-2,10\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quick-order-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const setLineQty = (key: string, qty: number) => setLines((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, qty: qty > 0 ? qty : 1 } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => lineKey(l) !== key));

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.active !== false) set.add(p.category?.trim() || 'Uncategorized');
    return Array.from(set).sort((a, b) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)));
  }, [products]);

  const gridProducts = useMemo(() => {
    const q = gridSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        if (p.active === false) return false;
        const cat = p.category?.trim() || 'Uncategorized';
        if (gridCats.size > 0 && !gridCats.has(cat)) return false;
        if (q && !(p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, gridSearch, gridCats]);

  const toggleGridCat = (cat: string) => setGridCats((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  const addGridSelections = () => {
    const items: Line[] = [];
    for (const [productId, qty] of Object.entries(gridQty)) if (qty && qty > 0) items.push({ productId, qty });
    if (items.length === 0) { toast.error('Enter a quantity on at least one product'); return; }
    upsertLines(items);
    setGridQty({});
    toast.success(`Added ${items.length} product${items.length === 1 ? '' : 's'} to your order`);
  };

  const resolved = useMemo<Resolved[]>(() => {
    return lines.map((l) => {
      const key = lineKey(l);
      if (l.productId) {
        const product = products.find((p) => p._id === l.productId);
        return { key, sku: product?.sku, qty: l.qty, matches: product ? [product] : [], product, status: product ? 'ok' : 'notfound' };
      }
      const matches = products.filter((p) => (p.sku || '').toLowerCase() === (l.sku || '').toLowerCase());
      let product: Product | undefined;
      let status: Status;
      if (matches.length === 0) status = 'notfound';
      else if (matches.length === 1) { product = matches[0]; status = 'ok'; }
      else { product = matches.find((m) => m._id === chosen[(l.sku || '').toLowerCase()]); status = product ? 'ok' : 'ambiguous'; }
      return { key, sku: l.sku, qty: l.qty, matches, product, status };
    });
  }, [lines, products, chosen]);

  const validCount = resolved.filter((r) => r.status === 'ok').length;
  const summary = useMemo(() => {
    let units = 0, subtotal = 0;
    for (const r of resolved) if (r.status === 'ok' && r.product) { units += r.qty; subtotal += priceOf(r.product) * r.qty; }
    return { units, subtotal };
  }, [resolved]);

  const handleAddAll = async () => {
    const toAdd = resolved.filter((r) => r.status === 'ok' && r.product);
    if (toAdd.length === 0) return;
    setAdding(true);
    const addedKeys: string[] = [];
    const failed: string[] = [];
    for (const r of toAdd) {
      const p = r.product as Product;
      try {
        await addItemToCart({
          entity: {
            productId: p._id, quantity: clampQty(p, r.qty), sellerId: p.sellerID, partnerId: p.partnerId,
            name: p.name, price: p.price, discountedPrice: p.discountedPrice, image: p.images?.[0], dealPrice: p.dealPrice,
          },
        });
        addedKeys.push(r.key);
      } catch (e: unknown) {
        const msg = e instanceof AxiosError ? (e.response?.data?.message || 'could not add') : 'could not add';
        failed.push(`${r.sku || p.name}: ${msg}`);
      }
    }
    setLines((prev) => prev.filter((l) => !addedKeys.includes(lineKey(l))));
    localStorage.removeItem('cart_cache');
    window.dispatchEvent(new Event('cartUpdated'));
    setAdding(false);
    if (failed.length === 0) toast.success(`Added ${addedKeys.length} item${addedKeys.length === 1 ? '' : 's'} to cart`);
    else toast.error(`Added ${addedKeys.length}, ${failed.length} could not be added`);
  };

  const tabs: { id: Method; label: string }[] = [
    { id: 'sku', label: 'By SKU' },
    { id: 'paste', label: 'Paste list' },
    { id: 'csv', label: 'Upload CSV' },
    { id: 'browse', label: 'Browse' },
  ];

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        <PageHeader title="Build a large order" subtitle="Add items by SKU, paste a list, upload a CSV, or browse your catalog. Everything collects on the right." />

        {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {loading && <p className="text-gray-500">Loading your catalog...</p>}

        {!loading && !error && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
            {/* Left: method switcher + focused input */}
            <section>
              <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
                {tabs.map((t) => (
                  <button key={t.id} onClick={() => setMethod(t.id)}
                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${method === t.id ? 'bg-teal-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className={`${CARD} p-5`}>
                {method === 'sku' && (
                  <div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <label className="mb-1 block text-xs font-medium text-gray-500">SKU or product name</label>
                        <input value={skuInput}
                          onChange={(e) => setSkuInput(e.target.value)}
                          onFocus={() => setSkuFocused(true)}
                          onBlur={() => setTimeout(() => setSkuFocused(false), 150)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addSkuLine(); }}
                          className={inputClass} placeholder="Start typing, e.g. WG-100" autoFocus />
                        {skuFocused && skuInput.trim().length >= 3 && skuSuggestions.length > 0 && (
                          <ul className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                            {skuSuggestions.map((p) => (
                              <li key={p._id}>
                                <button type="button" onMouseDown={(e) => { e.preventDefault(); selectSuggestion(p); }}
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-teal-50">
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-gray-900">{p.name}</span>
                                    {p.sku && <span className="font-mono text-[11px] text-gray-500">{p.sku}</span>}
                                  </span>
                                  <span className="shrink-0 text-xs font-medium text-gray-500">{currency(priceOf(p))}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="w-20">
                        <label className="mb-1 block text-xs font-medium text-gray-500">Qty</label>
                        <input type="number" min={1} value={qtyInput} onChange={(e) => setQtyInput(parseInt(e.target.value, 10) || 1)} className={inputClass} />
                      </div>
                      <button onClick={addSkuLine} className="rounded-md bg-teal-700 p-2.5 text-white hover:bg-teal-800" aria-label="Add to order"><PlusIcon className="h-5 w-5" /></button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">Type 3+ characters to search your catalog, or enter a full SKU and press Enter.</p>
                  </div>
                )}

                {method === 'paste' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Paste one item per line</label>
                    <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6}
                      className={`${inputClass} font-mono`} placeholder={'WG-100, 5\nWG-200 10\nGL-9;2'} />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Separate SKU and quantity with a comma, space, or semicolon.</span>
                      <button onClick={addPaste} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Add to order</button>
                    </div>
                  </div>
                )}

                {method === 'csv' && (
                  <div className="text-center py-4">
                    <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
                    <button onClick={() => fileRef.current?.click()}
                      className="mx-auto flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-8 text-gray-500 hover:border-teal-400 hover:text-teal-700">
                      <ArrowUpTrayIcon className="h-7 w-7" />
                      <span className="text-sm font-medium">Choose a CSV file</span>
                      <span className="text-xs text-gray-400">Columns: SKU, Quantity</span>
                    </button>
                    <button onClick={downloadTemplate} className="mx-auto mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                      <ArrowDownTrayIcon className="h-4 w-4" /> Download template
                    </button>
                  </div>
                )}

                {method === 'browse' && (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[180px]">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input value={gridSearch} onChange={(e) => setGridSearch(e.target.value)} placeholder="Search name or SKU" className={`${inputClass} pl-9`} />
                      </div>
                      <span className="text-xs text-gray-400">{gridProducts.length} shown</span>
                      <button onClick={addGridSelections} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Add to order</button>
                    </div>
                    {allCategories.length > 1 && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-xs text-gray-400">{gridCats.size === 0 ? 'All categories' : 'Showing:'}</span>
                        {allCategories.map((cat) => {
                          const on = gridCats.has(cat);
                          return (
                            <button key={cat} onClick={() => toggleGridCat(cat)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}>
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="max-h-[24rem] overflow-y-auto rounded-md border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Product</th>
                            <th className="px-3 py-2 font-semibold">SKU</th>
                            <th className="px-3 py-2 text-right font-semibold">Price</th>
                            <th className="px-3 py-2 text-right font-semibold w-20">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gridProducts.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No products match.</td></tr>
                          ) : gridProducts.map((p) => (
                            <tr key={p._id} className="border-t border-gray-100">
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-900">{p.name}</p>
                                {sellerNames[p.sellerID] && <p className="text-xs text-gray-400">{sellerNames[p.sellerID]}</p>}
                                {qtyRuleLabel(p) && <p className="text-xs text-teal-700">{qtyRuleLabel(p)}</p>}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.sku || '-'}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap text-gray-900">{currency(priceOf(p))}</td>
                              <td className="px-3 py-2 text-right">
                                <input type="number" min={0} value={gridQty[p._id] ?? ''} placeholder="0"
                                  onChange={(e) => { const v = parseInt(e.target.value, 10); setGridQty((prev) => ({ ...prev, [p._id]: isNaN(v) ? 0 : v })); }}
                                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-right" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule placeholder (no backend yet) */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3" title="Coming soon">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Repeat this order on a schedule</p>
                  <p className="text-xs text-gray-400">Set a standing order that reorders automatically. Not available yet.</p>
                </div>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Coming soon</span>
                <button disabled className="cursor-not-allowed rounded-md bg-gray-300 px-3 py-1.5 text-sm font-semibold text-white">Schedule</button>
              </div>
            </section>

            {/* Right: live order panel */}
            <aside className={`${CARD} lg:sticky lg:top-6`}>
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className={EYEBROW}>Your order</p>
                  {resolved.length > 0 && <button onClick={() => { setLines([]); setChosen({}); }} className="text-xs text-gray-400 hover:text-gray-700">Clear</button>}
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{currency(summary.subtotal)}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {resolved.length} line{resolved.length === 1 ? '' : 's'} · <span className="font-mono">{summary.units}</span> unit{summary.units === 1 ? '' : 's'} · estimated
                </p>
              </div>

              <div className="max-h-[26rem] divide-y divide-gray-100 overflow-y-auto">
                {resolved.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <ShoppingCartIcon className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">Your order is empty.</p>
                    <p className="text-xs text-gray-400">Add items on the left and they collect here.</p>
                  </div>
                ) : resolved.map((r) => (
                  <div key={r.key} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {r.sku && <p className="font-mono text-[11px] text-gray-400">{r.sku}</p>}
                        {r.status === 'ok' && r.product && (
                          <>
                            <p className="truncate text-sm font-medium text-gray-900">{r.product.name}</p>
                            {sellerNames[r.product.sellerID] && <p className="truncate text-xs text-gray-400">{sellerNames[r.product.sellerID]}</p>}
                          </>
                        )}
                        {r.status === 'notfound' && <p className="flex items-center gap-1 text-sm text-red-600"><ExclamationTriangleIcon className="h-4 w-4 shrink-0" /> Not in your catalog</p>}
                        {r.status === 'ambiguous' && (
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-sm text-amber-600"><ExclamationTriangleIcon className="h-4 w-4 shrink-0" /> {r.matches.length} matches</p>
                            <select value={chosen[(r.sku || '').toLowerCase()] || ''} onChange={(e) => setChosen((prev) => ({ ...prev, [(r.sku || '').toLowerCase()]: e.target.value }))}
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs">
                              <option value="">Pick one...</option>
                              {r.matches.map((m) => (<option key={m._id} value={m._id}>{m.name}{sellerNames[m.sellerID] ? ` (${sellerNames[m.sellerID]})` : ''}</option>))}
                            </select>
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeLine(r.key)} className="shrink-0 text-gray-300 hover:text-red-600" aria-label="Remove"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <input type="number" min={1} value={r.qty} onChange={(e) => setLineQty(r.key, parseInt(e.target.value, 10) || 1)}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-right" />
                      <span className="text-sm font-medium text-gray-700">{r.product ? currency(priceOf(r.product) * r.qty) : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 px-5 py-4">
                <button onClick={handleAddAll} disabled={adding || validCount === 0}
                  className={`${BTN_PRIMARY} flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}>
                  {adding ? 'Adding...' : `Add ${validCount} item${validCount === 1 ? '' : 's'} to cart`}
                </button>
                <button onClick={() => navigate('/cart')} className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                  <ShoppingCartIcon className="h-4 w-4" /> View cart
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default QuickOrder;
