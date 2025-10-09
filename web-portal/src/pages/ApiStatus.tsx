import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const ApiStatus: React.FC = () => {
  const [services, setServices] = useState([
    { name: 'Accounts API', status: 'Operational' },
    { name: 'Products API', status: 'Operational' },
    { name: 'Orders API', status: 'Operational' },
    { name: 'Checkout API', status: 'Operational' },
    { name: 'Payment Gateway', status: 'Operational' },
    { name: 'Shipping Service', status: 'Operational' },
  ]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const updatedServices = services.map(service => {
        return { ...service, status: 'Operational' }; // Always set to Operational
      });
      setServices(updatedServices);
      setLastUpdated(new Date().toLocaleString());
      setLoading(false);
    }, 1500);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Operational':
        return 'bg-green-500';
      case 'Degraded Performance':
        return 'bg-yellow-500';
      case 'Partial Outage':
        return 'bg-orange-500';
      case 'Maintenance':
        return 'bg-blue-500';
      default:
        return 'bg-red-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">API Status</h1>
            <button
              onClick={fetchStatus}
              className="flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              disabled={loading}
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>
          {lastUpdated && (
            <p className="text-base text-gray-500 mb-6">Last Updated: {lastUpdated}</p>
          )}
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="ml-4 text-xl text-gray-600">Loading API Status...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <p className="text-xl font-semibold text-gray-800 mr-4">{service.name}</p>
                  <div className="flex items-center">
                    <div className={`h-4 w-4 rounded-full ${getStatusColor(service.status)}`}></div>
                    <p className="ml-4 text-xl text-gray-600">{service.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApiStatus;
