import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Cart as CartType, Account, Product } from '../types';
import { getCart, updateCartItem, removeItemFromCart, clearCart, createQuote, getAccount, getCustomerConfigurations, getProducts } from '../api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
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

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (!selectedCompanyId || quantity < 1) return;

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
      toast.success('Item quantity updated!');
      invalidateCache(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update item quantity');
    } finally {
      setLoading(false);
    }
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
            <div className={`${CARD} mt-6 overflow-hidden`}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Cart for {selectedCompany?.name || 'selected company'}
                </h2>
                <p className="text-sm text-gray-500">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              </div>

              <ul className="divide-y divide-gray-200">
                {cart.items.map((item) => (
                  <li key={item.id} className="p-4 sm:p-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-24 h-24 bg-gray-50 rounded-md flex-shrink-0 overflow-hidden border border-gray-100">
                        <img
                          src={item.image || 'https://via.placeholder.com/96x96'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:justify-between">
                          <h3 className="text-lg font-semibold text-gray-800 truncate pr-2">{item.name}</h3>
                          <p className="text-lg font-semibold text-gray-900 tabular-nums sm:text-right">
                            ${item.lineItemTotal.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 bg-gray-200 text-gray-600 rounded-l-md hover:bg-gray-300 disabled:opacity-50"
                              disabled={item.quantity <= 1 || loading}
                            >
                              -
                            </button>
                            <span className="px-4 py-1 border-t border-b border-gray-300 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 bg-gray-200 text-gray-600 rounded-r-md hover:bg-gray-300"
                              disabled={loading}
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="text-center sm:text-left">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Total</span>
                    <p className="text-2xl font-extrabold tracking-tight text-gray-900 tabular-nums">${cart.totalPrice?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:space-x-3 w-full sm:w-auto gap-2">
                    <button
                      onClick={handleClearCart}
                      className="w-full sm:w-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      Clear cart
                    </button>
                    {selectedCompany?.quotesAllowed && (
                      <button
                        onClick={handleRequestQuote}
                        className={`${BTN_SECONDARY} w-full sm:w-auto disabled:opacity-50`}
                        disabled={loading}
                      >
                        {loading ? 'Processing...' : 'Request a quote'}
                      </button>
                    )}
                    <button
                      onClick={handleCheckout}
                      className={`${BTN_PRIMARY} w-full sm:w-auto disabled:opacity-50`}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Proceed to checkout'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;