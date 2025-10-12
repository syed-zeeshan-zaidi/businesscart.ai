// src/components/QuoteForm.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyQuotes, updateQuoteStatus } from '../api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  /* ------------------------ Derived ------------------------ */
  const currentUser = useMemo(() => getCurrentUser(), []);
  const companyId = currentUser?.role === 'company' ? currentUser?.id : undefined;

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((q) =>
        q.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [quotes, searchQuery]
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

  const handleUpdateStatus = async (quoteId: string, status: string) => {
    try {
      const updatedQuote = await updateQuoteStatus(quoteId, status);
      setQuotes((prevQuotes) =>
        prevQuotes.map((q) => (q.id === quoteId ? updatedQuote : q))
      );
      toast.success(`Quote ${status}`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Error updating quote status`
      );
    }
  };

  /* ------------------------ Render ------------------------ */
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Quotes</h1>
        </header>

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
        <section className="bg-white rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <span className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : paginatedQuotes.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No quotes found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quote ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {quote.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quote.status}
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
                          className="text-teal-600 hover:text-teal-800"
                          aria-label={`View quote ${quote.id}`}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {currentUser && (currentUser.role === 'company' || currentUser.role === 'admin') && quote.status === 'proposed' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(quote.id, 'approved')}
                              className="text-green-600 hover:text-green-800 ml-4"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(quote.id, 'rejected')}
                              className="text-red-600 hover:text-red-800 ml-4"
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
                    ? 'bg-teal-600 text-white'
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