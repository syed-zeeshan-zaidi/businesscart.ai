import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from './Navbar';
import { useAuth } from '../hooks/useAuth';
import { getQuote, updateQuoteStatus } from '../api';
import { Quote } from '../types';

const QuoteDetailForm: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!decodedUser || (decodedUser.role !== 'company' && decodedUser.role !== 'admin')) {
      toast.error('Access denied. Only company or admin can view quote details.');
      navigate('/dashboard');
      return;
    }

    const fetchQuote = async () => {
      if (!quoteId) {
        toast.error('Quote ID is missing.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fetchedQuote = await getQuote(quoteId);
        setQuote(fetchedQuote);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load quote details');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [isAuthenticated, navigate, decodeJWT, quoteId]);

  const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (!quote) return;
    try {
      const updatedQuote = await updateQuoteStatus(quote.id, status);
      setQuote(updatedQuote);
      toast.success(`Quote ${status} successfully!`);
    } catch (error) {
      console.error(`Failed to ${status} quote:`, error);
      toast.error(`Failed to ${status} quote.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quote not found</h2>
            <p className="text-gray-600 mb-4">The quote you are looking for does not exist or you do not have access.</p>
            <button
              onClick={() => navigate('/quotes')}
              className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 transition"
            >
              Back to Quotes
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Quote Details</h1>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-gray-600"><strong>Quote ID:</strong> {quote.id}</p>
              <p className="text-gray-600"><strong>Status:</strong> <span className={`font-medium ${quote.status === 'approved' ? 'text-green-600' : quote.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{quote.status}</span></p>
              <p className="text-gray-600"><strong>Type:</strong> {quote.quoteType}</p>
              <p className="text-gray-600"><strong>Created At:</strong> {new Date(quote.createdAt).toLocaleDateString()}</p>
              <p className="text-gray-600"><strong>Expires At:</strong> {new Date(quote.expiresAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600"><strong>Account ID:</strong> {quote.accountId}</p>
              <p className="text-gray-600"><strong>Seller ID:</strong> {quote.sellerId}</p>
              <p className="text-gray-600"><strong>Subtotal:</strong> ${quote.subtotal.toFixed(2)}</p>
              <p className="text-gray-600"><strong>Shipping:</strong> ${quote.shippingCost.toFixed(2)}</p>
              <p className="text-gray-600"><strong>Tax:</strong> ${quote.taxAmount.toFixed(2)}</p>
              <p className="text-xl font-bold text-gray-800">Grand Total: ${quote.grandTotal.toFixed(2)}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">Items</h2>
          <ul className="divide-y divide-gray-200 mb-6">
            {quote.items.map((item) => (
              <li key={item.id} className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{item.name} (x{item.quantity})</p>
                  <p className="text-sm text-gray-600">Unit Price: ${item.price.toFixed(2)}</p>
                  {item.proposedPrice && item.proposedPrice !== item.price && (
                    <p className="text-sm text-blue-600">Customer Proposal: ${item.proposedPrice.toFixed(2)}</p>
                  )}
                </div>
                <p className="font-semibold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
              </li>
            ))}
          </ul>

          {quote.history && quote.history.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Quote History</h2>
              <ul className="divide-y divide-gray-200">
                {quote.history.map((entry, index) => (
                  <li key={index} className="py-2">
                    <p className="text-sm text-gray-600"><strong>Status:</strong> {entry.status} on {new Date(entry.changedAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quote.status === 'proposed' && (
            <div className="flex justify-end mt-6">
              <button
                onClick={() => handleUpdateStatus('approved')}
                className="mr-4 px-6 py-2 rounded-md transition bg-green-600 text-white hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                className="px-6 py-2 rounded-md transition bg-red-600 text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default QuoteDetailForm;