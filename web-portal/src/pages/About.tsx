import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const About: React.FC = () => {
  const sections = [
    { id: 'our-story', title: 'Our Story' },
    { id: 'our-mission', title: 'Our Mission' },
    { id: 'our-team', title: 'Our Team' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">About Us</h2>
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
              <section id="our-story">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Story</h2>
                <p className="text-gray-600">
                  BusinessCart.ai was founded in 2023 with a clear conviction: businesses shouldn't have to choose between marketplace reach and owning their commerce. We watched manufacturers pay 15-30% commissions to platforms that kept their customer data. We saw distributors managing per-customer pricing in spreadsheets. We saw local brands lose their identity inside generic storefronts.
                </p>
                <p className="text-gray-600 mt-4">
                  So we built BusinessCart.ai — a serverless, API-first platform that gives every business its own private commerce operation. Per-customer B2B configuration, auto-generated D2C storefronts, and direct payment collection. No marketplace fees, no compromises.
                </p>
              </section>
              <section id="our-mission">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Mission</h2>
                <p className="text-gray-600">
                  Your commerce, your rules. BusinessCart.ai exists so that businesses of any size — from a local bakery to a national distributor — can sell directly to their customers without middlemen taking a cut. We believe you should own your customers, your data, and your revenue. Our platform makes that possible with zero monthly fees and enterprise-grade infrastructure.
                </p>
              </section>
              <section id="our-team">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Team</h2>
                <p className="text-gray-600">
                  We are a small, focused team of engineers and commerce experts building on AWS serverless infrastructure. We ship fast, stay lean, and obsess over the details that matter — page speed, per-customer flexibility, and keeping costs low for the businesses we serve. Everything we build is designed to run at scale without passing infrastructure costs to our customers.
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

export default About;
