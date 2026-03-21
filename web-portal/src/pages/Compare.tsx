import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Compare: React.FC = () => {
  return (
    <div className="bg-gray-100">
      <Navbar />
      <main className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900">BusinessCart.ai vs. The Competition</h1>
            <p className="mt-4 text-lg text-gray-500">
              A fair and factual comparison to help you make an informed decision.
            </p>
          </div>

          <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BusinessCart.ai</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shopify Plus</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WooCommerce (Self-Hosted)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplaces (Uber Eats, etc.)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Primary Use Case</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Complex B2B & D2C with per-customer rules</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">High-volume B2C & basic B2B</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">General purpose B2C & DIY B2B</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Local delivery & customer acquisition</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Commission Fees</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-teal-600">No commission — small per-order fee</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">None (but requires Shopify Payments)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">None (but requires 3rd party payment gateway)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">15-30%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Customer Data</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-teal-600">You own it</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">You own it</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">You own it</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-red-600">Marketplace owns it</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Per-Customer Pricing</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes (Core Feature)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes (via apps & custom code)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes (via expensive, often clunky plugins)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">❌ No</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Negotiable Quotes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes (Core Feature)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">❌ No (requires custom development)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">❌ No (requires custom development)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">❌ No</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Headless / API-First</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">✅ Yes (can be complex to implement)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">❌ No</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Maintenance</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-teal-600">Fully managed by us</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Fully managed by Shopify</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-red-600">You manage everything (hosting, security)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Fully managed by marketplace</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">Detailed Breakdown</h2>
            <div className="space-y-12">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. Shopify Plus</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You have complex B2B requirements, like different pricing for different customers.</li>
                      <li>You need a built-in workflow for negotiable quotes.</li>
                      <li>You want the flexibility of a headless, API-first platform without the high costs of Shopify Plus.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose Shopify Plus if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You are primarily a high-volume B2C business.</li>
                      <li>Your B2B needs are simple (e.g., a single wholesale discount).</li>
                      <li>You prefer a single, all-in-one platform with a large app ecosystem.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. WooCommerce</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You want the control of a self-hosted solution without the headache of managing servers, security, and updates.</li>
                      <li>You need robust, native B2B features without relying on a patchwork of expensive plugins.</li>
                      <li>You value a lower total cost of ownership (TCO) when you factor in hosting, maintenance, and developer costs.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose WooCommerce if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You have the technical expertise to manage your own hosting and security.</li>
                      <li>You have a very tight initial budget and are willing to trade your time for lower upfront costs.</li>
                      <li>Your B2B needs are simple and can be met with off-the-shelf plugins.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">BusinessCart.ai vs. Marketplaces (Uber Eats, DoorDash, etc.)</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose BusinessCart.ai if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>You want to stop paying 15-30% commission on every order.</li>
                      <li>You want to own your customer data and build direct relationships.</li>
                      <li>You want to create a branded experience that you control from start to finish.</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">Choose Marketplaces if:</h4>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Your primary goal is customer acquisition and you are willing to pay a high premium for it.</li>
                      <li>You do not have the resources to manage your own online presence.</li>
                      <li>Your business is primarily focused on local delivery.</li>
                    </ul>
                  </div>
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

export default Compare;
