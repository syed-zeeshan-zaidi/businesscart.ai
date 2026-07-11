/* LocationForm.tsx  –  COMPANY ONLY */
import React, { useState, useEffect, useCallback, Fragment } from 'react';
import {
  getCompanyLocations,
  upsertCompanyLocation,
  deleteCompanyLocation,
} from '../api';
import { useAuth } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { PageHeader, CARD, TH, ROW_HOVER, Pill, Spinner, BTN_PRIMARY } from './ui';
import { Dialog, Transition } from '@headlessui/react';
import Navbar from './Navbar';
import { Account, CompanyLocation } from '../types';

const LocationForm: React.FC = () => {
  const { decodeJWT } = useAuth();

  const [user, setUser] = useState<{ id: string; role: 'admin' | 'company' | 'customer'; email: string } | null>(null);
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([]);

  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<CompanyLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const initialCompanyLocationState: Omit<CompanyLocation, 'id' | 'companyId' | 'createdAt' | 'updatedAt'> = {
    locationName: '',
    address: { street: '', city: '', state: '', zip: '' },
    contactPerson: '',
    phoneNumber: '',
    capacity: '',
    locationType: '',
    isDefault: false,
    operatingHours: '',
  };

  const [newLocation, setNewLocation] = useState(initialCompanyLocationState);

  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const locationsPerPage = 10;

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (t) setUser(decodeJWT(t));
  }, [decodeJWT]);

  useEffect(() => {
    if (user?.role === 'admin') {
      try {
        const raw = localStorage.getItem('accounts_cache');
        if (raw) {
          const { data } = JSON.parse(raw);
          const companies = (data as Account[]).filter((a) => a.role === 'company');
          setCompanyList(companies.map((c) => ({ id: c._id, name: c.company?.name || c.email })));
        }
      } catch {
        toast.error('Could not load companies from cache');
      }
    }
  }, [user]);

  const accountID = user?.role === 'admin' ? targetAccount : user?.id ?? '';

  const fetchLocations = useCallback(async () => {
    if (!accountID) return;
    setIsLoading(true);
    try {
      const list = await getCompanyLocations(accountID);
      setLocations(list ?? []);
      setFilteredLocations(list ?? []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to fetch locations');
      setLocations([]);
      setFilteredLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountID]);

  useEffect(() => {
    if (accountID) {
      fetchLocations();
    }
  }, [accountID, fetchLocations]);

  useEffect(() => {
    const filtered = locations.filter((l) =>
      l.locationName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLocations(filtered);
    setCurrentPage(1);
  }, [searchQuery, locations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name in newLocation.address) {
      setNewLocation((p) => ({ ...p, address: { ...p.address, [name]: value } }));
    } else if (type === 'checkbox') {
      setNewLocation((p) => ({ ...p, [name]: checked }));
    } else {
      setNewLocation((p) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountID) return;
    setIsLoading(true);
    try {
      const payload: Partial<CompanyLocation> = { ...newLocation };
      if (editingId) payload.id = editingId;
      await upsertCompanyLocation(accountID, payload);

      toast.success(`Location ${editingId ? 'updated' : 'saved'} successfully!`);
      fetchLocations();
      closeModal();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!locationToDelete || !accountID) return;
    setIsLoading(true);
    try {
      await deleteCompanyLocation(accountID, locationToDelete);
      toast.success('Location deleted');
      fetchLocations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setIsDeleteConfirmOpen(false);
      setLocationToDelete(null);
      setIsLoading(false);
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewLocation(initialCompanyLocationState);
  };
  const openDeleteConfirm = (id: string) => {
    setLocationToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleEdit = (location: CompanyLocation) => {
    setEditingId(location.id);
    setNewLocation(location);
    setIsModalOpen(true);
  };

  const idxLast = currentPage * locationsPerPage;
  const idxFirst = idxLast - locationsPerPage;
  const current = filteredLocations.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(filteredLocations.length / locationsPerPage);

  if (user && user.role === 'customer') return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <PageHeader title="Locations" subtitle="Pickup and warehouse locations for your storefront.">
          <button onClick={openModal} className={`${BTN_PRIMARY} flex items-center gap-1`}>
            <PlusIcon className="h-4 w-4" /> Add location
          </button>
        </PageHeader>

        {user?.role === 'admin' && (
          <div className="mt-6 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select company</label>
            <select
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value)}
              className="w-full sm:w-64 p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="" disabled>-- choose --</option>
              {companyList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner className="h-8 w-8 border-4" /></div>
        ) : !accountID ? (
          <div className={`${CARD} p-10 text-center text-gray-500 text-sm`}>Please select a company first.</div>
        ) : current.length === 0 ? (
          <div className={`${CARD} p-10 text-center text-gray-500 text-sm`}>No locations found.</div>
        ) : (
          <>
            <div className={`${CARD} overflow-x-auto`}>
              <table className="min-w-[800px] w-full text-sm">
                <thead>
                  <tr>
                    <th className={`${TH} text-left`}>Location</th>
                    <th className={`${TH} text-left`}>Contact</th>
                    <th className={`${TH} text-left`}>Phone</th>
                    <th className={`${TH} text-left`}>Capacity</th>
                    <th className={`${TH} text-left`}>Type</th>
                    <th className={`${TH} text-left`}>Default</th>
                    <th className={`${TH} text-left`}>Address</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {current.map((loc) => (
                    <tr key={loc.id} className={ROW_HOVER}>
                      <td className="px-6 py-3 whitespace-nowrap font-semibold text-gray-800">{loc.locationName}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">{loc.contactPerson}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600 tabular-nums">{loc.phoneNumber}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">{loc.capacity}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">{loc.locationType}</td>
                      <td className="px-6 py-3 whitespace-nowrap">{loc.isDefault ? <Pill tone="teal">Default</Pill> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                        {loc.address.street}, {loc.address.city}, {loc.address.state} {loc.address.zip}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <button onClick={() => handleEdit(loc)} className="text-yellow-600 hover:bg-yellow-50 rounded p-2 mr-1" title="Edit">
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => openDeleteConfirm(loc.id)} className="text-red-600 hover:bg-red-50 rounded p-2" title="Delete">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredLocations.length > 0 && (
              <div className="mt-4 text-sm text-gray-500">
                Showing {idxFirst + 1}-{Math.min(idxLast, filteredLocations.length)} of {filteredLocations.length} locations
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1 border rounded text-sm ${currentPage === i + 1 ? 'bg-teal-700 text-white' : 'hover:bg-gray-50'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">{editingId ? 'Edit Location' : 'Add New Location'}</Dialog.Title>
                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location Name</label>
                      <input name="locationName" value={newLocation.locationName} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                      <input name="contactPerson" value={newLocation.contactPerson} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <input name="phoneNumber" value={newLocation.phoneNumber} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Capacity</label>
                      <input name="capacity" value={newLocation.capacity} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location Type</label>
                      <input name="locationType" value={newLocation.locationType} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" name="isDefault" checked={newLocation.isDefault} onChange={handleInputChange} className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded" />
                      <label className="ml-2 block text-sm text-gray-900">Set as Default Location</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Street</label>
                      <input name="street" value={newLocation.address.street} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <input name="city" value={newLocation.address.city} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">State</label>
                        <input name="state" value={newLocation.address.state} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Zip Code</label>
                        <input name="zip" value={newLocation.address.zip} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500" />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" disabled={isLoading} className="px-4 py-2 bg-teal-700 text-white rounded-md text-sm font-medium hover:bg-teal-800 disabled:opacity-50">
                        {isLoading ? 'Saving...' : editingId ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isDeleteConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteConfirmOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">Delete Location</Dialog.Title>
                  <div className="mt-2"><p className="text-sm text-gray-500">Are you sure? This action cannot be undone.</p></div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="button" onClick={handleDelete} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                      {isLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default LocationForm;
