import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Cart as CartType } from '../types';
import { getCart, updateCartItem, removeItemFromCart, clearCart, getUserAssociatedCompanies } from '../api';

const CACHE_KEY_PREFIX = 'cart_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const Cart: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [associatedCompanies, setAssociatedCompanies] = useState<string[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const invalidateCache = (companyId: string) => {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${companyId}`);
  };

  const fetchCart = useCallback(async (companyId: string) => {
    setLoading(true);
    const loadingToastId = toast.loading(`Loading cart for company ${companyId}...`);
    try {
      const fetchedCart = await getCart(companyId);
      setCart(fetchedCart);
      localStorage.setItem(`${CACHE_KEY_PREFIX}${companyId}`, JSON.stringify({ data: fetchedCart, timestamp: Date.now() }));
      toast.success(`Cart for company ${companyId} loaded successfully!`, { id: loadingToastId });
    } catch (err: any) {
      setCart(null); // Ensure cart is null on error
      invalidateCache(companyId); // Invalidate cache on error
      toast.error(err.response?.data?.message || `Failed to load cart for company ${companyId}.`, { id: loadingToastId });
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

    const role = decodeJWT(token);
    if (role !== 'customer') {
      toast.error('Access denied. Only customers can view their cart.');
      navigate('/home'); // Redirect non-customers
      return;
    }
    setUserRole(role);

    const loadCompaniesAndCart = async () => {
      try {
        const companies = await getUserAssociatedCompanies(); // Assuming decodeJWT returns user object with id
        setAssociatedCompanies(companies);
        if (companies.length > 0) {
          const initialCompanyId = companies[0]; // Select the first company by default
          setSelectedCompanyId(initialCompanyId);
          const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${initialCompanyId}`);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION && data.companyId === initialCompanyId) {
              setCart(data);
              setLoading(false);
              return;
            }
          }
          await fetchCart(initialCompanyId);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load associated companies');
        setLoading(false);
      }
    };

    loadCompaniesAndCart();

    window.addEventListener('cartUpdated', () => {
      if (selectedCompanyId) {
        fetchCart(selectedCompanyId);
      }
    });

    return () => {
      window.removeEventListener('cartUpdated', () => {
        if (selectedCompanyId) {
          fetchCart(selectedCompanyId);
        }
      });
    };
  }, [isAuthenticated, navigate, decodeJWT, fetchCart]);

  const handleCompanyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const companyId = event.target.value;
    setSelectedCompanyId(companyId);
    fetchCart(companyId);
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const updatedCart = await updateCartItem(itemId, { entity: { quantity } }, selectedCompanyId);
      setCart(updatedCart);
      toast.success('Item quantity updated!');
      invalidateCache(selectedCompanyId); // Invalidate cache after successful update
      window.dispatchEvent(new Event('cartUpdated')); // Dispatch custom event
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
      invalidateCache(selectedCompanyId); // Invalidate cache after successful removal
      window.dispatchEvent(new Event('cartUpdated')); // Dispatch custom event
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
      invalidateCache(selectedCompanyId); // Invalidate cache after successful clear
      window.dispatchEvent(new Event('cartUpdated')); // Dispatch custom event
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  if (!userRole || loading || associatedCompanies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Shopping Cart</h1>

        {associatedCompanies.length > 0 && (
          <div className="mb-6">
            <label htmlFor="company-select" className="block text-sm font-medium text-gray-700">Select Company Cart:</label>
            <select
              id="company-select"
              name="company-select"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md"
              value={selectedCompanyId || ''}
              onChange={handleCompanyChange}
            >
              {associatedCompanies.map(companyId => (
                <option key={companyId} value={companyId}>{companyId}</option>
              ))}
            </select>
            {selectedCompanyId && (
              <p className="mt-2 text-sm text-gray-600">Showing cart for company: <span className="font-medium">{selectedCompanyId}</span></p>
            )}
          </div>
        )}

        {!cart || cart.items.length === 0 ? (
          <p className="text-gray-600">Your cart is empty for {selectedCompanyId || 'the selected company'}.</p>
        ) : (
          <div className="bg-white shadow-lg rounded-lg p-6">
            <div className="divide-y divide-gray-200">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">{item.name || 'N/A'}</h2>
                      <p className="text-gray-600">Price: ${item.price !== undefined ? item.price.toFixed(2) : 'N/A'}</p>
                      <p className="text-gray-600">Quantity: {item.quantity}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                        if (item._id) {
                          handleUpdateQuantity(item._id, parseInt(e.target.value));
                        }
                      }}
                        className="w-20 p-2 border border-gray-300 rounded-md"
                      />
                      {item._id && (
                        <button
                          onClick={() => {
                            if (item._id) {
                              handleRemoveItem(item._id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <p className="text-lg font-semibold text-gray-800">Total: ${cart.totalPrice !== undefined ? cart.totalPrice.toFixed(2) : 'N/A'}</p>
              <button
                onClick={handleClearCart}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Clear Cart
              </button>
              <button
                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;