import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { getQuote, patchQuote } from '../api';
import { Quote, CartItem } from '../types';
import QuoteComments from '../components/QuoteComments';
import ApprovalChainPanel from '../components/ApprovalChainPanel';

const QuoteDetails: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposedPrices, setProposedPrices] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    };

    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    };

    const decodedUser = decodeJWT(token);
    if (!decodedUser || decodedUser.role !== 'customer') {
      toast.error('Access denied. Only customers can view quote details.');
      navigate('/home');
      return;
    };
    setCurrentUserId(decodedUser.id);

    const fetchQuote = async () => {
      if (!quoteId) {
        toast.error('Quote ID is missing.');
        setLoading(false);
        return;
      };
      setLoading(true);
      try {
        const fetchedQuote = await getQuote(quoteId);
        setQuote(fetchedQuote);
        // Initialize proposed prices with current item prices
        const initialProposedPrices: Record<string, number> = {};
        fetchedQuote.items.forEach(item => {
          initialProposedPrices[item.id] = item.proposedPrice || item.price;
        });
        setProposedPrices(initialProposedPrices);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load quote details');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [isAuthenticated, navigate, decodeJWT, quoteId]);

  const handleProceedToCheckout = () => {
    if (!quote) return;
    // Approvers can now open a colleague's quote, but only the buyer who owns it
    // can pay: POST /checkout/orders rejects anyone else with 403.
    if (quote.accountId !== currentUserId) {
      toast.error('Only the buyer who created this order can complete checkout.');
      return;
    }
    if (quote.status === 'approved') {
      navigate(`/checkout/${quote.id}`);
    } else {
      toast.error('Quote must be approved to proceed to checkout.');
    }
  };

  const handlePriceChange = (itemId: string, price: string) => {
    setProposedPrices({
      ...proposedPrices,
      [itemId]: parseFloat(price),
    });
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    const changes = Object.entries(proposedPrices).map(([itemId, proposedPrice]) => ({
      itemId,
      proposedPrice,
    }));

    try {
      const updatedQuote = await patchQuote(quote.id, 'customerPropose', { changes });
      setQuote(updatedQuote);
      toast.success('Proposal submitted successfully!');
    } catch (err: any) {
      console.error('Failed to submit proposal:', err);
      toast.error(err.response?.data?.message || 'Failed to submit proposal.');
    }
  };

  const handleCommentAdded = (updatedQuote: Quote) => {
    setQuote(updatedQuote);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quote not found</h2>
            <p className="text-gray-600 mb-4">The quote you are looking for does not exist or you do not have access.</p>
            <button
              onClick={() => navigate('/my-quotes')}
              className="bg-teal-700 text-white px-6 py-2 rounded-md hover:bg-teal-800 transition"
            >
              Back to My Quotes
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const canCustomerPropose = quote.quoteType === 'negotiable' && (quote.status === 'open' || quote.status === 'draft');

  const isQuoteOwner = quote.accountId === currentUserId;
  const canProceedToCheckout = isQuoteOwner && quote.status === 'approved';

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Quote Details</h1>

        <ApprovalChainPanel
          quote={quote}
          currentUserId={currentUserId}
          userRole="customer"
          onDecided={setQuote}
        />

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
              {quote.discountAmount !== undefined && quote.discountAmount > 0 && (
                <p className="text-gray-600"><strong>Discount ({quote.discountPercentage}%):</strong> -${quote.discountAmount.toFixed(2)}</p>
              )}
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
                    <p className="text-sm text-blue-600">Your Proposal: ${item.proposedPrice.toFixed(2)}</p>
                  )}
                </div>
                <p className="font-semibold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
              </li>
            ))}
          </ul>

          {canCustomerPropose && (
            <form onSubmit={handleSubmitProposal} className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Propose Changes</h2>
              <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Price</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Proposal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.items.map((item: CartItem) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${item.price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={proposedPrices[item.id] || ''}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          )}

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

          <QuoteComments quote={quote} onCommentAdded={handleCommentAdded} />

          {/* Only the owning buyer can pay. Approvers can now open a colleague's
              quote, and an enabled button would send them to a guaranteed 403.
              Kept visible but disabled with a reason, per the platform rule. */}
          <div
            className="flex justify-end mt-6"
            title={
              !isQuoteOwner
                ? 'Only the buyer who created this order can complete checkout.'
                : quote.status !== 'approved'
                  ? 'This order must be approved before it can be paid.'
                  : ''
            }
          >
            <button
              onClick={handleProceedToCheckout}
              className={`px-6 py-2 rounded-md transition ${canProceedToCheckout ? 'bg-teal-700 text-white hover:bg-teal-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              disabled={!canProceedToCheckout}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default QuoteDetails;