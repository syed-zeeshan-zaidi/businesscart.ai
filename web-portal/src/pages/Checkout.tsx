import React, { useEffect, useState } from 'react';
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
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  

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
      } catch (err: any) {
        toast.error(err.message || 'Failed to fetch quote details.');
        navigate('/cart');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [isAuthenticated, navigate, quoteId]);

  const handlePlaceOrder = async () => {
    if (!quote) {
      toast.error('No quote available to place an order.');
      return;
    }
    
    const token = paymentMethod === 'stripe' ? 'tok_stripe_valid' : 'amz_pay_valid';

    setLoading(true);
    const toastId = toast.loading('Placing your order...');
    try {
      await createOrder({ quoteId: quote.id, paymentMethod, paymentToken: token });
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
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Checkout</h1>
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Checkout</h1>
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Quote Summary</h2>
          <div className="divide-y divide-gray-200">
            {quote.items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <p className="text-lg font-semibold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-600">Subtotal:</p>
              <p className="font-semibold">${quote.subtotal.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-600">Shipping:</p>
              <p className="font-semibold">${quote.shippingCost.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600">Tax:</p>
              <p className="font-semibold">${quote.taxAmount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center text-xl font-bold text-gray-800">
              <p>Grand Total:</p>
              <p>${quote.grandTotal.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Details</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Payment Method</label>
              <div className="mt-2 flex items-center">
                <input
                  id="stripe"
                  name="payment-method"
                  type="radio"
                  value="stripe"
                  checked={paymentMethod === 'stripe'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="focus:ring-teal-500 h-4 w-4 text-teal-600 border-gray-300"
                />
                <label htmlFor="stripe" className="ml-3 block text-sm font-medium text-gray-700">
                  Stripe
                </label>
              </div>
              <div className="mt-2 flex items-center">
                <input
                  id="amazon_pay"
                  name="payment-method"
                  type="radio"
                  value="amazon_pay"
                  checked={paymentMethod === 'amazon_pay'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="focus:ring-teal-500 h-4 w-4 text-teal-600 border-gray-300"
                />
                <label htmlFor="amazon_pay" className="ml-3 block text-sm font-medium text-gray-700">
                  Amazon Pay
                </label>
              </div>
            </div>
            
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handlePlaceOrder}
              className="px-6 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition text-lg font-semibold"
            >
              Place Order
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
