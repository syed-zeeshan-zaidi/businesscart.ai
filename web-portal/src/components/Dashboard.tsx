import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from './Navbar';
import { useAuth } from '../hooks/useAuth';
import { getProducts } from '../api';
import { 
  ShoppingCartIcon, 
  CurrencyDollarIcon, 
  UsersIcon, 
  CubeIcon, 
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  name?: string;
  role: 'customer' | 'company' | 'admin';
  email: string;
}

const CACHE_KEY = 'products_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const Dashboard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUser = () => {
      if (!isAuthenticated) {
        setUser(null);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          throw new Error('No access token found');
        }
        const payload = JSON.parse(atob(token.split('.')[1]));
        const decodedUser = payload.user;
        if (decodedUser) {
          setUser(decodedUser);
        } else {
          throw new Error('Failed to decode user from token');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [isAuthenticated]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!user || !['company', 'admin'].includes(user.role)) {
        return;
      }

      setIsLoading(true);
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setProductCount(data.length);
            return;
          }
        }
        
        const products = await getProducts();
        
        setProductCount(products.length);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: products, timestamp: Date.now() }));
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Error fetching products');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [user]);

  const renderWelcomeMessage = () => {
    if (!user) return 'Welcome to your Dashboard';
    const role = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    return `Welcome, ${user.name || role}`;
  };

  const renderChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Monthly Sales</h3>
      <div className="flex items-end justify-around h-64">
        {[3, 5, 8, 9, 9, 7, 8, 4, 6, 9, 8, 5].map((h, i) => (
          <div key={i} className="w-12 bg-teal-600 rounded-t-lg" style={{ height: `${h * 1.5}rem` }}></div>
        ))}
      </div>
      <div className="flex justify-around mt-2 text-sm text-gray-600">
        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">{renderWelcomeMessage()}</h1>
            <p className="text-gray-600 mt-1">Here's what's happening with your business today.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
              <CurrencyDollarIcon className="h-12 w-12 text-teal-600 mr-4" />
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-800">$12,345</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
              <ShoppingCartIcon className="h-12 w-12 text-teal-600 mr-4" />
              <div>
                <p className="text-sm text-gray-600">New Orders</p>
                <p className="text-2xl font-bold text-gray-800">12</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
              <CubeIcon className="h-12 w-12 text-teal-600 mr-4" />
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                {isLoading ? 
                  <div className="animate-spin h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full"></div> : 
                  <p className="text-2xl font-bold text-gray-800">{productCount ?? 0}</p>
                }
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
              <UsersIcon className="h-12 w-12 text-teal-600 mr-4" />
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-800">56</p>
              </div>
            </div>
          </div>

          {renderChart()}

        </main>
      </div>
    </div>
  );
};

export default Dashboard;