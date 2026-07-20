import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getAccount } from '../api';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import AddToCartButton from '../components/AddToCartButton';
import FilterSidebar from '../components/FilterSidebar';
import ProductDetailModal from '../components/ProductDetailModal';
import { PageHeader, CARD, BTN_SECONDARY, Spinner } from '../components/ui';

const CACHE_KEY_PREFIX = 'user_products_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const Catalog: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyIdFilter, setCompanyIdFilter] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string; logoUrl?: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
      
      setProducts(fetchedProducts);

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
          products: fetchedProducts,
          account: fetchedAccount,
          timestamp: Date.now()
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load products');
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
      toast.error('Access denied. Only customers can view the catalog.');
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

  useEffect(() => {
    if (products.length > 0) {
      const filtered = companyIdFilter ? products.filter(p => p.sellerID === companyIdFilter) : products;
      const uniqueCategories = Array.from(new Set(filtered.map(p => p.category).filter(Boolean) as string[]));
      setCategories(uniqueCategories);
    }
  }, [products, companyIdFilter]);

  const filterableAttributes = useMemo(() => {
    const attributes: Record<string, Set<string>> = {};
    const filtered = companyIdFilter ? products.filter(p => p.sellerID === companyIdFilter) : products;
    filtered.forEach(product => {
      product.attributes?.forEach(attr => {
        if (attr.type === 'filterable' && attr.key && attr.value) {
          if (!attributes[attr.key]) {
            attributes[attr.key] = new Set();
          }
          attributes[attr.key].add(attr.value);
        }
      });
    });
    return Object.fromEntries(
      Object.entries(attributes).map(([key, valueSet]) => [key, Array.from(valueSet)])
    );
  }, [products, companyIdFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const companyMatch = companyIdFilter === '' || product.sellerID === companyIdFilter;
      const categoryMatch = categoryFilter === '' || product.category === categoryFilter;
      const attributeMatch = Object.entries(attributeFilters).every(([key, value]) => {
        if (!value) return true;
        return product.attributes?.some(attr => attr.key === key && attr.value === value);
      });
      return nameMatch && companyMatch && categoryMatch && attributeMatch;
    }).map(product => {
      if (product.dealPrice !== undefined && product.dealPrice !== null && product.dealPrice > 0) {
        const now = new Date();
        const dealActive = (!product.dealStartDate || new Date(product.dealStartDate) <= now) &&
                           (!product.dealEndDate || new Date(product.dealEndDate) >= now);
        if (dealActive) {
          return { ...product, discountedPrice: product.price * (1 - product.dealPrice / 100) };
        }
      }
      return product;
    });
  }, [products, searchQuery, companyIdFilter, categoryFilter, attributeFilters]);

  const clearFilters = () => {
    setAttributeFilters({});
  };

  const selectedCompany = useMemo(() => companies.find(c => c.id === companyIdFilter), [companies, companyIdFilter]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <FilterSidebar 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)}
        filterableAttributes={filterableAttributes}
        attributeFilters={attributeFilters}
        setAttributeFilters={setAttributeFilters}
      />
      <ProductDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={selectedProduct} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Product catalog" subtitle="Browse and add products to your cart.">
          {companies.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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
                        onClick={() => { setCompanyIdFilter(company.id); setIsCompanyDropdownOpen(false); }}
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
          ) : companies.length === 1 && (
            <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              {companies[0].logoUrl && (
                <img src={companies[0].logoUrl} alt={companies[0].name} className="h-6 w-6 rounded-full object-cover" />
              )}
              <span className="font-semibold">{companies[0].name}</span>
            </div>
          )}
        </PageHeader>

        <div className="mt-6 mb-10 flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="relative w-full md:w-1/6">
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button onClick={() => setIsFilterOpen(true)} className={BTN_SECONDARY}>Filters</button>

          <div className="relative flex-grow">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>

        </div>

        {Object.values(attributeFilters).some(v => v) && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(attributeFilters).map(([key, value]) => value ? (
                <div key={key} className="bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 flex items-center">
                  <span>{key}: <strong>{value}</strong></span>
                  <button 
                    onClick={() => setAttributeFilters(prev => ({ ...prev, [key]: '' }))} 
                    className="ml-2 text-gray-500 hover:text-gray-700"
                    aria-label={`Remove ${key} filter`}
                  >
                    &#10005;
                  </button>
                </div>
              ) : null)}
              <button onClick={clearFilters} className="text-sm text-teal-700 hover:underline">
                Clear All
              </button>
            </div>
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
                        <p className="text-teal-700 font-bold text-lg">${product.price.toFixed(2)}</p>
                      )}
                      {product.priceTiers && product.priceTiers.length > 0 && (
                        <p className="text-xs font-medium text-teal-700">Bulk pricing available</p>
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
            <p className="text-sm text-gray-500">No products in this catalog yet.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Catalog;