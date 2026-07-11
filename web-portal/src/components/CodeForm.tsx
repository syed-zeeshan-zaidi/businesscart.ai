import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getCodes, createCodes, deleteCode } from '../api';
import Navbar from './Navbar';
import { TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, CARD, TH, TD, ROW_HOVER, Pill, BTN_PRIMARY } from './ui';

const CodeForm: React.FC = () => {
  const [codes, setCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const { decodeJWT } = useAuth();
  const hasFetched = useRef(false);

  const token = localStorage.getItem('accessToken');
  const user = useMemo(() => (token ? decodeJWT(token) : null), [token, decodeJWT]);

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const data = await getCodes();
      const sorted = [...data].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCodes(sorted);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch codes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && !hasFetched.current) {
      fetchCodes();
      hasFetched.current = true;
    }
  }, [user]);

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setCompanyCode('');
    setCustomerCode('');
    setPartnerCode('');
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setCompanyCode('');
    setCustomerCode('');
    setPartnerCode('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (code: any) => {
    setEditingId(code.id || code._id || null);
    setCompanyCode(code.companyCode || '');
    setCustomerCode(code.customerCode || '');
    setPartnerCode(code.partnerCode || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Frontend guard: in create mode, refuse a companyCode that already exists.
    if (!editingId) {
      const duplicate = codes.some((c: any) => c.companyCode === companyCode);
      if (duplicate) {
        toast.error('A code with this companyCode already exists. Use Edit on that row to modify it.');
        return;
      }
    }
    try {
      await createCodes({ companyCode, customerCode, partnerCode });
      toast.success(editingId ? 'Code updated successfully!' : 'Code created successfully!');
      fetchCodes();
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (editingId ? 'Failed to update code' : 'Failed to create code'));
    }
  };

  const handleDeleteCode = async (companyCode: string) => {
    if (!window.confirm(`Delete code "${companyCode}" and its associated customer/partner codes?`)) return;
    try {
      await deleteCode(companyCode);
      toast.success('Code deleted');
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete code');
    }
  };

  if (!user || user.role !== 'admin') {
    return <div>You are not authorized to view this page.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <PageHeader title="Codes" subtitle="Registration codes that link customers, companies, and partners to an account.">
          <button onClick={handleOpenCreate} className={BTN_PRIMARY}>Create code</button>
        </PageHeader>

        {codes.length === 0 ? (
          <div className={`${CARD} p-10 text-center mt-6`}>
            <p className="text-sm font-semibold text-gray-700">No codes yet</p>
            <p className="text-sm text-gray-500 mt-1">Create your first code to onboard a company.</p>
          </div>
        ) : (
          <div className={`${CARD} overflow-x-auto mt-6`}>
            <table className="min-w-[500px] w-full text-sm">
              <thead>
                <tr>
                  <th className={`${TH} text-left`}>Company code</th>
                  <th className={`${TH} text-left`}>Customer code</th>
                  <th className={`${TH} text-left hidden sm:table-cell`}>Partner code</th>
                  <th className={`${TH} text-left`}>Status</th>
                  <th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className={ROW_HOVER}>
                    <td className={`${TD} whitespace-nowrap font-mono text-xs font-semibold text-gray-800`}>{code.companyCode}</td>
                    <td className={`${TD} whitespace-nowrap font-mono text-xs text-gray-500`}>{code.customerCode}</td>
                    <td className={`${TD} whitespace-nowrap font-mono text-xs text-gray-500 hidden sm:table-cell`}>{code.partnerCode || '—'}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Pill tone={code.isClaimed ? 'gray' : 'green'}>{code.isClaimed ? 'Claimed' : 'Open'}</Pill>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      <button onClick={() => handleOpenEdit(code)} className="text-gray-500 hover:bg-gray-100 rounded p-2 mr-1" title="Edit">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteCode(code.companyCode)} className="text-red-600 hover:bg-red-50 rounded p-2" title="Delete">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit} className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{editingId ? 'Edit code' : 'Create a new code'}</h3>
                <div className="mt-2">
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="companyCode">
                      Company Code{editingId ? ' (locked)' : ''}
                    </label>
                    <input
                      className={`shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline ${editingId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-gray-700'}`}
                      id="companyCode"
                      type="text"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value)}
                      disabled={!!editingId}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customerCode">
                      Customer Code{editingId ? ' (locked)' : ''}
                    </label>
                    <input
                      className={`shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline ${editingId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-gray-700'}`}
                      id="customerCode"
                      type="text"
                      value={customerCode}
                      onChange={(e) => setCustomerCode(e.target.value)}
                      disabled={!!editingId}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="partnerCode">
                      Partner Code (Optional)
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="partnerCode"
                      type="text"
                      value={partnerCode}
                      onChange={(e) => setPartnerCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-teal-700 text-base font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingId ? 'Save' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeForm;
