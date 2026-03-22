import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Quote as QuoteType, Account as AccountType, CompanyData } from '../types';
import { getMyQuotes, getAccount } from '../api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const QuoteHistory: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<QuoteType[]>([]);
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, companyCode: string, logoUrl?: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

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
      setQuotes(sortedQuotes.filter((q: QuoteType) => q.quoteType === 'negotiable'));
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

  const quotesToRender = quotes || [];

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quote History</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              className="bg-teal-700 text-white px-4 py-2 rounded-md hover:bg-teal-800 transition"
            >
              Refresh
            </button>
            {availableCompanies.length > 0 && (
              <div className="relative inline-block text-left w-full md:w-auto">
                <button
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="inline-flex items-center justify-between w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full"></div>
          </div>
        ) : quotesToRender.length > 0 ? (
          <div className="shadow-lg rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {quotesToRender.map((quote) => (
                <div key={quote.id} className="bg-white shadow rounded-lg p-6 mb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <div>
                      <p className="text-lg font-semibold text-gray-800">Quote ID: {quote.id}</p>
                      <p className="text-sm text-gray-500">Date: {new Date(quote.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-500">Company: {getCompanyName(quote.sellerId)}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-left sm:text-right">
                      Status:
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${quote.status === 'approved' ? 'bg-green-100 text-green-800' : quote.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {quote.status}
                      </span>
                      <p className="text-xl font-bold text-gray-800 mt-1">${quote.grandTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Items:</h4>
                    <div className="space-y-3">
                      {(quote.items || []).map((item) => (
                        <div key={item.productId} className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <span> - {item.name} (x{item.quantity})</span>
                          </div>
                          <span className="font-medium text-gray-800">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(quote.history?.length || 0) > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="font-semibold text-gray-700 mb-2">History:</h4>
                      <div className="space-y-3">
                        {(quote.history || []).map((entry, index) => (
                          <div key={index} className="flex items-center justify-between text-sm text-gray-600">
                            <span> - Status: {entry.status} at {new Date(entry.changedAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleViewQuote(quote.id)}
                      className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 transition"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {selectedCompanyId ? `No quotes found for ${selectedCompany?.name}` : 'You have no quotes.'}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedCompanyId ? 'There are no past quotes for this company.' : 'Request a quote now to see your quote history here!'}
            </p>
            <button
              onClick={() => navigate('/cart')}
              className="bg-teal-700 text-white px-6 py-2 rounded-md hover:bg-teal-800 transition"
            >
              Go to Cart
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default QuoteHistory;