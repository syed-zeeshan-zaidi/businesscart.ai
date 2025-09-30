import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const UserGuide: React.FC = () => {
  const sections = [
    { id: 'getting-started', title: 'Getting Started' },
    { id: 'managing-products', title: 'Managing Products' },
    { id: 'placing-orders', title: 'Placing Orders' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">User Guide</h2>
                <ul className="space-y-2">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="text-gray-600 hover:text-teal-600">{section.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:col-span-3 space-y-12">
              <section id="getting-started">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Getting Started</h2>
                <p className="text-gray-600">
                  Welcome to BusinessCart! This guide will walk you through the basics of setting up your account and getting started with our platform.
                </p>
                <p className="text-gray-600 mt-4">
                  First, you will need to register for an account. If you are a company, you will be able to create your own product catalog and invite your customers to purchase from you. If you are a customer, you will need a business code from the company you wish to purchase from.
                </p>
              </section>
              <section id="managing-products">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Managing Products</h2>
                <p className="text-gray-600">
                  As a company, you can manage your products from the dashboard. You can add new products, edit existing products, and organize them into categories. You can also set custom pricing and inventory levels for each product.
                </p>
              </section>
              <section id="placing-orders">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Placing Orders</h2>
                <p className="text-gray-600">
                  As a customer, you can browse the product catalog of the companies you are associated with. You can add products to your cart and proceed to checkout. You will be able to select your preferred payment and shipping methods.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UserGuide;
