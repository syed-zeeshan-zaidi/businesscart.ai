import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Cart as CartType, CartItem, Account, Product } from '../types';
import { getCart, updateCartItem, removeItemFromCart, clearCart, createQuote, getAccount, getCustomerConfigurations, getProducts } from '../api';
import { ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { PageHeader, CARD, BTN_PRIMARY, BTN_SECONDARY, Spinner } from '../components/ui';

const CACHE_KEY_PREFIX = 'cart_cache_';

const Cart: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string, logoUrl?: string, quotesAllowed?: boolean}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});

  const invalidateCache = (companyId: string) => {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${companyId}`);
  };

  const fetchCart = useCallback(async (companyId: string) => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const fetchedCart = await getCart(companyId);
      setCart(fetchedCart);
      localStorage.setItem(`${CACHE_KEY_PREFIX}${companyId}`, JSON.stringify({ 
        data: fetchedCart, 
        timestamp: Date.now() 
      }));
    } catch (err: any) {
      setCart(null);
      invalidateCache(companyId);
      toast.error(err.response?.data?.message || `Failed to load cart for company ${companyId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    const decodedUser = decodeJWT(token);
    if (!decodedUser || decodedUser.role !== 'customer') {
      toast.error('Access denied. Only customers can view their cart.');
      navigate('/home');
      return;
    }

    const loadCompanies = async () => {
      try {
        const accountData = await getAccount(decodedUser.id);
        setAccount(accountData);
        
        if (accountData.customer?.attachedCompanies && accountData.customer.attachedCompanies.length > 0) {
          const companies = accountData.customer.attachedCompanies.map(company => ({
            id: company.companyCodeId || company._id || company.companyCode,
            name: company.name,
            companyCode: company.companyCode,
            logoUrl: company.logoUrl, // Include logoUrl
            quotesAllowed: company.quotesAllowed,
          }));
          
          setAvailableCompanies(companies);
          
          if (companies.length > 0) {
            setSelectedCompanyId(companies[0].id);
          }
        } else {
          toast.error('No companies available for shopping');
        }

        // Fetch products for tier pricing lookup
        const prods = await getProducts();
        if (Array.isArray(prods)) {
          const map: Record<string, Product> = {};
          prods.forEach((p: Product) => { map[p._id] = p; });
          setProductMap(map);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load data');
      } finally {
        setInitialLoadComplete(true);
      }
    };

    loadCompanies();
  }, [isAuthenticated, navigate, decodeJWT]);

  useEffect(() => {
    if (selectedCompanyId && initialLoadComplete) {
      fetchCart(selectedCompanyId);
    }
  }, [selectedCompanyId, initialLoadComplete, fetchCart]);

  const resolveTierPrice = (productId: string, quantity: number): { price: number; discountedPrice: number } | null => {
    const product = productMap[productId];
    if (!product) return null;

    // Layer 1: base price → tier price based on quantity
    let effectivePrice = product.price;
    if (product.priceTiers && product.priceTiers.length > 0) {
      for (const tier of product.priceTiers) {
        if (quantity >= tier.minQty) effectivePrice = tier.price;
      }
    }

    // Layer 2: dealPrice (universal product promo, applies to everyone)
    // Layer 3: customer/group discount (catalog API computes discountedPrice with priority:
    //          legacy override > group's groupPriceDiscount > none).
    //          We apply the same discount ratio to the tier price.
    let discounted = effectivePrice;
    if (product.dealPrice) {
      discounted = effectivePrice * (1 - product.dealPrice / 100);
    } else if (product.discountedPrice && product.discountedPrice < product.price) {
      const ratio = product.discountedPrice / product.price;
      discounted = effectivePrice * ratio;
    }
    return { price: effectivePrice, discountedPrice: discounted };
  };

  // Commits a single quantity change to the backend (one request). Returns success
  // so the caller can clear the local draft only when the update actually landed.
  const handleUpdateQuantity = async (itemId: string, quantity: number): Promise<boolean> => {
    if (!selectedCompanyId || quantity < 1) return false;

    // Resolve tier price for the new quantity
    const item = cart?.items.find(i => i.id === itemId);
    const tierPrices = item ? resolveTierPrice(item.productId, quantity) : null;
    const entity: { quantity: number; price?: number; discountedPrice?: number } = { quantity };
    if (tierPrices) {
      entity.price = tierPrices.price;
      entity.discountedPrice = tierPrices.discountedPrice;
    }

    setLoading(true);
    try {
      const updatedCart = await updateCartItem(itemId, { entity }, selectedCompanyId);
      setCart(updatedCart);
      invalidateCache(selectedCompanyId);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update item quantity');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Local-only quantity edit (no network). +/- and typing both feed this draft.
  const setDraft = (itemId: string, value: number) => {
    setQtyDraft((prev) => ({ ...prev, [itemId]: Math.max(1, isNaN(value) ? 1 : value) }));
  };

  // Commit the draft for one line, then clear it only on success.
  const commitQty = async (itemId: string) => {
    const draft = qtyDraft[itemId];
    if (draft === undefined) return;
    const ok = await handleUpdateQuantity(itemId, draft);
    if (ok) setQtyDraft((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedCompanyId) return;
    
    setLoading(true);
    try {
      const updatedCart = await removeItemFromCart(itemId, selectedCompanyId);
      setCart(updatedCart);
      toast.success('Item removed from cart!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = async () => {
    if (!selectedCompanyId) return;
    
    setLoading(true);
    try {
      const clearedCart = await clearCart(selectedCompanyId);
      setCart(clearedCart);
      toast.success('Cart cleared!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  const buildQuoteRequest = async (quoteType: 'standard' | 'negotiable') => {
    const company = account?.customer?.attachedCompanies?.find(c => c.companyCodeId === selectedCompanyId);
    const configurations = await getCustomerConfigurations();
    return {
      sellerId: selectedCompanyId!,
      quotesAllowed: company?.quotesAllowed || false,
      paymentMethods: company?.paymentMethods || [],
      deliveryMethods: company?.deliveryMethods || [],
      shippingOutOptions: company?.shippingOutOptions || [],
      companyLocations: company?.companyLocations || [],
      customerAddresses: account?.customer?.customerAddresses || [],
      configurations,
      quoteType,
      ...(quoteType === 'negotiable' && { status: 'draft' as const }),
      creditLimit: company?.creditLimit || 0,
      minOrderAmountLimit: company?.minOrderAmountLimit || 0,
      maxOrderAmountLimit: company?.maxOrderAmountLimit || 0,
      minOrderQuantityLimit: company?.minOrderQuantityLimit || 0,
      maxOrderQuantityLimit: company?.maxOrderQuantityLimit || 0,
      monthlyOrderLimit: company?.monthlyOrderLimit || 0,
      yearlyOrderLimit: company?.yearlyOrderLimit || 0,
      taxableGoods: company?.taxableGoods ?? true,
      taxRate: company?.taxRate || 0,
      shippingRate: company?.shippingRate || 0,
      leadTime: company?.leadTime || 0,
    };
  };

  const handleCheckout = async () => {
    if (!selectedCompanyId) { toast.error('Please select a company to checkout.'); return; }
    if (!cart || cart.items.length === 0) { toast.error('Your cart is empty.'); return; }

    setLoading(true);
    const toastId = toast.loading('Creating quote...');
    try {
      const quote = await createQuote(await buildQuoteRequest('standard'));
      toast.success('Proceeding to checkout!', { id: toastId });
      navigate(`/checkout/${quote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestQuote = async () => {
    if (!selectedCompanyId) { toast.error('Please select a company to request a quote.'); return; }
    if (!cart || cart.items.length === 0) { toast.error('Your cart is empty.'); return; }

    setLoading(true);
    const toastId = toast.loading('Creating quote...');
    try {
      const quote = await createQuote(await buildQuoteRequest('negotiable'));
      toast.success('Quote requested successfully!', { id: toastId });
      navigate(`/quote/${quote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const selectedCompany = availableCompanies.find(c => c.id === selectedCompanyId);

  // Next quantity-break nudge for a line (applies the customer's discount ratio to the tier price).
  const nextTierNudge = (item: CartItem): { need: number; unit: number } | null => {
    const product = productMap[item.productId];
    if (!product?.priceTiers || product.priceTiers.length === 0) return null;
    const tiers = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
    const next = tiers.find((t) => t.minQty > item.quantity);
    if (!next) return null;
    const ratio = item.discountedPrice && item.discountedPrice > 0 && item.price > 0 && item.discountedPrice < item.price ? item.discountedPrice / item.price : 1;
    return { need: next.minQty - item.quantity, unit: next.price * ratio };
  };

  const cartSubtotal = cart?.totalPrice ?? (cart?.items?.reduce((s, i) => s + i.lineItemTotal, 0) || 0);
  const cartSavings = cart?.items?.reduce((s, i) => {
    const unit = i.discountedPrice && i.discountedPrice > 0 && i.discountedPrice < i.price ? i.discountedPrice : i.price;
    return s + (i.price - unit) * i.quantity;
  }, 0) || 0;

  // Order-rule awareness (informational; the server still enforces at checkout).
  const companyConfig = account?.customer?.attachedCompanies?.find((c) => c.companyCodeId === selectedCompanyId);
  const minOrderAmount = companyConfig?.minOrderAmountLimit || 0;
  const minOrderQty = companyConfig?.minOrderQuantityLimit || 0;
  const maxOrderAmount = companyConfig?.maxOrderAmountLimit || 0;
  const creditLimit = companyConfig?.creditLimit || 0;
  const cartWarnings: string[] = [];
  if (minOrderAmount > 0 && cartSubtotal < minOrderAmount) cartWarnings.push(`Add $${(minOrderAmount - cartSubtotal).toFixed(2)} to reach the $${minOrderAmount.toFixed(2)} minimum order.`);
  if (minOrderQty > 0 && totalItems < minOrderQty) cartWarnings.push(`Add ${minOrderQty - totalItems} more item${minOrderQty - totalItems === 1 ? '' : 's'} to reach the ${minOrderQty}-item minimum.`);
  if (maxOrderAmount > 0 && cartSubtotal > maxOrderAmount) cartWarnings.push(`This order is over the $${maxOrderAmount.toFixed(2)} maximum for this account.`);
  if (creditLimit > 0 && cartSubtotal > creditLimit) cartWarnings.push(`This order is over your $${creditLimit.toFixed(2)} credit limit.`);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Shopping cart" subtitle="Review your items, then request a quote or check out.">
          {availableCompanies.length > 0 && (
            <div className="relative inline-block text-left">
              <button
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className="inline-flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                <span className="flex items-center">
                  {selectedCompany?.logoUrl && (
                    <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="mr-2 h-6 w-6 rounded-full object-cover" />
                  )}
                  <span className="font-medium">{selectedCompany?.name || 'Select company'}</span>
                </span>
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              </button>
              {isCompanyDropdownOpen && (
                <div className="absolute right-0 z-10 mt-2 w-60 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="py-1" role="menu" aria-orientation="vertical">
                    {availableCompanies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setIsCompanyDropdownOpen(false);
                        }}
                        className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                      >
                        {company.logoUrl && (
                          <img src={company.logoUrl} alt={company.name} className="mr-3 h-6 w-6 rounded-full object-cover" />
                        )}
                        <span>{company.name} <span className="font-mono text-xs text-gray-400">{company.companyCode}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </PageHeader>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <Spinner className="h-8 w-8 border-4" />
          </div>
        )}

        {!loading && (!cart || !cart.items || cart.items.length === 0) ? (
          <div className={`${CARD} mt-6 p-10 text-center`}>
            <h2 className="text-lg font-semibold text-gray-900">Your cart is empty</h2>
            <p className="mt-1 mb-4 text-sm text-gray-500">
              {selectedCompanyId
                ? `No items in your cart for ${selectedCompany?.name || 'this company'}.`
                : 'Select a company to view your cart.'
              }
            </p>
            <button onClick={() => navigate('/catalog')} className={BTN_PRIMARY}>Continue shopping</button>
          </div>
        ) : (
          cart && cart.items && cart.items.length > 0 && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
              {/* Line items */}
              <div className={`${CARD} overflow-hidden`}>
                <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-semibold text-gray-900">Cart for {selectedCompany?.name || 'selected company'}</h2>
                  <p className="text-sm text-gray-500">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {cart.items.map((item) => {
                    const product = productMap[item.productId];
                    const discounted = !!item.discountedPrice && item.discountedPrice > 0 && item.discountedPrice < item.price;
                    const unit = discounted ? (item.discountedPrice as number) : item.price;
                    const nudge = nextTierNudge(item);
                    const draftQty = qtyDraft[item.id] ?? item.quantity;
                    const dirty = draftQty !== item.quantity;
                    return (
                      <li key={item.id} className="p-4 sm:p-6">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-gray-50 sm:h-20 sm:w-20">
                            <img src={item.image || 'https://via.placeholder.com/96x96'} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-semibold text-gray-900">{item.name}</h3>
                                {product?.sku && <p className="font-mono text-xs text-gray-400">{product.sku}</p>}
                                <p className="mt-0.5 text-sm tabular-nums text-gray-500">
                                  ${unit.toFixed(2)}/unit
                                  {discounted ? <span className="ml-1 text-gray-400 line-through">${item.price.toFixed(2)}</span> : null}
                                </p>
                              </div>
                              <div className="shrink-0 sm:text-right">
                                <p className="text-lg font-semibold tabular-nums text-gray-900">${item.lineItemTotal.toFixed(2)}</p>
                                {discounted ? <p className="text-sm tabular-nums text-gray-400 line-through">${(item.price * item.quantity).toFixed(2)}</p> : null}
                              </div>
                            </div>
                            {nudge ? (
                              <p className="mt-2 inline-block rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                                Add {nudge.need} more to pay <span className="tabular-nums">${nudge.unit.toFixed(2)}</span>/unit
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <div className="flex items-center">
                                <button
                                  onClick={() => setDraft(item.id, draftQty - 1)}
                                  className="h-9 w-9 rounded-l-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                  disabled={draftQty <= 1 || loading}
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={draftQty}
                                  onChange={(e) => setDraft(item.id, parseInt(e.target.value, 10))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitQty(item.id); }}
                                  className="h-9 w-14 border-y border-gray-300 text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  aria-label="Quantity"
                                />
                                <button
                                  onClick={() => setDraft(item.id, draftQty + 1)}
                                  className="h-9 w-9 rounded-r-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                  disabled={loading}
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                              {dirty ? (
                                <button
                                  onClick={() => commitQty(item.id)}
                                  className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                                  disabled={loading}
                                >
                                  Update
                                </button>
                              ) : null}
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="ml-auto text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                                disabled={loading}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Order summary */}
              <aside className={`${CARD} lg:sticky lg:top-6`}>
                <div className="border-b border-gray-100 px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Order summary</p>
                </div>
                <div className="px-5 py-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium tabular-nums text-gray-900">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    {cartSavings > 0 ? (
                      <div className="flex justify-between text-teal-700">
                        <span>You save</span>
                        <span className="font-semibold tabular-nums">-${cartSavings.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-gray-400">
                      <span>Tax &amp; shipping</span>
                      <span>Calculated at checkout</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Total</span>
                    <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-right text-[11px] text-gray-400">before tax &amp; shipping</p>

                  {cartWarnings.length > 0 && (
                    <div className="mt-4 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {cartWarnings.map((w) => (
                        <p key={w} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="h-4 w-4 shrink-0" /> <span>{w}</span></p>
                      ))}
                    </div>
                  )}

                  <button onClick={handleCheckout} className={`${BTN_PRIMARY} mt-4 w-full disabled:opacity-50`} disabled={loading}>
                    {loading ? 'Processing...' : 'Proceed to checkout'}
                  </button>
                  {selectedCompany?.quotesAllowed && (
                    <button onClick={handleRequestQuote} className={`${BTN_SECONDARY} mt-2 w-full disabled:opacity-50`} disabled={loading}>
                      {loading ? 'Processing...' : 'Request a quote'}
                    </button>
                  )}
                  <button onClick={handleClearCart} className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={loading}>
                    Clear cart
                  </button>
                </div>
              </aside>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;