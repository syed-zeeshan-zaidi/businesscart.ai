import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { getCustomerAddresses, upsertCustomerAddress } from '../api';
import { useAuth } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { PageHeader, CARD, BTN_PRIMARY, Pill, Spinner } from '../components/ui';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { CustomerAddress } from '../types';

type User = { id: string; role: 'admin' | 'company' | 'customer'; email: string };

const Addresses: React.FC = () => {
  const { decodeJWT } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const initialFormState: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt' | 'updatedAt'> = {
    recipientName: '',
    phoneNumber: '',
    addressLabel: '',
    isDefaultShipping: false,
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
  };

  const [newAddress, setNewAddress] = useState(initialFormState);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) setUser(decodeJWT(token));
  }, [decodeJWT]);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const list = await getCustomerAddresses(user.id);
      setAddresses(list ?? []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to fetch addresses');
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user, fetchAddresses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const a = newAddress;
    if (!a.recipientName.trim() || !a.address.street.trim() || !a.address.city.trim() || !a.address.state.trim() || !a.address.zip.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsLoading(true);
    try {
      await upsertCustomerAddress(user.id, newAddress);
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
    setNewAddress(initialFormState);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'street' || name === 'city' || name === 'state' || name === 'zip') {
      setNewAddress((prev) => ({ ...prev, address: { ...prev.address, [name]: value } }));
    } else {
      setNewAddress((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  if (user && user.role !== 'customer') return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Shipping addresses" subtitle="Where your orders can be delivered.">
          <button onClick={() => setIsOpen(true)} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
            <PlusIcon className="h-5 w-5" /> Add address
          </button>
        </PageHeader>

        {isLoading && !isOpen ? (
          <div className="flex justify-center items-center py-12">
            <Spinner className="h-8 w-8 border-4" />
          </div>
        ) : addresses.length === 0 ? (
          <div className={`${CARD} mt-6 p-10 text-center`}>
            <h2 className="text-lg font-semibold text-gray-900">No addresses yet</h2>
            <p className="mt-1 text-sm text-gray-500">Add a shipping address so your orders have somewhere to go.</p>
          </div>
        ) : (
          <div className="mt-6 mb-20 grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((addr) => (
              <div key={addr.id} className={`${CARD} p-6`}>
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900">{addr.addressLabel || 'Address'}</h3>
                  {addr.isDefaultShipping && (
                    <Pill tone="teal">Default</Pill>
                  )}
                </div>
                <dl className="mt-4 space-y-2 text-sm text-gray-600">
                  <div>
                    <dt className="font-medium text-gray-800">Recipient</dt>
                    <dd>{addr.recipientName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-800">Address</dt>
                    <dd>{`${addr.address.street}, ${addr.address.city}, ${addr.address.state} ${addr.address.zip}`}</dd>
                  </div>
                  {addr.phoneNumber && (
                     <div>
                       <dt className="font-medium text-gray-800">Phone</dt>
                       <dd>{addr.phoneNumber}</dd>
                     </div>
                  )}
                </dl>
              </div>
            ))}
          </div>
        )}

        <Transition appear show={isOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={resetForm}>
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
                        name="recipientName"
                        value={newAddress.recipientName}
                        onChange={handleInputChange}
                        placeholder="Recipient name"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                      />
                      <input
                        name="phoneNumber"
                        value={newAddress.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="Phone number"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                      />
                      <input
                        name="addressLabel"
                        value={newAddress.addressLabel}
                        onChange={handleInputChange}
                        placeholder="Label (Home, Work...)"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          required
                          name="street"
                          value={newAddress.address.street}
                          onChange={handleInputChange}
                          placeholder="Street"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                        <input
                          required
                          name="city"
                          value={newAddress.address.city}
                          onChange={handleInputChange}
                          placeholder="City"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                        <input
                          required
                          name="state"
                          value={newAddress.address.state}
                          onChange={handleInputChange}
                          placeholder="State"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                        <input
                          required
                          name="zip"
                          value={newAddress.address.zip}
                          onChange={handleInputChange}
                          placeholder="ZIP"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>

                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          name="isDefaultShipping"
                          checked={newAddress.isDefaultShipping}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Set as default shipping address</span>
                      </label>

                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-4 py-2 bg-teal-700 text-white rounded-md text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
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
      <Footer />
    </div>
  );
};

export default Addresses;