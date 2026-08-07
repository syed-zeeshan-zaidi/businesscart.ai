// src/components/QuoteForm.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyQuotes, patchQuote } from '../api';
import { Quote } from '../types';
import Navbar from './Navbar';
import { MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const CACHE_KEY = 'quotes_cache';
const CACHE_DURATION = 30 * 60_000; // 30 min in ms
const QUOTES_PER_PAGE = 10;

/* ------------------------------------------------------------------ */
/*  Helper to extract current user from JWT                           */
/* ------------------------------------------------------------------ */
const getCurrentUser = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.user ?? null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
const QuoteForm = () => {
  /* ------------------------ State ------------------------ */
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const navigate = useNavigate();

  /* ------------------------ Derived ------------------------ */
  const currentUser = useMemo(() => getCurrentUser(), []);
  const companyId = currentUser?.role === 'company' ? currentUser?.id : undefined;

  // Quotes waiting on THIS person's own sign-off (Roadmap #21d). Matched on the
  // individual account, not the organisation: colleagues share an OrgID, so
  // matching that would put every seller's quote in everyone's queue.
  const awaitingMyApproval = useMemo(
    () =>
      quotes.filter(
        (q) =>
          q.status === 'pending_approval' &&
          q.approvalChain?.[q.approvalStage ?? 0]?.side === 'seller' &&
          (q.approvalChain?.[q.approvalStage ?? 0]?.approvers || []).some(
            (a) => a.accountId === currentUser?.id
          )
      ),
    [quotes, currentUser]
  );

  const filteredQuotes = useMemo(
    () =>
      (showPendingOnly ? awaitingMyApproval : quotes).filter((q) =>
        q.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [quotes, awaitingMyApproval, showPendingOnly, searchQuery]
  );

  const totalPages = Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE);
  const paginatedQuotes = useMemo(
    () =>
      filteredQuotes.slice(
        (currentPage - 1) * QUOTES_PER_PAGE,
        currentPage * QUOTES_PER_PAGE
      ),
    [filteredQuotes, currentPage]
  );

  /* ------------------------ Effects ------------------------ */
  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setQuotes(data ?? []);
          return;
        }
      }
      await fetchQuotes();
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------ Handlers ------------------------ */
  const fetchQuotes = useCallback(async () => {
    setIsLoading(true);
    try {
      // Assuming getMyQuotes can accept a companyId or works for the current user
      const data = await getMyQuotes(companyId);
      setQuotes(data ?? []);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Error fetching quotes'
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const handleViewDetails = (quoteId: string) => {
    navigate(`/quote-details/${quoteId}`);
  };

  // The seller's escape hatch when a buyer's approver never responds. Deliberate
  // and separate from Approve: the generic status path refuses a quote awaiting
  // approval precisely so an override cannot happen by accident.
  const handleForceRelease = async (quoteId: string) => {
    if (statusUpdatingId) return;
    if (!window.confirm('Release this order without the outstanding approval? Whoever is still to sign off will not have done so, and this is recorded on the order.')) return;
    setStatusUpdatingId(quoteId);
    try {
      const updatedQuote = await patchQuote(quoteId, 'forceReleaseApproval', {});
      setQuotes((prevQuotes) => prevQuotes.map((q) => (q.id === quoteId ? updatedQuote : q)));
      toast.success('Order released without buyer approval');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not release this order');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleUpdateStatus = async (quoteId: string, status: string) => {
    // Guard against a double-click firing two status changes at a quote the row
    // still shows as un-actioned. The second request used to be able to resolve
    // an order that the first had just handed to the buyer's approval chain.
    if (statusUpdatingId) return;
    setStatusUpdatingId(quoteId);
    try {
      const updatedQuote = await patchQuote(quoteId, 'updateStatus', { status });
      setQuotes((prevQuotes) =>
        prevQuotes.map((q) => (q.id === quoteId ? updatedQuote : q))
      );
      toast.success(`Quote ${status}`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Error updating quote status`
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  /* ------------------------ Render ------------------------ */
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Quotes</h1>
          {currentUser && (currentUser.role === 'company' || currentUser.role === 'admin') && (
            <button
              onClick={() => navigate('/quote-create')}
              className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
            >
              Create Quote
            </button>
          )}
        </header>

        {/* "Awaiting my approval" (Roadmap #21d). The seller-side mirror of the
            buyer's queue: without a list, an approver has no way to find what is
            sitting on them, which is the complaint levelled at Adobe Commerce. */}
        {awaitingMyApproval.length > 0 && (
          <section className="mb-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setShowPendingOnly((v) => !v);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                showPendingOnly
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
              }`}
            >
              Awaiting my approval ({awaitingMyApproval.length})
            </button>
            {showPendingOnly && (
              <span className="text-xs text-gray-500">Showing only quotes waiting on your decision.</span>
            )}
          </section>
        )}

        {/* Search */}
        <section className="mb-6">
          <label className="relative block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search quotes by ID..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </label>
        </section>

        {/* Table */}
        <section className="bg-white rounded-lg shadow-lg overflow-x-auto">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <span className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : paginatedQuotes.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No quotes found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[650px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grand Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account ID
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedQuotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quote.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quote.quoteType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${quote.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quote.sellerId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quote.accountId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(quote.id)}
                          className="text-teal-700 hover:text-teal-800"
                          aria-label={`View quote ${quote.id}`}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {currentUser && (currentUser.role === 'company' || currentUser.role === 'admin') && quote.status === 'pending_approval' && (
                          <button
                            onClick={() => handleForceRelease(quote.id)}
                            disabled={statusUpdatingId !== null}
                            title="An approver has not responded. Release the order anyway."
                            className="text-amber-600 hover:text-amber-800 ml-4 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            Release
                          </button>
                        )}
                        {currentUser && (currentUser.role === 'company' || currentUser.role === 'admin') && quote.status === 'proposed' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(quote.id, 'approved')}
                              disabled={statusUpdatingId !== null}
                              className="text-green-600 hover:text-green-800 ml-4 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(quote.id, 'rejected')}
                              disabled={statusUpdatingId !== null}
                              className="text-red-600 hover:text-red-800 ml-4 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-6 flex justify-end space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${
                  currentPage === i + 1
                    ? 'bg-teal-700 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        )}
      </main>
    </div>
  );
};

export default QuoteForm;