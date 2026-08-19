import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Toaster } from 'react-hot-toast';

const UserGuide: React.FC = () => {
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'getting-started', title: '1. Getting Started' },
    { id: 'account-registration', title: '1.1 Account Registration & Setup' },
    { id: 'navigating-dashboard', title: '1.2 Navigating the Dashboard' },
    { id: 'for-companies', title: '2. For Companies' },
    { id: 'product-management', title: '2.1 Product Management' },
    { id: 'customer-management', title: '2.2 Customer Management' },
    { id: 'company-profile', title: '2.3 Company Profile & Settings' },
    { id: 'order-export', title: '2.4 Exporting Orders (Accounting & Ad Tracking)' },
    { id: 'for-customers', title: '3. For Customers' },
    { id: 'browsing-discovery', title: '3.1 Browsing & Discovery' },
    { id: 'checkout-experience', title: '3.2 Checkout' },
    { id: 'your-account', title: '3.3 Your Account' },
    { id: 'advanced-features', title: '4. Advanced Features & Support' },
    { id: 'api-troubleshooting', title: '4.1 API Status & Troubleshooting' },
    { id: 'security-privacy', title: '4.2 Security & Data Privacy' },
    { id: 'conclusion', title: 'Conclusion' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
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
                      <a href={`#${section.id}`} className="text-gray-600 hover:text-teal-800">{section.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:col-span-3 space-y-12">
              <section id="introduction">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Introduction</h2>
                <p className="text-gray-600">
                  BusinessCart.ai runs B2B and D2C commerce on one platform. This guide covers how to set up an account, manage products and customers as a seller, place orders as a buyer, and use the API, security, and export tools.
                </p>
              </section>

              <section id="getting-started">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Getting Started</h2>
                <p className="text-gray-600">
                  Register an account and find your way around the dashboard.
                </p>
              </section>

              <section id="account-registration">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">1.1 Account Registration & Setup</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">For Companies (Sellers):</h4>
                <p className="text-gray-600 mb-2">
                  Register as a company. Fill in your business name, logo, and contact info. Assign admin users who can manage products and customers. Issue Business Codes to give specific customers access to your catalog with their own pricing. Link a payment gateway (Stripe, Amazon Pay, or Authorize.net) and define shipping zones.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">For Customers (Buyers):</h4>
                <p className="text-gray-600 mb-2">
                  Customers register with a Business Code from the company they want to buy from. The code links your account to that company's catalog with your specific pricing. After registration you land on your dashboard where you can update your profile, manage addresses, and browse products from any company you're linked to.
                </p>
              </section>

              <section id="navigating-dashboard">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">1.2 Navigating the Dashboard</h3>
                <p className="text-gray-600">
                  For companies, the dashboard shows revenue, orders, low-stock alerts, and your current tier with order-volume usage. For customers, it shows recent orders (with refund status if any), saved addresses, and a switcher between companies you're linked to.
                </p>
              </section>

              <section id="for-companies">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">2. For Companies</h2>
                <p className="text-gray-600">
                  Tools for managing products, customers, company settings, and order exports.
                </p>
              </section>

              <section id="product-management">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Product Management</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Adding and Editing Products:</h4>
                <p className="text-gray-600 mb-2">
                  Add products from the Products page. Each product takes a name, description, price, images, stock, and category. Add variants for size, color, or configuration if you sell them. Organize products into categories so customers can browse them on the storefront.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Inventory Control:</h4>
                <p className="text-gray-600 mb-2">
                  Stock counts update in real time. The dashboard shows low-stock alerts so you know when to restock.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Dynamic Pricing Strategies:</h4>
                <p className="text-gray-600 mb-2">
                  Set tiered pricing for bulk purchases, volume discounts, and customer-specific pricing for individual buyers. Create and manage promotional codes to drive sales.
                </p>
              </section>

              <section id="customer-management">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Customer Management</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Inviting and Managing Customers:</h4>
                <p className="text-gray-600 mb-2">
                  Issue Business Codes to give specific customers access to your catalog. Group customers into segments with their own pricing. View each customer's order history from the Customers page.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Order Fulfillment & Management:</h4>
                <p className="text-gray-600 mb-2">
                  Process orders from quote approval through shipment. Track order status, update tracking numbers, and record refunds from the order detail page. Refunds are append-only and trigger an automatic email to the customer.
                </p>
              </section>

              <section id="company-profile">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.3 Company Profile & Settings</h3>
                <p className="text-gray-600 mb-2">
                  Update your company information, logo, and contact details. Manage admin user accounts. ERP and CRM integration is available through the REST API, or tell us the system you run and we connect it for you at no extra cost.
                </p>
              </section>

              <section id="order-export">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.4 Exporting Orders (Accounting & Ad Tracking)</h3>
                <p className="text-gray-600 mb-2">
                  From the Orders page, click the Export button next to Refresh. Pick a date range and one of three formats. <strong>Generic CSV</strong> is the full ledger (every status including cancelled) with order ID, date, customer email, payment and delivery method, subtotal, shipping, tax, grand total, item count, tracking, and ad click IDs. Use it for monthly P&L, AR reconciliation, or tax filings. <strong>Google Ads</strong> format produces an offline click-conversions upload (gclid match, cancelled excluded). Upload the CSV in Google Ads under Tools, Conversions, Uploads. <strong>Microsoft Ads</strong> format produces a bulk offline conversions file (msclkid match, cancelled excluded). Upload it in Microsoft Advertising under Tools, Bulk Operations, Upload bulk file. The Conversion Name you enter must match the action you set up in the ad platform (default: Purchase). No app subscription, no Zapier, no third-party tags. Bidding algorithms learn from real conversions within hours of upload.
                </p>
              </section>

              <section id="for-customers">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">3. For Customers</h2>
                <p className="text-gray-600">
                  Browse products, build a cart, place an order, and manage your account.
                </p>
              </section>

              <section id="browsing-discovery">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.1 Browsing & Discovery</h3>
                <p className="text-gray-600 mb-2">
                  Each company you're linked to has its own catalog with your specific pricing. Use search and filters to find products. Active deals appear on the Deals page.
                </p>
              </section>

              <section id="checkout-experience">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.2 Checkout</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Building Your Cart:</h4>
                <p className="text-gray-600 mb-2">
                  Add products to your cart and adjust quantities. Review the cart with subtotal, shipping, and tax before checkout.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">The Two-Step Checkout Process:</h4>
                <p className="text-gray-600 mb-2">
                  Checkout has two steps: quote generation, then order placement.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 mb-2 ml-4">
                  <li><b>Quote Generation:</b> Your cart converts to a quote showing line items, taxes, shipping, promotions, and grand total. Review before approving.</li>
                  <li><b>Order Placement:</b> Approve the quote and pay with your linked gateway (Stripe, Amazon Pay, Authorize.net, or offline payment). The order is created on payment confirmation.</li>
                </ul>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Payment & Shipping Options:</h4>
                <p className="text-gray-600 mb-2">
                  Pick from the payment methods your company has enabled. Choose a saved address or add a new one for delivery.
                </p>
              </section>

              <section id="your-account">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.3 Your Account</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Order History & Tracking:</h4>
                <p className="text-gray-600 mb-2">
                  View all past orders. Click an order to see its status, tracking number, refund history, and line items. Use the reorder button to repeat an order.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Profile & Address Management:</h4>
                <p className="text-gray-600 mb-2">
                  Update your profile and contact info. Add multiple shipping and billing addresses; pick one at checkout.
                </p>
              </section>

              <section id="advanced-features">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Advanced Features & Support</h2>
                <p className="text-gray-600">
                  API status, troubleshooting, and security details.
                </p>
              </section>

              <section id="api-troubleshooting">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">4.1 API Status & Troubleshooting</h3>
                <p className="text-gray-600 mb-2">
                  The API Status page shows current uptime and any incidents. If something breaks, check the status page first. Email help@businesscart.ai for support.
                </p>
              </section>

              <section id="security-privacy">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">4.2 Security & Data Privacy</h3>
                <p className="text-gray-600 mb-2">
                  Authentication uses JWT access tokens (72-hour) and refresh tokens (7-day). All traffic is encrypted in transit. Card payments are tokenized through the payment gateway; we never store card numbers. See the Privacy Policy for data handling details.
                </p>
              </section>

              <section id="conclusion">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Conclusion</h2>
                <p className="text-gray-600">
                  Questions? Email help@businesscart.ai or request a demo from the contact page.
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
