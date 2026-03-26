import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const services = [
  { name: 'Online Storefronts', description: 'D2C storefront generation, hosting, and delivery' },
  { name: 'Product Catalog', description: 'Product management, images, and categories' },
  { name: 'Checkout & Payments', description: 'Cart, checkout, and payment processing' },
  { name: 'Account Management', description: 'User accounts, company setup, and authentication' },
  { name: 'B2B Configuration', description: 'Per-customer pricing, delivery, and payment settings' },
  { name: 'Order Management', description: 'Order placement, tracking, and history' },
];

const ApiStatus: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">

        {/* Hero */}
        <div className="bg-gray-800 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">System Status</h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              All systems are monitored around the clock. This page reflects the current operational status of the BusinessCart.ai platform.
            </p>
          </div>
        </div>

        {/* Status Banner */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex items-center justify-center space-x-3">
            <CheckCircleIcon className="h-8 w-8 text-green-600 flex-shrink-0" />
            <p className="text-lg font-semibold text-green-800">All Systems Operational</p>
          </div>
        </div>

        {/* Service List */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            {services.map((service, index) => (
              <div key={index} className={`flex items-center justify-between px-6 py-5 ${index < services.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div>
                  <p className="text-base font-semibold text-gray-900">{service.name}</p>
                  <p className="text-sm text-gray-500">{service.description}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-green-700">Operational</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report an Issue */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-white shadow-lg rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Experiencing an Issue?</h2>
            <p className="text-gray-600 mb-6">
              If something is not working as expected, let us know. Our US-based team investigates every report.
            </p>
            <a
              href="mailto:help@businesscart.ai?subject=Issue%20Report%20-%20BusinessCart.ai"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
            >
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Report an Issue
            </a>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default ApiStatus;
