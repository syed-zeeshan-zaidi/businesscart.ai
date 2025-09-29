import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { Quote } from '../types';
import { createOrder, getQuote } from '../api';

const Checkout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('');
  const [selectedShippingOption, setSelectedShippingOption] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedPickupLocation, setSelectedPickupLocation] = useState('');
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
    if (!quoteId) {
      toast.error('No quote ID provided.');
      navigate('/cart');
      return;
    }

    const fetchQuote = async () => {
      setLoading(true);
      try {
        const fetchedQuote = await getQuote(quoteId);
        setQuote(fetchedQuote);
        if (fetchedQuote.availableDeliveryMethods && fetchedQuote.availableDeliveryMethods.length > 0) {
          setSelectedDeliveryMethod(fetchedQuote.availableDeliveryMethods[0]);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to fetch quote details.');
        navigate('/cart');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [isAuthenticated, navigate, quoteId]);

  const filteredPaymentMethods = useMemo(() => {
    if (!quote) return [];

    if (selectedDeliveryMethod !== 'pickup') {
      return quote.availablePaymentMethods.filter(p => p !== 'pickup_pay');
    }
    return quote.availablePaymentMethods;
  }, [quote, selectedDeliveryMethod]);

  useEffect(() => {
    if (filteredPaymentMethods.length > 0) {
      if (!filteredPaymentMethods.includes(selectedPaymentMethod)) {
        setSelectedPaymentMethod(filteredPaymentMethods[0]);
      }
    } else {
      setSelectedPaymentMethod('');
    }
  }, [filteredPaymentMethods, selectedPaymentMethod]);

  const handlePlaceOrder = async () => {
    if (!quote) {
      toast.error('No quote available to place an order.');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method.');
      return;
    }
    if (selectedDeliveryMethod === 'pickup' && !selectedPickupLocation) {
      toast.error('Please select a pickup location.');
      return;
    }
    if (selectedDeliveryMethod !== 'pickup' && !selectedDeliveryAddress) {
      toast.error('Please select a delivery address.');
      return;
    }
    
    let token = 'tok_placeholder';
    if (selectedPaymentMethod === 'stripe') {
        token = 'tok_stripe_valid';
    } else if (selectedPaymentMethod === 'amazon_pay') {
        token = 'amz_pay_valid';
    } else if (selectedPaymentMethod === 'pickup_pay') {
        token = 'offline_payment';
    }

    setLoading(true);
    const toastId = toast.loading('Placing your order...');
    try {
      await createOrder({ 
        quoteId: quote.id, 
        paymentMethod: selectedPaymentMethod, 
        paymentToken: token,
        deliveryMethod: selectedDeliveryMethod,
        pickupLocationId: selectedDeliveryMethod === 'pickup' ? selectedPickupLocation : undefined,
        deliveryAddressId: selectedDeliveryMethod !== 'pickup' ? selectedDeliveryAddress : undefined,
      });
      toast.success('Order placed successfully!', { id: toastId });
      navigate('/order-success');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place order.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Toaster position="top-right" />
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Checkout</h1>
          <p>Could not load quote details.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Delivery and Payment */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Delivery & Payment</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="delivery-method" className="block text-sm font-medium text-gray-700">Delivery Method</label>
                <select
                  id="delivery-method"
                  value={selectedDeliveryMethod}
                  onChange={(e) => setSelectedDeliveryMethod(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {quote.availableDeliveryMethods.map(method => (
                    <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {selectedDeliveryMethod === 'pickup' && (
                <div>
                  <label htmlFor="pickup-location" className="block text-sm font-medium text-gray-700">Pickup Location</label>
                  <select
                    id="pickup-location"
                    value={selectedPickupLocation}
                    onChange={(e) => setSelectedPickupLocation(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a location</option>
                    {quote.companyLocations?.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.locationName} - {location.address.street}, {location.address.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDeliveryMethod !== 'pickup' && (
                <div>
                  <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700">Delivery Address</label>
                  <select
                    id="delivery-address"
                    value={selectedDeliveryAddress}
                    onChange={(e) => setSelectedDeliveryAddress(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select an address</option>
                    {quote.customerAddresses?.map(address => (
                      <option key={address.id} value={address.id}>
                        {address.addressLabel}: {address.address.street}, {address.address.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDeliveryMethod === 'shipping_out' && (
                <div>
                  <label htmlFor="shipping-option" className="block text-sm font-medium text-gray-700">Shipping Option</label>
                  <select
                    id="shipping-option"
                    value={selectedShippingOption}
                    onChange={(e) => setSelectedShippingOption(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {quote.availableShippingOutOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                {filteredPaymentMethods.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {filteredPaymentMethods.map(method => (
                      <label key={method} htmlFor={method} className="flex items-center p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
                        <input
                          id={method}
                          name="payment-method"
                          type="radio"
                          value={method}
                          checked={selectedPaymentMethod === method}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="focus:ring-teal-500 h-4 w-4 text-teal-600 border-gray-300"
                        />
                        <span className="ml-3 block text-sm font-medium text-gray-700 capitalize">
                          {method.replace(/_/g, ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 mt-2">No payment methods available for the selected delivery method.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Quote Summary */}
          <div className="space-y-6">
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Quote Summary</h2>
              <ul className="divide-y divide-gray-200">
                {quote.items.map(item => (
                  <li key={item.id} className="py-4 flex flex-col sm:flex-row justify-between sm:items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-gray-600">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-lg font-semibold text-gray-800 mt-2 sm:mt-0 text-left sm:text-right">
                      <span className='text-gray-500 line-through text-sm'>${item.price.toFixed(2)} </span> 
                      <span>${item.lineItemTotal.toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t pt-6 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Subtotal:</p>
                  <p className="font-semibold">${quote.subtotal.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Shipping:</p>
                  <p className="font-semibold">${quote.shippingCost.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Tax:</p>
                  <p className="font-semibold">${quote.taxAmount.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center text-xl font-bold text-gray-800 mt-4">
                  <p>Grand Total:</p>
                  <p>${quote.grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handlePlaceOrder}
              className="w-full px-6 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition text-lg font-semibold disabled:opacity-50"
              disabled={!selectedPaymentMethod || loading}
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
