import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from './Navbar';
import { useAuth } from '../hooks/useAuth';
import { getQuote, patchQuote } from '../api';
import { Quote, CartItem } from '../types';
import QuoteComments from './QuoteComments';

const QuoteDetailForm: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedItems, setEditedItems] = useState<CartItem[]>([]);
  const [newShippingCost, setNewShippingCost] = useState<number | undefined>(undefined);
  const [discountPercentage, setDiscountPercentage] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState<string | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);

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
      toast.error('Access denied. Only company or admin can view/edit quote details.');
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
        setEditedItems(fetchedQuote.items || []);
        setNewShippingCost(fetchedQuote.shippingCost);
        setDiscountPercentage(fetchedQuote.discountPercentage);
        setNotes(fetchedQuote.notes);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load quote details');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [isAuthenticated, navigate, decodeJWT, quoteId]);

  const handleItemChange = (index: number, field: keyof CartItem, value: any) => {
    const updatedItems = [...editedItems];
    (updatedItems[index] as any)[field] = value;
    setEditedItems(updatedItems);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    setLoading(true);
    try {
      const itemUpdates = editedItems.map(item => ({
        itemId: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const sellerUpdatePayload = {
        items: itemUpdates,
        newShippingCost: newShippingCost,
        notes: notes,
      };

      let updatedQuote = await patchQuote(quote.id, 'sellerUpdate', sellerUpdatePayload);

      if (discountPercentage !== undefined && discountPercentage !== quote.discountPercentage) {
        updatedQuote = await patchQuote(quote.id, 'applyDiscount', { discountPercentage });
      }

      // If the quote was proposed by the customer and the seller makes changes, revert status to 'open'
      if (quote.status === 'proposed') {
        updatedQuote = await patchQuote(quote.id, 'updateStatus', { status: 'open' });
      }
      
      setQuote(updatedQuote);
      setIsEditing(false);
      toast.success('Quote updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update quote');
      console.error('Failed to update quote:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!quote) return;
    setLoading(true);
    try {
      const updatedQuote = await patchQuote(quote.id, 'updateStatus', { status });
      setQuote(updatedQuote);
      toast.success(`Quote status updated to ${status} successfully!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to update quote status to ${status}`);
      console.error(`Failed to update quote status to ${status}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentAdded = (updatedQuote: Quote) => {
    setQuote(updatedQuote);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full"></div>
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
              className="bg-teal-700 text-white px-6 py-2 rounded-md hover:bg-teal-800 transition"
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

        <div className="bg-white shadow-lg rounded-lg overflow-hidden p-6 mb-6">
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
              {quote.discountAmount !== undefined && quote.discountAmount > 0 && (
                <p className="text-gray-600"><strong>Discount ({quote.discountPercentage}%):</strong> -${quote.discountAmount.toFixed(2)}</p>
              )}
              <p className="text-gray-600"><strong>Tax:</strong> ${quote.taxAmount.toFixed(2)}</p>
              <p className="text-xl font-bold text-gray-800">Grand Total: ${quote.grandTotal.toFixed(2)}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">Items</h2>
          <ul className="divide-y divide-gray-200 mb-6">
            {editedItems.map((item, index) => (
              <li key={item.id} className="py-4 flex justify-between items-center">
                <div className="flex-grow">
                  <p className="font-medium text-gray-800">{item.name}</p>
                  {isEditing ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                        className="w-20 p-1 border rounded-md text-sm"
                        min="1"
                      />
                      <span className="text-gray-600">x</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                        className="w-24 p-1 border rounded-md text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}, Unit Price: ${item.price.toFixed(2)}</p>
                  )}
                  {item.proposedPrice && item.proposedPrice !== item.price && (
                    <p className="text-sm text-blue-600">Customer Proposal: ${item.proposedPrice.toFixed(2)}</p>
                  )}
                </div>
                <p className="font-semibold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
              </li>
            ))}
          </ul>

          {isEditing && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-4">
                <label htmlFor="shippingCost" className="w-1/4 font-medium text-gray-700">Shipping Cost:</label>
                <input
                  type="number"
                  id="shippingCost"
                  value={newShippingCost}
                  onChange={(e) => setNewShippingCost(parseFloat(e.target.value))}
                  className="flex-grow p-2 border rounded-md"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label htmlFor="discountPercentage" className="w-1/4 font-medium text-gray-700">Discount (%):</label>
                <input
                  type="number"
                  id="discountPercentage"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(parseFloat(e.target.value))}
                  className="flex-grow p-2 border rounded-md"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex items-start space-x-4">
                <label htmlFor="notes" className="w-1/4 font-medium text-gray-700">Notes:</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-grow p-2 border rounded-md"
                  rows={3}
                ></textarea>
              </div>
            </div>
          )}

          {quote.history && quote.history.length > 0 && (
            <div className="mb-6">
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

          <QuoteComments quote={quote} onCommentAdded={handleCommentAdded} />

          <div className="flex justify-end space-x-4 mt-6">
            {!isEditing && (quote.status === 'open' || quote.status === 'proposed') && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 rounded-md transition bg-teal-700 text-white hover:bg-teal-800"
              >
                Edit Quote
              </button>
            )}
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset changes
                    setEditedItems(quote.items || []);
                    setNewShippingCost(quote.shippingCost);
                    setDiscountPercentage(quote.discountPercentage);
                    setNotes(quote.notes);
                  }}
                  className="px-6 py-2 rounded-md transition border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 rounded-md transition bg-teal-700 text-white hover:bg-teal-800"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            {!isEditing && quote.status === 'proposed' && (
              <>
                <button
                  onClick={() => handleUpdateStatus('approved')}
                  className="px-6 py-2 rounded-md transition bg-green-600 text-white hover:bg-green-700"
                  disabled={loading}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleUpdateStatus('rejected')}
                  className="px-6 py-2 rounded-md transition bg-red-600 text-white hover:bg-red-700"
                  disabled={loading}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuoteDetailForm;