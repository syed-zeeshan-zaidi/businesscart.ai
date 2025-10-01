import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const OrderSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-teal-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-3xl font-bold text-teal-600 mb-4">Order Placed Successfully!</h1>
            <p className="text-gray-700 mb-6">Thank you for your purchase. You will receive an email confirmation shortly.</p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Link
                to="/catalog"
                className="px-6 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition text-lg font-semibold"
              >
                Continue Shopping
              </Link>
              <Link
                to="/order-history"
                className="px-6 py-3 border border-teal-600 text-teal-600 rounded-md hover:bg-teal-50 transition text-lg font-semibold"
              >
                View Order History
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderSuccess;