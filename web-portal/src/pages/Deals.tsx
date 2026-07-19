import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getAccount } from '../api';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import AddToCartButton from '../components/AddToCartButton';
import ProductDetailModal from '../components/ProductDetailModal';
import { CARD, Spinner } from '../components/ui';

const CACHE_KEY_PREFIX = 'user_deals_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const Deals: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyIdFilter, setCompanyIdFilter] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string; logoUrl?: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  const openModal = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

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

  const fetchProductsAndAccount = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      const decodedUser = decodeJWT(token);
      if (!decodedUser || !decodedUser.id) throw new Error('Could not decode user from token');

      const [fetchedProducts, fetchedAccount] = await Promise.all([
        getProducts(),
        getAccount(decodedUser.id),
      ]);
      
      const now = new Date();
      const deals = fetchedProducts.filter(product => {
        if (!product.dealPrice || product.dealPrice <= 0) return false;
        if (product.dealStartDate && new Date(product.dealStartDate) > now) return false;
        if (product.dealEndDate && new Date(product.dealEndDate) < now) return false;
        return true;
      });
      setProducts(deals);

      if (fetchedAccount.role === 'customer' && fetchedAccount.customer?.attachedCompanies) {
        const customerCompanies = fetchedAccount.customer.attachedCompanies.map((c: any) => ({
          id: c.companyCodeId,
          name: c.name,
          logoUrl: c.logoUrl,
        }));
        setCompanies(customerCompanies);
        if (customerCompanies.length > 0) {
          setCompanyIdFilter(customerCompanies[0].id);
        }
      }

      const cacheKey = getCacheKey();
      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify({
          products: deals,
          account: fetchedAccount,
          timestamp: Date.now()
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [getCacheKey, decodeJWT]);

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

    const decoded = decodeJWT(token);
    if (decoded.role !== 'customer') {
      toast.error('Access denied. Only customers can view deals.');
      navigate('/home');
      return;
    }

    const loadData = async () => {
      const cacheKey = getCacheKey();
      if (cacheKey) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { products: cachedProducts, account: cachedAccount, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setProducts(cachedProducts);
            if (cachedAccount.customer?.attachedCompanies) {
                const customerCompanies = cachedAccount.customer.attachedCompanies.map((c: any) => ({
                  id: c.companyCodeId,
                  name: c.name,
                  logoUrl: c.logoUrl,
                }));
                setCompanies(customerCompanies);
                if (customerCompanies.length > 0) {
                    setCompanyIdFilter(customerCompanies[0].id);
                }
            }
            setLoading(false);
            return;
          }
        }
      }
      await fetchProductsAndAccount();
    };

    loadData();
  }, [isAuthenticated, navigate, decodeJWT, fetchProductsAndAccount, getCacheKey]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const companyMatch = companyIdFilter === '' || product.sellerID === companyIdFilter;
      return companyMatch;
    }).map(product => {
      if (product.dealPrice !== undefined && product.dealPrice !== null) {
        return { ...product, discountedPrice: product.price * (1 - product.dealPrice / 100) };
      }
      return product;
    });
  }, [products, companyIdFilter]);

  const selectedCompany = useMemo(() => companies.find(c => c.id === companyIdFilter), [companies, companyIdFilter]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <ProductDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={selectedProduct} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 shadow-sm">
          <div className="flex items-center gap-4 p-6 text-white md:p-8">
            {selectedCompany?.logoUrl && (
              <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-16 w-16 shrink-0 rounded-full bg-white/95 object-contain p-1.5 ring-1 ring-white/30 md:h-20 md:w-20" />
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-200">Deals</p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{selectedCompany ? `Deals from ${selectedCompany.name}` : 'Deals'}</h1>
              <p className="mt-1 text-sm text-teal-50/90">Current discounts and bulk pricing on your catalog.</p>
            </div>
          </div>
        </div>

        {companies.length > 0 && (
          <div className="mb-6 flex items-center justify-end gap-2">
            {companies.length > 1 ? (
              <div className="relative">
                <button
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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
                  <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => {
                            setCompanyIdFilter(company.id);
                            setIsCompanyDropdownOpen(false);
                          }}
                          className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          role="menuitem"
                        >
                          {company.logoUrl && (
                            <img src={company.logoUrl} alt={company.name} className="mr-3 h-6 w-6 rounded-full object-cover" />
                          )}
                          {company.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
                {companies[0].logoUrl && (
                  <img src={companies[0].logoUrl} alt={companies[0].name} className="h-6 w-6 rounded-full object-cover" />
                )}
                <span className="font-semibold">{companies[0].name}</span>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <Spinner className="h-8 w-8 border-4 mx-auto my-12" />
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                onClick={() => openModal(product)}
                className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex h-48 items-center justify-center bg-gray-50">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/300x200'}
                    alt={product.name}
                    className="max-h-full max-w-full"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h2 className="truncate text-base font-semibold text-gray-900">{product.name}</h2>
                  <p className="text-gray-500 text-sm">{product.category}</p>
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      {product.dealPrice && (
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800">
                            {product.dealPrice}% OFF
                          </span>
                          {product.dealEndDate && (
                            <span className="text-xs text-gray-500">
                              Ends {new Date(product.dealEndDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                      {product.discountedPrice && product.discountedPrice < product.price ? (
                        <>
                          <p className="text-teal-700 font-bold text-lg">
                            ${product.discountedPrice.toFixed(2)}
                          </p>
                          <p className="text-gray-500 line-through text-sm">
                            ${product.price.toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <p className="text-teal-700 font-bold text-lg">
                          ${product.price.toFixed(2)}
                        </p>
                      )}
                      {product.priceTiers && product.priceTiers.length > 0 && (
                        <p className="text-xs text-teal-600 font-medium">Bulk pricing available</p>
                      )}
                    </div>
                    <AddToCartButton product={product} quantity={1} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${CARD} p-10 text-center`}>
            <p className="text-sm text-gray-500">No deals right now. Check back later, or browse the full catalog.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Deals;