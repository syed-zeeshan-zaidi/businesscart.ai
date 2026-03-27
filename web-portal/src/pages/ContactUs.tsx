import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { EnvelopeIcon, PhoneIcon, RocketLaunchIcon, PresentationChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ContactUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">

        {/* Hero */}
        <div className="bg-gray-800 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Get in Touch</h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              We are a US-based, remote-first team available across all US time zones. No overseas call centers — you talk directly to the people who build the platform.
            </p>
          </div>
        </div>

        {/* Contact Options */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Get Started */}
            <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8 flex flex-col">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-teal-700 text-white mx-auto">
                <RocketLaunchIcon className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mt-5 mb-4 text-center">Get Started</h2>
              <p className="text-gray-600 mb-6 text-center">
                Send us your company name and business email. No commitment, no credit card required.
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">We verify your business</span></div>
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">You receive a business code to register</span></div>
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">Guided setup — your store live in under 30 minutes</span></div>
              </div>
              <p className="text-gray-500 text-sm text-center mb-4">We respond within one business day.</p>
              <a
                href="mailto:help@businesscart.ai?subject=Get%20Started%20with%20BusinessCart.ai"
                className="mt-auto inline-flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                <EnvelopeIcon className="h-5 w-5 mr-2" />
                Get Started
              </a>
            </div>

            {/* Request a Demo */}
            <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8 flex flex-col">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-gray-800 text-white mx-auto">
                <PresentationChartBarIcon className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mt-5 mb-4 text-center">Request a Demo</h2>
              <p className="text-gray-600 mb-6 text-center">
                See the platform in action with a live walkthrough tailored to your business.
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">Portal, storefront, and B2B features</span></div>
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">Your industry-specific use cases</span></div>
                <div className="flex items-center"><CheckCircleIcon className="h-5 w-5 text-teal-700 mr-3 flex-shrink-0" /><span className="text-gray-600">Live Q&amp;A with our team</span></div>
              </div>
              <p className="text-gray-500 text-sm text-center mb-4">Include your availability and we will find a time.</p>
              <a
                href="mailto:help@businesscart.ai?subject=Demo%20Request%20-%20BusinessCart.ai"
                className="mt-auto inline-flex items-center justify-center w-full px-6 py-3 border-2 border-teal-700 text-base font-medium rounded-md text-teal-700 hover:bg-teal-700 hover:text-white transition"
              >
                <EnvelopeIcon className="h-5 w-5 mr-2" />
                Request a Demo
              </a>
            </div>
          </div>

          {/* Direct Contact */}
          <div className="mt-12 bg-white shadow-lg rounded-lg p-4 sm:p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Prefer to Talk?</h2>
            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
              <div className="flex items-center space-x-3">
                <PhoneIcon className="h-6 w-6 text-teal-700" />
                <div className="text-left">
                  <p className="text-sm text-gray-500">Call or text</p>
                  <a href="tel:+16575010200" className="text-lg font-semibold text-gray-900 hover:text-teal-700">+1 (657) 501-0200</a>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <EnvelopeIcon className="h-6 w-6 text-teal-700" />
                <div className="text-left">
                  <p className="text-sm text-gray-500">Email us anytime</p>
                  <a href="mailto:help@businesscart.ai" className="text-lg font-semibold text-gray-900 hover:text-teal-700">help@businesscart.ai</a>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default ContactUs;
