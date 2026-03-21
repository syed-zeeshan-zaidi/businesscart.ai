import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Industries: React.FC = () => {
  const useCases = [
    {
      title: 'Manufacturing',
      problem: 'Manufacturers often sell to a diverse group of distributors, wholesalers, and direct buyers, each with their own negotiated pricing and product catalogs. Managing this through spreadsheets and manual order entry is inefficient and error-prone.',
      solution: [
        'Create a private portal for each distributor with their specific pricing and product availability.',
        'Use the negotiable quote feature to handle large, custom orders.',
        'Integrate with your ERP to sync inventory and order data in real-time.',
      ],
    },
    {
      title: 'Food & Beverage Distribution',
      problem: 'Food distributors need to manage complex ordering rules, such as minimum order quantities, delivery zones, and different price lists for restaurants, cafes, and grocery stores.',
      solution: [
        'Set up per-customer rules for order minimums and delivery options.',
        'Create unique price lists and product catalogs for different types of customers.',
        'Allow restaurants to place recurring orders easily.',
      ],
    },
    {
      title: 'Wholesale & Bulk Goods',
      problem: 'Wholesalers need to offer tiered pricing based on volume and customer loyalty. They also need to manage a large, often complex, product catalog.',
      solution: [
        'Implement automated tiered pricing that applies discounts as the customer\'s order size increases.',
        'Provide a powerful, searchable catalog that can be customized for each customer.',
        'Use the API-first architecture to integrate with inventory management and shipping solutions.',
      ],
    },
    {
      title: 'D2C Brands Escaping Marketplaces',
      problem: 'D2C brands that have built their initial audience on platforms like Etsy, Amazon, or food delivery apps are losing a significant portion of their revenue to commissions and have no direct relationship with their customers.',
      solution: [
        'Create a commission-free, private e-commerce store that you control.',
        'Own your customer data from day one, allowing you to build email lists and loyalty programs.',
        'Create a unique, branded experience that tells your story and sets you apart from the competition.',
      ],
    },
    {
      title: 'Restaurants & Local Food Businesses',
      problem: 'Restaurants are being squeezed by the high commission fees (15-30%) of delivery apps like Uber Eats and DoorDash.',
      solution: [
        'Launch your own online ordering system for pickup and local delivery, with zero commission fees.',
        'Offer daily specials and promotions that you control.',
        'Build a direct line of communication with your most loyal customers.',
      ],
    },
  ];

  return (
    <div className="bg-gray-100">
      <Navbar />
      <main className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900">Use Cases & Target Industries</h1>
            <p className="mt-4 text-lg text-gray-500">
              BusinessCart.ai is a flexible platform that can be adapted to a wide range of B2B and D2C use cases.
            </p>
          </div>

          <div className="space-y-12">
            {useCases.map((useCase, index) => (
              <div key={index} className="bg-white shadow-lg rounded-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{useCase.title}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">The Problem</h3>
                    <p className="text-gray-600">{useCase.problem}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">The Solution with BusinessCart.ai</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      {useCase.solution.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
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

export default Industries;
