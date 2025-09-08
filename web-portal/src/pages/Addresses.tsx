import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { getLocations, upsertLocation } from '../api';
import { useAuth } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

type User = { id: string; role: 'admin' | 'company' | 'customer'; email: string };

const Addresses: React.FC = () => {
  const { decodeJWT } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  /* form state */
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [isDefaultShipping, setIsDefaultShipping] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) setUser(decodeJWT(token));
  }, [decodeJWT]);

  /* ---------- load addresses ---------- */
  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const list = await getLocations(user.id);
      setAddresses(list ?? []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to fetch addresses');
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAddresses();
  }, [user, fetchAddresses]);

  /* ---------- submit ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const payload = {
        recipientName,
        phoneNumber,
        addressLabel,
        isDefaultShipping,
        address: { street, city, state, zip },
      };
      await upsertLocation(user.id, payload);
      toast.success('Address saved');
      resetForm();
      fetchAddresses();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setRecipientName('');
    setPhoneNumber('');
    setAddressLabel('');
    setIsDefaultShipping(false);
    setStreet('');
    setCity('');
    setState('');
    setZip('');
    setIsOpen(false);
  };

  /* ---------- guards ---------- */
  if (user && user.role !== 'customer') return null;

  /* ---------- render ---------- */
return (
  <div className="min-h-screen bg-gray-100">
    <Toaster position="top-right" />
    <Navbar />

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* header + add button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Your Shipping Addresses</h1>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Address</span>
        </button>
      </div>

      {/* body */}
      {isLoading && !isOpen ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800">No Addresses Found</h2>
          <p className="text-gray-600 mt-2">You have not added any shipping addresses yet.</p>
        </div>
      ) : (
        /* ---- same table you already had ---- */
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {addresses.map((addr) => (
                <tr key={addr.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{addr.recipientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{addr.phoneNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{addr.addressLabel}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{addr.isDefaultShipping ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {addr.address.street}, {addr.address.city}, {addr.address.state} {addr.address.zip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

{/* ---------- modal ---------- */}
<Transition appear show={isOpen} as={Fragment}>
  <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed inset-0 bg-black bg-opacity-25" />
    </Transition.Child>

    <div className="fixed inset-0 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <Dialog.Panel className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
              Add Shipping Address
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone number"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
              <input
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                placeholder="Label (Home, Work...)"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Street"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <input
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <input
                  required
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="ZIP"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isDefaultShipping}
                  onChange={(e) => setIsDefaultShipping(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Set as default shipping address</span>
              </label>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </div>
  </Dialog>
</Transition>
    </main>
  </div>
);
};

export default Addresses;