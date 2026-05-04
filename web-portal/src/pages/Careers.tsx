import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { GlobeAmericasIcon, BoltIcon, HeartIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const Careers: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">

        {/* Hero */}
        <div className="bg-gray-800 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Work With Us</h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              We are building the commerce platform we wish existed. If you care about craftsmanship, speed, and helping real businesses grow, we want to hear from you.
            </p>
          </div>
        </div>

        {/* Who We Are */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Who We Are</h2>
          <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
            <p>
              BusinessCart.ai is a US-based, remote-first company building an e-commerce platform that gives businesses their own branded store with a free Starter tier and premium options for full B2B. Our customers range from local restaurants to wholesale distributors.
            </p>
            <p>
              We move fast, stay lean, and focus on outcomes over process. Everyone who works here has a direct impact on the product and on the businesses that depend on it.
            </p>
          </div>
        </div>

        {/* How We Work */}
        <div className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How We Work</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mx-auto">
                  <GlobeAmericasIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Remote-First, US-Based</h3>
                <p className="mt-2 text-gray-500">Work from anywhere in the US. No office politics. We care about what you ship, not where you sit.</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mx-auto">
                  <BoltIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Ship Fast, Learn Faster</h3>
                <p className="mt-2 text-gray-500">We deploy to production multiple times a week. Short feedback loops, real customer impact, minimal bureaucracy.</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mx-auto">
                  <HeartIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Ownership, Not Tasks</h3>
                <p className="mt-2 text-gray-500">You own problems, not tickets. Everyone here has a direct line to the product and to the customers who use it.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Open Roles */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Open Roles</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            We do not always have formal openings, but we are always interested in meeting exceptional people. If you are an engineer, designer, or business operator who wants to build something that matters, reach out. Tell us what you are great at and why BusinessCart.ai interests you.
          </p>
          <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8 text-center">
            <p className="text-gray-600 mb-6">Send us your background and what excites you about commerce infrastructure.</p>
            <a
              href="mailto:help@businesscart.ai?subject=Career%20Inquiry%20-%20BusinessCart.ai"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
            >
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Get in Touch
            </a>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default Careers;
