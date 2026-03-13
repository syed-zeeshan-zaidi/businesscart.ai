import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, getAccount } from '../api';
import { Toaster, toast } from 'react-hot-toast';
import { CubeIcon, TagIcon, ClipboardDocumentListIcon, UserCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Account, Product } from '../types';

const Home: React.FC = () => {
  const { isAuthenticated, logout, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAccount = async () => {
      if (!isAuthenticated) {
        setAccount(null);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) throw new Error('No access token found');
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.id) throw new Error('User ID not found in JWT');
        
        const cachedAccount = localStorage.getItem('account');
        if (cachedAccount) {
          setAccount(JSON.parse(cachedAccount));
          return;
        }
        
        const fetchedAccount = await getAccount(decoded.id);
        setAccount(fetchedAccount);
        localStorage.setItem('account', JSON.stringify(fetchedAccount));

      } catch (err: any) {
        toast.error(err.message || 'Failed to load user data');
        logout();
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [isAuthenticated, logout, decodeJWT]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!account || account.role !== 'customer') return;

      setLoading(true);
      try {
        const fetchedProducts = await getProducts();
        setProducts(fetchedProducts.slice(0, 3));
      } catch (err: any) {
        toast.error(err.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [account]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}



        {/* Authenticated users content */}
        {isAuthenticated && account && (
          <div className="py-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
              Welcome, {account.name || account.role.charAt(0).toUpperCase() + account.role.slice(1)}!
            </h2>

            {account.role === 'customer' && (
              <>
                {/* Hero Section */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-800 text-white rounded-lg shadow-lg py-16 mb-12 text-center">
                  <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">Shop Premium Products</h3>
                  <p className="mt-4 text-lg sm:text-xl max-w-3xl mx-auto px-4">Explore our curated selection of high-quality products for your business needs.</p>
                  <button
                    onClick={() => navigate('/catalog')}
                    className="mt-8 inline-block bg-white text-teal-600 font-semibold px-8 py-3 rounded-md shadow-lg hover:bg-gray-100 transition-transform transform hover:scale-105"
                  >
                    Shop Now
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="mb-16">
                  <h3 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-6 text-center">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300">
                      <CubeIcon className="w-12 h-12 text-teal-600 mb-4" />
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Browse Products</h4>
                      <p className="text-gray-600 text-sm mb-4">Explore the full product catalog.</p>
                      <Link to="/catalog" className="text-teal-600 hover:text-teal-800 font-semibold flex items-center">
                        Go to Catalog <ArrowRightIcon className="w-4 h-4 ml-2" />
                      </Link>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300">
                      <TagIcon className="w-12 h-12 text-teal-600 mb-4" />
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Special Deals</h4>
                      <p className="text-gray-600 text-sm mb-4">Check out the latest promotions.</p>
                      <Link to="/deals" className="text-teal-600 hover:text-teal-800 font-semibold flex items-center">
                        View Deals <ArrowRightIcon className="w-4 h-4 ml-2" />
                      </Link>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300">
                      <ClipboardDocumentListIcon className="w-12 h-12 text-teal-600 mb-4" />
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Your Orders</h4>
                      <p className="text-gray-600 text-sm mb-4">Track your past and current orders.</p>
                      <Link to="/order-history" className="text-teal-600 hover:text-teal-800 font-semibold flex items-center">
                        My Orders <ArrowRightIcon className="w-4 h-4 ml-2" />
                      </Link>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300">
                      <UserCircleIcon className="w-12 h-12 text-teal-600 mb-4" />
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Your Account</h4>
                      <p className="text-gray-600 text-sm mb-4">Manage your account details.</p>
                      <Link to="/account" className="text-teal-600 hover:text-teal-800 font-semibold flex items-center">
                        My Account <ArrowRightIcon className="w-4 h-4 ml-2" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Featured Products */}
                <div>
                  <h3 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-6 text-center">Featured Products</h3>
                  {products.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
                      {products.map((product) => (
                        <div
                          key={product._id}
                          className="bg-white rounded-lg shadow-lg overflow-hidden transform transition duration-300 hover:scale-105 group"
                        >
                          <div className="relative">
                            <img
                              src={product.images?.[0] || 'https://via.placeholder.com/300x200'}
                              alt={product.name}
                              className="w-full h-56 object-cover"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-50 transition duration-300 flex items-center justify-center">
                              <p className="text-white text-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity"></p>
                            </div>
                          </div>
                          <div className="p-4 text-center">
                            <h4 className="text-lg font-semibold text-gray-800 truncate">{product.name}</h4>
                            <p className="text-teal-600 font-bold mt-2">${product.price.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 mb-6 text-center">No featured products available at the moment.</p>
                  )}
                  <div className="text-center">
                    <Link
                      to="/catalog"
                      className="inline-block bg-teal-600 text-white px-8 py-3 rounded-lg hover:bg-teal-700 transition-transform transform hover:scale-105"
                    >
                      View All Products
                    </Link>
                  </div>
                </div>
              </>
            )}

            {account.role === 'company' && (
              <div>
                <p className="text-lg text-gray-600 mb-6">
                  Manage your products and orders for {account.company?.name || 'your company'}.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Link
                    to="/dashboard"
                    className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition"
                  >
                    Manage Products
                  </Link>
                  <Link
                    to="/orders"
                    className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition"
                  >
                    Manage Orders
                  </Link>
                </div>
              </div>
            )}

            {account.role === 'admin' && (
              <div>
                <p className="text-lg text-gray-600 mb-6">Administer users, products, and orders.</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Link
                    to="/admin/users"
                    className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition"
                  >
                    Manage Users
                  </Link>
                  <Link
                    to="/admin/products"
                    className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition"
                  >
                    Manage Products
                  </Link>
                  <Link
                    to="/admin/orders"
                    className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition"
                  >
                    Manage Orders
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Home;