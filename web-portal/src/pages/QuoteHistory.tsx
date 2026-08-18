import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Quote as QuoteType, Account as AccountType, CompanyData } from '../types';
import { getMyQuotes, getAccount } from '../api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { PageHeader, CARD, Pill, PillTone, Spinner, BTN_PRIMARY, BTN_SECONDARY } from '../components/ui';

const QUOTE_TONE: Record<string, PillTone> = {
  approved: 'green', ordered: 'teal', proposed: 'blue',
  open: 'amber', draft: 'gray', rejected: 'red',
  pending_approval: 'indigo',
};

const QuoteHistory: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<QuoteType[]>([]);
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string, logoUrl?: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const fetchQuotes = useCallback(async (companyId: string | null) => {
    if (!companyId) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fetchedQuotes = await getMyQuotes(companyId);
      const sortedQuotes = fetchedQuotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Negotiable quotes, PLUS anything carrying an approval chain. A standard
      // checkout held for approval (Roadmap #21) is not negotiable, so the old
      // filter alone would hide it from the buyer and from every approver.
      setQuotes(sortedQuotes.filter((q: QuoteType) => q.quoteType === 'negotiable' || !!q.approvalRequired));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load quotes.');
      setQuotes([]);
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

    const decodedUser = decodeJWT(token);
    if (!decodedUser) {
      toast.error('Could not decode user information.');
      navigate('/login');
      return;
    }
    setCurrentUserId(decodedUser.id);

    const loadCompaniesAndQuotes = async () => {
      try {
        const accountData = await getAccount(decodedUser.id);
        setAccount(accountData);
        
        if (accountData.customer?.attachedCompanies && accountData.customer.attachedCompanies.length > 0) {
          const companies = accountData.customer.attachedCompanies.map(company => ({
            id: company.companyCodeId || company._id || company.companyCode,
            name: company.name,
            companyCode: company.companyCode,
            logoUrl: company.logoUrl,
          }));
          
          setAvailableCompanies(companies);
          
          if (companies.length > 0) {
            const initialCompanyId = companies[0].id;
            setSelectedCompanyId(initialCompanyId);
            fetchQuotes(initialCompanyId);
          } else {
            setLoading(false);
          }
        } else {
          toast.error('No companies available.');
          setLoading(false);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load account data.');
        setLoading(false);
      }
    };

    loadCompaniesAndQuotes();

  }, [isAuthenticated, navigate, decodeJWT, fetchQuotes]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchQuotes(selectedCompanyId);
    }
  }, [selectedCompanyId, fetchQuotes]);

  // "Pending my approval" (Roadmap #21). Adobe Commerce is criticised for having
  // no way to list what is awaiting your sign-off; this is that list.
  const awaitingMyApproval = (quotes || []).filter(q =>
    q.status === 'pending_approval' &&
    (q.approvalChain?.[q.approvalStage ?? 0]?.approvers || []).some(a => a.accountId === currentUserId)
  );
  const quotesToRender = showPendingOnly ? awaitingMyApproval : (quotes || []);

  const handleRefresh = () => {
    if (selectedCompanyId) {
      fetchQuotes(selectedCompanyId);
    }
  };

  const getCompanyName = (sellerId: string) => {
    if (!account || !account.customer || !account.customer.attachedCompanies) {
      return sellerId;
    }
    const company = account.customer.attachedCompanies.find((c: CompanyData) => c.companyCode === sellerId || c._id === sellerId || c.companyCodeId === sellerId);
    return company ? company.name : sellerId;
  };

  const selectedCompany = availableCompanies.find(c => c.id === selectedCompanyId);

  const handleViewQuote = (quoteId: string) => {
    navigate(`/quote/${quoteId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Quote history" subtitle="Negotiated quotes across the companies you buy from.">
            <button onClick={handleRefresh} className={BTN_SECONDARY}>Refresh</button>
            {availableCompanies.length > 0 && (
              <div className="relative inline-block text-left">
                <button
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="inline-flex items-center justify-between rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <div className="flex items-center">
                    {selectedCompany?.logoUrl && (
                      <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-8 max-w-40 mr-3 rounded-full" />
                    )}
                    <span className="font-bold">{selectedCompany?.name || 'Select Company'}</span>
                  </div>
                  <ChevronDownIcon className="ml-2 -mr-1 h-5 w-5" />
                </button>
                {isCompanyDropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      {availableCompanies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => {
                            setSelectedCompanyId(company.id);
                            setIsCompanyDropdownOpen(false);
                          }}
                          className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                          role="menuitem"
                        >
                          {company.logoUrl && (
                            <img src={company.logoUrl} alt={company.name} className="h-8 max-w-40 mr-3 rounded-full" />
                          )}
                          {company.name} ({company.companyCode})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </PageHeader>

        {awaitingMyApproval.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowPendingOnly(!showPendingOnly)}
              className={showPendingOnly ? BTN_PRIMARY : BTN_SECONDARY}
            >
              Pending my approval ({awaitingMyApproval.length})
            </button>
            {showPendingOnly && (
              <button onClick={() => setShowPendingOnly(false)} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Show all quotes
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12 mt-6"><Spinner className="h-8 w-8 border-4" /></div>
        ) : quotesToRender.length > 0 ? (
          <div className="mt-6 space-y-4">
            {quotesToRender.map((quote) => (
              <div key={quote.id} className={`${CARD} p-5 sm:p-6`}>
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-gray-800">#{quote.id.slice(-6).toUpperCase()}</p>
                    <p className="text-sm text-gray-500 mt-1 tabular-nums">{new Date(quote.createdAt).toLocaleDateString()} · {getCompanyName(quote.sellerId)}</p>
                  </div>
                  <div className="text-right">
                    <Pill tone={QUOTE_TONE[quote.status] || 'amber'}>{quote.status}</Pill>
                    <p className="text-2xl font-extrabold tracking-tight text-gray-800 mt-1.5 tabular-nums">${quote.grandTotal.toFixed(2)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400 mb-2">Items</h4>
                  <div className="space-y-2">
                    {(quote.items || []).map((item) => (
                      <div key={item.productId} className="flex items-center justify-between text-sm text-gray-600 gap-2">
                        <span className="truncate">{item.name} <span className="text-gray-400 tabular-nums">×{item.quantity}</span></span>
                        <span className="font-semibold text-gray-800 tabular-nums shrink-0">${item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(quote.history?.length || 0) > 0 && (
                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400 mb-2">History</h4>
                    <div className="space-y-1.5">
                      {(quote.history || []).map((entry, index) => (
                        <div key={index} className="text-sm text-gray-500 tabular-nums">
                          {entry.status} · {new Date(entry.changedAt).toLocaleDateString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-4">
                  <button onClick={() => handleViewQuote(quote.id)} className={BTN_PRIMARY}>View details</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${CARD} p-10 text-center mt-6`}>
            <p className="text-sm font-semibold text-gray-700">
              {selectedCompanyId ? `No quotes for ${selectedCompany?.name}` : 'No quotes yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {selectedCompanyId ? 'Past quotes for this company will appear here.' : 'Request a quote to see your history here.'}
            </p>
            <button onClick={() => navigate('/cart')} className={BTN_PRIMARY}>Go to cart</button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default QuoteHistory;