import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { getLocations, upsertLocation, deleteLocation } from '../api';
import { useAuth } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import Navbar from './Navbar';

const LocationForm: React.FC = () => {
  const { decodeJWT } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newLocation, setNewLocation] = useState({
    locationName: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    contactPerson: '',
    phoneNumber: '',
    capacity: '',
    locationType: '',
    isDefault: false,
    recipientName: '',
    addressLabel: '',
    isDefaultShipping: false,
  });
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const locationsPerPage = 10;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decodedUser = decodeJWT(token);
      setUser(decodedUser);
    }
  }, [decodeJWT]);

  const fetchLocations = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      try {
        const fetchedLocations = await getLocations(user.id);
        setLocations(fetchedLocations || []);
        setFilteredLocations(fetchedLocations || []);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to fetch locations');
        setLocations([]);
        setFilteredLocations([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLocations();
    }
  }, [user, fetchLocations]);

  useEffect(() => {
    const filtered = locations.filter((location) =>
      (location.locationName || location.recipientName).toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLocations(filtered);
    setCurrentPage(1);
  }, [searchQuery, locations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    if (name in newLocation.address) {
      setNewLocation((prev) => ({
        ...prev,
        address: { ...prev.address, [name]: value },
      }));
    } else if (type === 'checkbox') {
      setNewLocation((prev) => ({ ...prev, [name]: checked }));
    } else {
      setNewLocation((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      setIsLoading(true);
      try {
        let payload: any = {
          address: newLocation.address,
        };

        if (user.role === 'company') {
          payload = {
            ...payload,
            locationName: newLocation.locationName,
            contactPerson: newLocation.contactPerson,
            phoneNumber: newLocation.phoneNumber,
            capacity: newLocation.capacity,
            locationType: newLocation.locationType,
            isDefault: newLocation.isDefault,
          };
        } else if (user.role === 'customer') {
          payload = {
            ...payload,
            recipientName: newLocation.recipientName,
            phoneNumber: newLocation.phoneNumber,
            addressLabel: newLocation.addressLabel,
            isDefaultShipping: newLocation.isDefaultShipping,
          };
        }
        
        if (editingId) {
            payload.id = editingId;
        }

        await upsertLocation(user.id, payload);
        toast.success(`Location ${editingId ? 'updated' : 'saved'} successfully!`);
        fetchLocations();
        closeModal();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to save location');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEdit = (location: any) => {
    setEditingId(location.id);
    setNewLocation({
      locationName: location.locationName || '',
      address: {
        street: location.address.street || '',
        city: location.address.city || '',
        state: location.address.state || '',
        zip: location.address.zip || '',
      },
      contactPerson: location.contactPerson || '',
      phoneNumber: location.phoneNumber || '',
      capacity: location.capacity || '',
      locationType: location.locationType || '',
      isDefault: location.isDefault || false,
      recipientName: location.recipientName || '',
      addressLabel: location.addressLabel || '',
      isDefaultShipping: location.isDefaultShipping || false,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!locationToDelete || !user) return;
    setIsLoading(true);
    try {
      await deleteLocation(user.id, locationToDelete);
      toast.success('Location deleted successfully');
      fetchLocations();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete location');
    } finally {
      setIsDeleteConfirmOpen(false);
      setLocationToDelete(null);
      setIsLoading(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setLocationToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const openModal = () => {
    setEditingId(null);
    setNewLocation({
      locationName: '',
      address: { street: '', city: '', state: '', zip: '' },
      contactPerson: '',
      phoneNumber: '',
      capacity: '',
      locationType: '',
      isDefault: false,
      recipientName: '',
      addressLabel: '',
      isDefaultShipping: false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // Pagination
  const indexOfLastLocation = currentPage * locationsPerPage;
  const indexOfFirstLocation = indexOfLastLocation - locationsPerPage;
  const currentLocations = filteredLocations.slice(indexOfFirstLocation, indexOfLastLocation);
  const totalPages = Math.ceil(filteredLocations.length / locationsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Manage Locations</h2>
          <button
            onClick={openModal}
            className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add Location</span>
          </button>
        </div>

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
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800">No Locations Found</h2>
            <p className="text-gray-600 mt-2">You have not added any locations yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Name</th>
                    {user?.role === 'company' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                      </>
                    )}
                    {user?.role === 'customer' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address Label</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default Shipping</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentLocations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loc.locationName || loc.recipientName}</td>
                      {user?.role === 'company' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.contactPerson}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.phoneNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.capacity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.locationType}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.isDefault ? 'Yes' : 'No'}</td>
                        </>
                      )}
                      {user?.role === 'customer' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.recipientName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.phoneNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.addressLabel}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loc.isDefaultShipping ? 'Yes' : 'No'}</td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {loc.address.street}, {loc.address.city}, {loc.address.state} {loc.address.zip}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(loc)}
                          className="text-yellow-600 hover:text-yellow-800 mr-4"
                          aria-label={`Edit ${loc.locationName || loc.recipientName}`}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(loc.id)}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Delete ${loc.locationName || loc.recipientName}`}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="mt-6 flex justify-end space-x-2">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => paginate(i + 1)}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${
                  currentPage === i + 1 ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {editingId ? 'Edit Location' : 'Add New Location'}
                  </Dialog.Title>
                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {user?.role === 'company' && (
                      <>
                        <div>
                          <label htmlFor="locationName" className="block text-sm font-medium text-gray-700">Location Name</label>
                          <input
                            type="text"
                            name="locationName"
                            id="locationName"
                            value={newLocation.locationName}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">Contact Person</label>
                          <input
                            type="text"
                            name="contactPerson"
                            id="contactPerson"
                            value={newLocation.contactPerson}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="text"
                            name="phoneNumber"
                            id="phoneNumber"
                            value={newLocation.phoneNumber}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">Capacity</label>
                          <input
                            type="text"
                            name="capacity"
                            id="capacity"
                            value={newLocation.capacity}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="locationType" className="block text-sm font-medium text-gray-700">Location Type</label>
                          <input
                            type="text"
                            name="locationType"
                            id="locationType"
                            value={newLocation.locationType}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            name="isDefault"
                            id="isDefault"
                            checked={newLocation.isDefault}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">Set as Default Location</label>
                        </div>
                      </>
                    )}
                    {user?.role === 'customer' && (
                      <>
                        <div>
                          <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700">Recipient Name</label>
                          <input
                            type="text"
                            name="recipientName"
                            id="recipientName"
                            value={newLocation.recipientName}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="text"
                            name="phoneNumber"
                            id="phoneNumber"
                            value={newLocation.phoneNumber}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="addressLabel" className="block text-sm font-medium text-gray-700">Address Label</label>
                          <input
                            type="text"
                            name="addressLabel"
                            id="addressLabel"
                            value={newLocation.addressLabel}
                            onChange={handleInputChange}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            name="isDefaultShipping"
                            id="isDefaultShipping"
                            checked={newLocation.isDefaultShipping}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isDefaultShipping" className="ml-2 block text-sm text-gray-900">Set as Default Shipping Address</label>
                        </div>
                      </>
                    )}
                    <div>
                      <label htmlFor="street" className="block text-sm font-medium text-gray-700">Street</label>
                      <input
                        type="text"
                        name="street"
                        id="street"
                        value={newLocation.address.street}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                        <input
                          type="text"
                          name="city"
                          id="city"
                          value={newLocation.address.city}
                          onChange={handleInputChange}
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus.border-teal-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
                        <input
                          type="text"
                          name="state"
                          id="state"
                          value={newLocation.address.state}
                          onChange={handleInputChange}
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus.border-teal-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="zip" className="block text-sm font-medium text-gray-700">Zip Code</label>
                        <input
                          type="text"
                          name="zip"
                          id="zip"
                          value={newLocation.address.zip}
                          onChange={handleInputChange}
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus.border-teal-500"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                      >
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Delete Location
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this location? This action cannot be undone.
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
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
