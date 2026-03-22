import React, { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { associateCompany } from '../api';

interface AssociationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssociationSuccess: () => void;
}

const AssociationModal: React.FC<AssociationModalProps> = ({ isOpen, onClose, onAssociationSuccess }) => {
  const [customerCode, setCustomerCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerCode) {
      toast.error('Please enter a company code.');
      return;
    }
    setLoading(true);
    try {
      await associateCompany(customerCode);
      toast.success('Successfully associated with the company!');
      onAssociationSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to associate with the company.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <Toaster position="top-right" />
      <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Associate with a Company</h3>
          <form onSubmit={handleSubmit} className="mt-4">
            <input
              type="text"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              placeholder="Enter Company Code"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            />
            <div className="items-center px-4 py-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-teal-700 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {loading ? 'Associating...' : 'Associate'}
              </button>
            </div>
          </form>
          <div className="mt-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssociationModal;