import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getAccount } from '../api';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Product, Account } from '../types';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AddToCartButton from '../components/AddToCartButton';

const CACHE_KEY_PREFIX = 'user_products_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const Catalog: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyIdFilter, setCompanyIdFilter] = useState('');
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [account, setAccount] = useState<Account | null>(null);

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
      setAccount(fetchedAccount);

      if (fetchedAccount.role === 'customer' && fetchedAccount.customer) {
        const customerCompanyIds = fetchedAccount.customer.customerCodes.map(c => c.customerCode);
        setCompanyIds(customerCompanyIds);
        if (customerCompanyIds.length > 0) {
          setCompanyIdFilter(customerCompanyIds[0]);
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
            setAccount(cachedAccount)
            if (cachedAccount.customer) {
                const customerCompanyIds = cachedAccount.customer.customerCodes.map((c: any) => c.customerCode);
                setCompanyIds(customerCompanyIds);
                if (customerCompanyIds.length > 0) {
                    setCompanyIdFilter(customerCompanyIds[0]);
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
    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (companyIdFilter === '' || product.companyId === companyIdFilter)
    );
  }, [products, searchQuery, companyIdFilter]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Product Catalog</h1>

        <div className="mb-6 flex space-x-4">
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

          <div className="relative w-1/3 flex items-center">
            <label htmlFor="company-filter" className="mr-2 font-medium text-gray-700">Company:</label>
            <select
              id="company-filter"
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            >
              {companyIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto my-12"></div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition"
              >
                <img
                  src={product.image || 'https://via.placeholder.com/300x200'}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h2 className="text-xl font-semibold text-gray-800">{product.name}</h2>
                  <p className="text-gray-600 text-sm line-clamp-2">{product.description}</p>
                  <p className="text-teal-600 font-bold mt-2">${product.price.toFixed(2)}</p>
                  <AddToCartButton product={product} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No products available in the catalog.</p>
        )}
      </main>
    </div>
  );
};

export default Catalog;