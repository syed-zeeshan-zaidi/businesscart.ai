import React, { useState, useEffect, useCallback } from 'react';
import { getLocations } from '../api';
import { useAuth } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';

const Locations: React.FC = () => {
  const { decodeJWT } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        setLocations(fetchedLocations || []); // Ensure it's always an array
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to fetch locations');
        setLocations([]); // Set to empty array on error
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Your Locations</h1>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
          </div>
        ) : locations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800">No Locations Found</h2>
            <p className="text-gray-600 mt-2">You have not added any locations yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loc.locationName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {loc.address.street}, {loc.address.city}, {loc.address.state} {loc.address.zip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Locations;