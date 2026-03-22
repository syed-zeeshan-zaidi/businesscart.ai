import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { createQuote, getAccounts, getProducts, addItemToCart, getCart, updateCartItem, removeItemFromCart, getAccount, getCompanyLocations } from '../api';
import { Account, Product, CreateQuoteRequest, Cart, CustomerCodeEntry } from '../types';

const QuoteCreateForm: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Account[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [currentCompanyId, setCurrentCompanyId] = useState<string>('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const accounts = await getAccounts();
        setCustomers(accounts.filter((acc: Account) => acc.role === 'customer'));

        const allProducts = await getProducts();
        setProducts(allProducts);

        // Assuming the logged-in user is a company
        const companyAccount = accounts.find(acc => acc.role === 'company');
        if(companyAccount) {
          setCurrentCompanyId(companyAccount._id);
        } else {
          toast.error('Company account not found.');
          navigate('/dashboard');
        }

      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to fetch initial data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [navigate]);

  const fetchCart = useCallback(async () => {
    if (!selectedCustomer || !currentCompanyId) return;
    setCartLoading(true);
    try {
      const fetchedCart = await getCart(currentCompanyId, selectedCustomer);
      setCart(fetchedCart);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setCart(null);
      } else {
        toast.error(err.response?.data?.message || 'Failed to fetch customer cart.');
      }
    } finally {
      setCartLoading(false);
    }
  }, [selectedCustomer, currentCompanyId]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleProductSelection = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    if (!productId || !selectedCustomer) return;
    const product = products.find(p => p._id === productId);
    if (product && !cart?.items.some(item => item.productId === productId)) {
      setCartLoading(true);
      const toastId = toast.loading('Adding item...');
      try {
        const newItem = {
          productId: product._id,
          quantity: 1,
          sellerId: product.sellerID,
          name: product.name,
          price: product.price,
          discountedPrice: product.discountedPrice,
          image: product.images?.[0],
          dealPrice: product.dealPrice,
        };
        await addItemToCart({ entity: newItem }, selectedCustomer);
        await fetchCart(); // Refresh cart
        toast.success('Item added.', { id: toastId });
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to add item.', { id: toastId });
      } finally {
        setCartLoading(false);
      }
    }
  };

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    if (quantity < 1 || !selectedCustomer) return;
    setCartLoading(true);
    try {
      await updateCartItem(itemId, { entity: { quantity } }, currentCompanyId, selectedCustomer);
      await fetchCart();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update quantity.');
    } finally {
      setCartLoading(false);
    }
  };

  const handleRemoveProduct = async (itemId: string) => {
    if (!selectedCustomer) return;
    setCartLoading(true);
    try {
      await removeItemFromCart(itemId, currentCompanyId, selectedCustomer);
      await fetchCart();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove item.');
    } finally {
      setCartLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error('Please select a customer.');
      return;
    }
    if (!cart || cart.items.length === 0) {
      toast.error('Please add at least one product to the cart.');
      return;
    }
    if (!currentCompanyId) {
      toast.error('Company ID not found.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Creating quote...');

    try {
      const customerAccount = await getAccount(selectedCustomer);
      const companyAccount = await getAccount(currentCompanyId);
      const companyLocations = await getCompanyLocations(currentCompanyId);

      const customerConfig = customerAccount.customer?.customerConfigs?.find((c: CustomerCodeEntry) => c.codeId === currentCompanyId);
      const configurations = customerConfig?.configuration ? [customerConfig.configuration] : [];

      const newQuote: CreateQuoteRequest = {
        sellerId: currentCompanyId,
        accountId: selectedCustomer,
        quotesAllowed: companyAccount.company?.quotesAllowed || true,
        paymentMethods: companyAccount.company?.paymentMethods || [],
        deliveryMethods: companyAccount.company?.deliveryMethods || [],
        shippingOutOptions: companyAccount.company?.shippingOutOptions || [],
        companyLocations: companyLocations,
        customerAddresses: customerAccount.customer?.customerAddresses || [],
        configurations: configurations,
        quoteType: 'negotiable',
        status: 'draft',
      };

      const createdQuote = await createQuote(newQuote);

      toast.success('Quote created successfully!', { id: toastId });
      navigate(`/quote-details/${createdQuote.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create quote.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-gray-700">Select Customer</label>
            <select
              id="customer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">-- Select Customer --</option>
              {customers.map(customer => (
                <option key={customer._id} value={customer._id}>{customer.name} ({customer.email})</option>
              ))}
            </select>
            {!selectedCustomer && (
              <p className="mt-1 text-sm text-red-600">Please select a customer to add products.</p>
            )}
          </div>

          {selectedCustomer && (
            <>
              <div>
                <label htmlFor="products" className="block text-sm font-medium text-gray-700">Add Products</label>
                <select
                  id="products"
                  onChange={handleProductSelection}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value=""
                  disabled={!selectedCustomer}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(product => (
                    <option key={product._id} value={product._id}>{product.name} (${product.price.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {cartLoading ? (
                <div className="text-center py-4">Loading cart...</div>
              ) : cart && cart.items.length > 0 ? (
                <div className="border p-4 rounded-md">
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Selected Items</h3>
                  <ul className="divide-y divide-gray-200">
                    {cart.items.map((item) => (
                      <li key={item.id} className="py-2 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="h-10 w-10 object-cover rounded-md" />
                          )}
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                            className="w-20 p-1 border rounded-md text-sm"
                            min="1"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 text-right font-bold text-lg">
                    Subtotal: ${cart.totalPrice.toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">Customer's cart is empty.</div>
              )}
            </>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            disabled={loading || !selectedCustomer || !cart || cart.items.length === 0}
          >
            {loading ? 'Creating...' : 'Create Quote'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuoteCreateForm;