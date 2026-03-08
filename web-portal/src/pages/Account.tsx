import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { Account as AccountType } from '../types';
import { getAccount } from '../api';
import AssociationModal from '../components/AssociationModal';

const LOCAL_KEY = 'account'; // <-- single key for localStorage

const Account: React.FC = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAssociationModalOpen, setIsAssociationModalOpen] = useState(false);

  /* fetch only when not cached */
  const fetchAccount = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const fetchedAccount = await getAccount(userId);
      setAccount(fetchedAccount);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(fetchedAccount));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load account details.');
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

    /* read localStorage */
    const cached = localStorage.getItem(LOCAL_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed._id === decodedUser.id) {
        setAccount(parsed);
        setLoading(false);
        return;
      }
    }

    /* fallback to network */
    fetchAccount(decodedUser.id);
  }, [isAuthenticated, navigate, decodeJWT, fetchAccount]);

  /* manual refresh */
  const handleRefresh = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const decoded = decodeJWT(token);
    if (decoded) fetchAccount(decoded.id);
  };

  const handleAssociationSuccess = () => {
    handleRefresh();
  };

  const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Your Account</h1>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {account?.role === 'customer' && (
              <button
                onClick={() => setIsAssociationModalOpen(true)}
                className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition"
              >
                Associate with Company
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
          </div>
        ) : account ? (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Account Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem label="Name" value={account.name} />
                <DetailItem label="Email" value={account.email} />
                <DetailItem label="Role" value={account.role} />
                <DetailItem label="Status" value={account.accountStatus} />
              </dl>
            </div>
            {account.company && (
              <div className="border-t border-gray-200">
                <div className="px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-800">Company Details</h3>
                  <dl className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <DetailItem label="Company Name" value={account.company.name} />
                    <DetailItem label="Company Status" value={account.company.status} />
                  </dl>
                </div>
              </div>
            )}
            {account.customer?.attachedCompanies && (
              <div className="border-t border-gray-200">
                <div className="px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-800">Associated Companies</h3>
                  <ul className="mt-2 space-y-4">
                    {account.customer.attachedCompanies.map((company) => (
                      <li key={company.companyCode} className="p-4 border rounded-md">
                        <h4 className="font-bold text-gray-900">{company.name} ({company.companyCode})</h4>
                        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <DetailItem label="Payment Methods" value={company.paymentMethods?.join(', ') || 'N/A'} />
                          <DetailItem label="Delivery Methods" value={company.deliveryMethods?.join(', ') || 'N/A'} />
                          <DetailItem label="Shipping Methods" value={company.shippingMethods?.join(', ') || 'N/A'} />
                          <DetailItem label="Sales Rep" value={company.saleRepresentative || 'N/A'} />
                          <DetailItem label="Credit Limit" value={company.creditLimit ? `$${company.creditLimit}` : 'N/A'} />
                          <DetailItem
                            label="Billing Address"
                            value={[
                              company.address?.street,
                              company.address?.city,
                              company.address?.state,
                              company.address?.zip
                            ].filter(Boolean).join(', ') || '—'}
                          />
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Could not load account details.</h2>
          </div>
        )}
      </main>
      <AssociationModal
        isOpen={isAssociationModalOpen}
        onClose={() => setIsAssociationModalOpen(false)}
        onAssociationSuccess={handleAssociationSuccess}
      />
      <Footer />
    </div>
  );
};

export default Account;