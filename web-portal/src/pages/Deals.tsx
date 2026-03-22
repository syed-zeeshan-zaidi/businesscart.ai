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
      
      const deals = fetchedProducts.filter(product => product.dealPrice !== undefined && product.dealPrice > 0);
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
        {selectedCompany && (
          <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white p-6 md:p-8 rounded-lg shadow-lg mb-8 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 text-center md:text-left">
            {selectedCompany.logoUrl && (
              <img src={selectedCompany.logoUrl} alt={`${selectedCompany.name} Logo`} className="h-20 w-20 md:h-24 md:w-24 object-contain rounded-full bg-white p-2 shadow-md" />
            )}
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight">Deals from {selectedCompany.name}</h2>
              <p className="text-lg opacity-90">Discover exclusive discounts and special offers tailored just for you!</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Exclusive Deals</h1>
          {companies.length > 1 ? (
            <div className="relative w-full md:w-1/3">
              <button
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className="inline-flex items-center justify-between w-full rounded-md border border-gray-300 shadow-sm px-4 py-1 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                <div className="flex items-center">
                  {selectedCompany?.logoUrl && (
                    <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-8 max-w-40 mr-3 rounded-full" />
                  )}
                  <span className="font-bold">{selectedCompany?.name || 'Select Company'}</span>
                </div>
                <ChevronDownIcon className="ml-2 -mr-1 h-5 w-5" />
              </button>
              {isCompanyDropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setCompanyIdFilter(company.id);
                          setIsCompanyDropdownOpen(false);
                        }}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        role="menuitem"
                      >
                        {company.logoUrl && (
                          <img src={company.logoUrl} alt={company.name} className="h-8 max-w-40 mr-3 rounded-full" />
                        )}
                        {company.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : companies.length === 1 && (
            <div className="flex items-center">
              {companies[0].logoUrl && (
                <img src={companies[0].logoUrl} alt={companies[0].name} className="h-8 w-8 mr-3 rounded-full" />
              )}
              <span className="text-lg font-semibold text-gray-800">{companies[0].name}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full mx-auto my-12"></div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                onClick={() => openModal(product)}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition cursor-pointer"
              >
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/300x200'}
                    alt={product.name}
                    className="max-h-full max-w-full"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-xl font-semibold text-gray-800 truncate">{product.name}</h2>
                  <p className="text-gray-500 text-sm">{product.category}</p>
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      {product.dealPrice && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800 mr-2">
                          {product.dealPrice}% OFF
                        </span>
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
                    </div>
                    <AddToCartButton product={product} quantity={1} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No exclusive deals available at the moment.</p>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Deals;