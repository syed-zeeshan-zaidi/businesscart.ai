import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Toaster } from 'react-hot-toast';

const ContactUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Request a Business Code Section */}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Request a Business Code</h1>
              <p className="text-gray-600 mb-4">
                To request a business code for your company, please send an email to our onboarding team with the following information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li><b>Company Name:</b> Your full legal company name.</li>
                <li><b>Address:</b> Your company's full street address, city, state, and ZIP code.</li>
                <li><b>EIN:</b> Your company's Employer Identification Number.</li>
                <li><b>Phone Number:</b> Your company's primary contact phone number.</li>
              </ul>
              <p className="text-gray-600 mb-8">
                Please note that onboarding requires additional documentation, which our team will guide you through after receiving your initial request.
              </p>
              <p className="text-gray-600">
                Please send your email to: <a href="mailto:onboarding@businesscart.com" className="text-teal-600 hover:underline">onboarding@businesscart.com</a>
              </p>
            </div>
            {/* Contact Information Section */}
            <div className="bg-gray-50 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Information</h2>
              <div className="space-y-4">
                <p className="text-gray-600">Support Email: <a href="mailto:support@businesscart.com" className="text-teal-600 hover:underline">support@businesscart.com</a></p>
                <p className="text-gray-600">Sales Email: <a href="mailto:sales@businesscart.com" className="text-teal-600 hover:underline">sales@businesscart.com</a></p>
                <p className="text-gray-600">Technical Support: <a href="mailto:techsupport@businesscart.com" className="text-teal-600 hover:underline">techsupport@businesscart.com</a></p>
                <p className="text-gray-600">Phone: +1 (555) 123-4567</p>
                <p className="text-gray-600">Address: 123 Business Rd, Suite 100, Business City, 12345</p>
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
