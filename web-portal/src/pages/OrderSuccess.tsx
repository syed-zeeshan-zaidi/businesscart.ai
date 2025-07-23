
import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const OrderSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-4">Order Placed Successfully!</h1>
          <p className="text-gray-700 mb-6">Thank you for your purchase. You will receive an email confirmation shortly.</p>
          <Link
            to="/home"
            className="px-6 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition text-lg font-semibold"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    </div>
  );
};

export default OrderSuccess;
