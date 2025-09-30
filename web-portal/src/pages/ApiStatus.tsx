import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const ApiStatus: React.FC = () => {
  const services = [
    { name: 'Accounts API', status: 'Operational' },
    { name: 'Products API', status: 'Operational' },
    { name: 'Orders API', status: 'Operational' },
    { name: 'Checkout API', status: 'Operational' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">API Status</h1>
          <div className="space-y-4">
            {services.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <p className="text-lg font-semibold text-gray-800">{service.name}</p>
                <div className="flex items-center">
                  <div className={`h-4 w-4 rounded-full ${service.status === 'Operational' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <p className="ml-2 text-gray-600">{service.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApiStatus;
