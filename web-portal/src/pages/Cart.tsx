import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Cart as CartType } from '../types';
import { getCart, updateCartItem, removeItemFromCart, clearCart, createQuote, getAccount } from '../api';

const CACHE_KEY_PREFIX = 'cart_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const Cart: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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

  // Separate effect for initial data loading
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
    setUserRole(decodedUser.role);

    const loadCompanies = async () => {
      try {
        const account = await getAccount(decodedUser.id);
        
        if (account.customer?.attachedCompanies && account.customer.attachedCompanies.length > 0) {
          const companies = account.customer.attachedCompanies.map(company => ({
            id: company.companyCodeId || company._id || company.companyCode,
            name: company.name,
            companyCode: company.companyCode
          }));
          
          setAvailableCompanies(companies);
          
          if (companies.length > 0) {
            // Set the first company as default only if no company is selected
            if (!selectedCompanyId) {
              const defaultCompanyId = companies[0].id;
              setSelectedCompanyId(defaultCompanyId);
              await fetchCart(defaultCompanyId);
            }
            setInitialLoadComplete(true);
          } else {
            setLoading(false);
            setInitialLoadComplete(true);
          }
        } else {
          setLoading(false);
          setInitialLoadComplete(true);
          toast.error('No companies available for shopping');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load data');
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };

    loadCompanies();
  }, [isAuthenticated, navigate, decodeJWT, fetchCart]); // Removed selectedCompanyId from deps

  // Separate effect for cart updates when company changes
  useEffect(() => {
    if (selectedCompanyId && initialLoadComplete) {
      fetchCart(selectedCompanyId);
    }
  }, [selectedCompanyId, initialLoadComplete, fetchCart]);

  const handleCompanyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const companyId = event.target.value;
    setSelectedCompanyId(companyId);
    // The fetch will happen in the useEffect above
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (!selectedCompanyId || quantity < 1) return;
    
    setLoading(true);
    try {
      const updatedCart = await updateCartItem(itemId, { entity: { quantity } }, selectedCompanyId);
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

  const handleCheckout = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company to checkout.');
      return;
    }
    
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Creating quote...');
    try {
      const quote = await createQuote(selectedCompanyId);
      toast.success('Proceeding to checkout!', { id: toastId });
      navigate(`/checkout/${quote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Shopping Cart</h1>

        {availableCompanies.length > 0 && (
          <div className="mb-6">
            <label htmlFor="company-select" className="block text-sm font-medium text-gray-700">
              Select Company:
            </label>
            <select
              id="company-select"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md"
              value={selectedCompanyId || ''}
              onChange={handleCompanyChange}
            >
              <option value="">-- Select a company --</option>
              {availableCompanies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.companyCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!loading && (!cart || !cart.items || cart.items.length === 0) ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-4">
              {selectedCompanyId 
                ? `No items in cart for ${availableCompanies.find(c => c.id === selectedCompanyId)?.name || 'selected company'}`
                : 'Select a company to view your cart'
              }
            </p>
            <button
              onClick={() => navigate('/catalog')}
              className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 transition"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          cart && cart.items && cart.items.length > 0 && (
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Cart for {availableCompanies.find(c => c.id === selectedCompanyId)?.name || 'selected company'}
                </h2>
                <p className="text-sm text-gray-600">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              </div>

              <div className="divide-y divide-gray-200">
                {cart.items.map((item) => (
                  <div key={item.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-gray-600">${item.price?.toFixed(2) || '0.00'} each</p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <label htmlFor={`quantity-${item.id}`} className="sr-only">Quantity</label>
                        <input
                          type="number"
                          id={`quantity-${item.id}`}
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value);
                            if (newQuantity >= 1) {
                              handleUpdateQuantity(item.id, newQuantity);
                            }
                          }}
                          className="w-16 p-2 border border-gray-300 rounded-md text-center"
                        />
                      </div>
                      
                      <p className="text-lg font-semibold text-gray-800 w-20 text-right">
                        ${((item.price || 0) * item.quantity).toFixed(2)}
                      </p>
                      
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-800">
                      Total: ${cart.totalPrice?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={handleClearCart}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      Clear Cart
                    </button>
                    <button
                      onClick={handleCheckout}
                      className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Proceed to Checkout'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default Cart;