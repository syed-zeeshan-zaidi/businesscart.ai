import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Compare: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />
      <main>

        {/* Hero */}
        <div className="bg-gray-800 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">BusinessCart.ai vs. The Competition</h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              A fair and factual comparison to help you make an informed decision.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

          {/* Comparison Table */}
          <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BusinessCart.ai</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shopify / Shopify Plus</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WooCommerce (Self-Hosted)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplaces (Etsy, DoorDash, Amazon)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Fee</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">$0</td>
                  <td className="px-6 py-4 text-sm text-gray-500">$39-399/mo (Plus: $2,300+/mo)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">$30-100/mo (hosting + plugins)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">$0 (but 15-30% per order)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Per-Order Fee</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">6% (Starter) or 5% + $1 (Growth)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">2.9% + 30c (payment processing only)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">2.9% + 30c (payment processing only)</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">15-30% commission</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Storefront Speed</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">Under 1 second (static HTML)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">2-4 seconds (JavaScript-rendered)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">3-5 seconds (PHP, depends on hosting)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Varies (you do not control it)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">SEO</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">Auto-generated (sitemap, schema, OG tags)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Basic (needs paid apps for full SEO)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Plugin-dependent (Yoast, etc.)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Marketplace ranks, not your brand</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">AI / LLM Discoverable</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">Yes (static HTML, AI can read products)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">No (JavaScript-rendered)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">No (PHP-rendered, plugin-dependent)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">No (walled garden)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Customer Data</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">You own it</td>
                  <td className="px-6 py-4 text-sm text-gray-500">You own it</td>
                  <td className="px-6 py-4 text-sm text-gray-500">You own it</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">Marketplace owns it</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Per-Customer Pricing</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Built-in</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Shopify Plus only ($2,300+/mo)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Via plugins (often clunky)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Not available</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Quote Negotiation</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Built-in</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Not available</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Not available</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Not available</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Maintenance</td>
                  <td className="px-6 py-4 text-sm font-bold text-teal-700">Fully managed</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Fully managed</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">You manage hosting, security, updates</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Fully managed (but you have no control)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Custom Domain</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Included (free)</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Included</td>
                  <td className="px-6 py-4 text-sm text-gray-500">You configure it yourself</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Not available</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detailed Breakdown */}
          <div className="mt-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">Detailed Breakdown</h2>
            <div className="space-y-12">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. Shopify / Shopify Plus</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You do not want to pay monthly fees before making your first sale.</li>
                      <li>You need B2B features — per-customer pricing, quotes, payment and delivery configuration.</li>
                      <li>You want the fastest possible storefront (sub-1-second loads vs 2-4 seconds).</li>
                      <li>You want your products discoverable by AI assistants and voice search.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose Shopify if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You are a high-volume B2C business doing $50K+/month and want the largest app ecosystem.</li>
                      <li>You need hundreds of third-party integrations (shipping, marketing, analytics).</li>
                      <li>Your B2B needs are simple or non-existent.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. WooCommerce (Self-Hosted)</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You want the control of owning your store without managing servers, security, and updates.</li>
                      <li>You need B2B features built in — not bolted on through plugins.</li>
                      <li>You want a lower total cost when you factor in hosting, maintenance, and developer time.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose WooCommerce if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You have the technical skills to manage your own hosting and security.</li>
                      <li>You need full control over every line of code.</li>
                      <li>You require very specific customizations that no hosted platform can offer.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. Marketplaces (Etsy, DoorDash, Amazon, Uber Eats)</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You want to stop paying 15-30% commission on every order.</li>
                      <li>You want to own your customer data and build direct relationships.</li>
                      <li>You want your own branded experience that you control.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose a Marketplace if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Your primary goal is customer discovery and you are willing to pay a high premium for it.</li>
                      <li>You do not have the time to manage any online presence.</li>
                      <li>You are focused exclusively on local delivery in a specific area.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Try It?</h2>
            <p className="text-gray-600 mb-6">No monthly fees. No credit card. See it for yourself.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact-us"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                Get Started Free
              </Link>
              <Link
                to="/contact-us"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-teal-700 text-base font-medium rounded-md text-teal-700 hover:bg-teal-700 hover:text-white transition"
              >
                Request a Demo
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Compare;
