import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BanknotesIcon, UserGroupIcon, PuzzlePieceIcon, CloudArrowUpIcon, CogIcon, ServerIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { ShoppingCartIcon } from '@heroicons/react/24/solid';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />

      <main>
        {/* Hero Section */}
        <div className="relative bg-gray-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative z-10 pt-16 pb-8 sm:pt-24 sm:pb-16 md:pt-32 md:pb-20 lg:max-w-2xl lg:w-full lg:pt-40 lg:pb-28 xl:pt-48 xl:pb-32">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="sm:text-center lg:text-left">
                  <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                    <span className="block xl:inline">Your Commerce,</span>{' '}
                    <span className="block text-teal-500 xl:inline">Your Rules.</span>
                  </h1>
                  <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                    Finally, a private B2B & D2C e-commerce platform that adapts to your business. Stop paying marketplace fees and start owning your customer experience.
                  </p>
                  <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                    <div className="rounded-md shadow">
                      <Link
                        to="/contact-us" // Or a dedicated demo request page
                        className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 md:py-4 md:text-lg md:px-10"
                      >
                        Request a Demo
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 flex items-center justify-center p-8">
            <ShoppingCartIcon className="h-auto w-full max-w-lg text-teal-600 opacity-20" />
          </div>
        </div>

        {/* Social Proof */}
        <div className="bg-gray-100 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-gray-600 tracking-wider uppercase">
                Trusted by businesses from Main Street to Enterprise
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-5">
                {/* Placeholder Logos */}
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-400 font-bold text-2xl">Manufacturers</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-400 font-bold text-2xl">Distributors</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-400 font-bold text-2xl">Retail</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-3 lg:col-span-1">
                  <p className="text-gray-400 font-bold text-2xl">Brands</p>
                </div>
                <div className="col-span-2 flex justify-center md:col-span-3 lg:col-span-1">
                  <p className="text-gray-400 font-bold text-2xl">Enterprise</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The Problem Section */}
        <div className="py-16 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Tired of the Marketplace Trap?</h2>
              <p className="mt-4 text-lg text-gray-500">
                Public marketplaces promised customers, but they delivered compromises. Your business is unique—your e-commerce should be too.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">High Commissions</h3>
                <p className="mt-2 text-base text-gray-500">
                  Stop giving away 15-30% of your revenue. With our simple, transparent pricing, you keep what you earn.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">No Customer Data</h3>
                <p className="mt-2 text-base text-gray-500">
                  Marketplaces own your customer data. We put it back in your hands, allowing you to build loyalty and market directly.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                  <PuzzlePieceIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">One-Size-Fits-All</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your brand, products, and pricing are forced into a generic template. Break free and create an experience that is 100% yours.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Who It's For Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Built for Your Business, Whatever Its Size.</h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {/* Card 1: Local Business */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900">For Local Businesses & D2C Brands</h3>
                <p className="mt-4 text-gray-600">
                  Perfect for restaurants, grocery stores, and direct-to-consumer brands who want to provide a modern, app-like ordering experience without the technical overhead.
                </p>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <BanknotesIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Escape High Fees:</span> Move away from commission-heavy delivery apps.
                    </p>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <CogIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Simple Setup:</span> Launch your private store with our easy-to-use default settings.
                    </p>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <UserCircleIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Own Your Customer List:</span> Build direct relationships and remarket to your loyal customers.
                    </p>
                  </li>
                </ul>
              </div>
              {/* Card 2: Enterprise */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900">For B2B & Enterprise</h3>
                <p className="mt-4 text-gray-600">
                  Designed for manufacturers, distributors, and large-scale operations that need to manage complex customer relationships and deep integrations.
                </p>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <ServerIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Deep ERP/CRM Integration:</span> Automate everything. Sync orders, inventory, and customer data seamlessly.
                    </p>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <UserGroupIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Per-Customer Portals:</span> Create unique e-commerce experiences for each client with custom catalogs and pricing.
                    </p>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0">
                      <CloudArrowUpIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">
                      <span className="font-semibold">Lower TCO:</span> Our modern, serverless architecture reduces infrastructure and maintenance costs.
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-white">
          <div className="max-w-4xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              <span className="block">Ready to Take Control of Your Commerce?</span>
            </h2>
            <p className="mt-4 text-lg leading-6 text-gray-500">
              Schedule a live, personalized demo with one of our platform experts today.
            </p>
            <Link
              to="/contact-us"
              className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 sm:w-auto"
            >
              Request Your Free Demo
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
