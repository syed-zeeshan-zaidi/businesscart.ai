import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PrivacyPolicy: React.FC = () => {
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'who-this-applies-to', title: 'Who This Applies To' },
    { id: 'information-we-collect', title: 'Information We Collect' },
    { id: 'how-we-use-your-information', title: 'How We Use Your Information' },
    { id: 'payments-and-financial-data', title: 'Payments and Financial Data' },
    { id: 'how-we-share-your-information', title: 'How We Share Your Information' },
    { id: 'storefront-and-public-data', title: 'Storefront and Public Data' },
    { id: 'data-security', title: 'Data Security' },
    { id: 'data-ownership', title: 'Data Ownership' },
    { id: 'your-rights-and-choices', title: 'Your Rights and Choices' },
    { id: 'contact-us', title: 'Contact Us' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className="bg-gray-800 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Privacy Policy</h1>
            <p className="mt-4 text-gray-200">Last updated: March 2026</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Sections</h2>
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
                <p className="text-gray-600 mb-4">
                  BusinessCart.ai is a US-based e-commerce platform that provides businesses with their own branded online store, private commerce portal, and B2B tools. This Privacy Policy explains how we collect, use, and protect information across the platform, including the web portal, mobile app, D2C storefronts, and API.
                </p>
                <p className="text-gray-600">
                  By using BusinessCart.ai, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use the platform.
                </p>
              </section>

              <section id="who-this-applies-to">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Who This Applies To</h2>
                <p className="text-gray-600 mb-4">BusinessCart.ai serves multiple types of users. This policy applies to all of them:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><b>Companies (Sellers):</b> Businesses that create an account, manage products, configure pricing, and sell through the platform.</li>
                  <li><b>Customers (Buyers):</b> Individuals who register with a company code to browse catalogs, place orders, and manage their account through the portal or mobile app.</li>
                  <li><b>Storefront Visitors:</b> Anyone who visits a company's public D2C storefront and may place an order without registering for a portal account.</li>
                </ul>
              </section>

              <section id="information-we-collect">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Information We Collect</h2>
                <p className="text-gray-600 mb-4">We collect only the information necessary to operate the platform:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><b>Account Information:</b> Name, email address, phone number, and company name provided during registration.</li>
                  <li><b>Company Data:</b> Business name, logo, brand colors, product catalog (names, descriptions, prices, images), location details, and operating hours uploaded by companies.</li>
                  <li><b>Order Data:</b> Items purchased, quantities, delivery addresses, order status, and order history.</li>
                  <li><b>B2B Configuration:</b> Per-customer pricing, payment method preferences, delivery options, spending limits, and credit limits set by companies for their customers.</li>
                  <li><b>Device and Usage Data:</b> Browser type, device type, and pages visited, used to maintain platform performance and security.</li>
                </ul>
              </section>

              <section id="how-we-use-your-information">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How We Use Your Information</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Create and manage your account (company or customer).</li>
                  <li>Generate and host your branded D2C storefront from your product catalog.</li>
                  <li>Process orders, quotes, and checkout transactions.</li>
                  <li>Apply per-customer B2B configuration (pricing, payment methods, delivery options).</li>
                  <li>Send order confirmations, quote updates, and account notifications.</li>
                  <li>Generate SEO metadata (sitemaps, meta tags, schema markup) for your storefront.</li>
                  <li>Monitor platform performance and prevent abuse.</li>
                </ul>
              </section>

              <section id="payments-and-financial-data">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Payments and Financial Data</h2>
                <p className="text-gray-600 mb-4">
                  <b>BusinessCart.ai does not process or store credit card numbers, bank account details, or other sensitive financial information.</b>
                </p>
                <p className="text-gray-600 mb-4">
                  Payments are processed entirely through the company's own payment provider: Stripe, Amazon Pay, or Authorize.net. When a customer makes a payment, they are redirected to or interact with the payment provider's secure interface. BusinessCart.ai receives only a confirmation that the payment succeeded or failed.
                </p>
                <p className="text-gray-600">
                  Companies configure their own payment provider credentials on the platform. These credentials are encrypted at rest using AES-256-GCM encryption and are never exposed through the interface or API.
                </p>
              </section>

              <section id="how-we-share-your-information">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How We Share Your Information</h2>
                <p className="text-gray-600 mb-4">We do not sell your information. We share data only in these situations:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><b>Between Companies and Their Customers:</b> When a customer places an order, the company receives the customer's name, delivery address, and order details necessary to fulfill the order.</li>
                  <li><b>Payment Providers:</b> Order amount and reference information is shared with the company's configured payment provider (Stripe, Amazon Pay, or Authorize.net) to process payments.</li>
                  <li><b>Public Storefronts:</b> Product names, descriptions, prices, images, and company branding are published on the company's public D2C storefront. This is by design. Storefronts are intended to be publicly accessible.</li>
                  <li><b>Legal Requirements:</b> We may disclose information if required by law, subpoena, or legal process, or to protect the rights, property, or safety of BusinessCart.ai, our users, or others.</li>
                </ul>
              </section>

              <section id="storefront-and-public-data">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Storefront and Public Data</h2>
                <p className="text-gray-600 mb-4">
                  When a company adds products and configures their profile, BusinessCart.ai automatically generates a public D2C storefront. This storefront is static HTML served from a global content delivery network and is intentionally designed to be readable by search engines, AI assistants, and web browsers.
                </p>
                <p className="text-gray-600">
                  The following data is publicly visible on storefronts: company name, logo, brand colors, product names, descriptions, prices, images, and category structure. Customer data, order data, B2B configuration, and payment credentials are never exposed on storefronts.
                </p>
              </section>

              <section id="data-security">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Data Security</h2>
                <p className="text-gray-600 mb-4">
                  We take data security seriously. The platform uses the following measures:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>All data transmitted between your browser and our servers is encrypted using HTTPS/TLS.</li>
                  <li>Payment gateway credentials are encrypted at rest using AES-256-GCM.</li>
                  <li>Authentication uses JWT tokens with automatic expiration.</li>
                  <li>The platform runs on cloud infrastructure with automated security updates and no shared servers.</li>
                </ul>
                <p className="text-gray-600 mt-4">
                  No system is perfectly secure. While we implement industry-standard protections, we cannot guarantee absolute security. If you become aware of a security issue, please contact us immediately.
                </p>
              </section>

              <section id="data-ownership">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Data Ownership</h2>
                <p className="text-gray-600 mb-4">
                  <b>Companies own their data.</b> Your products, customer relationships, order history, and business configuration belong to you. BusinessCart.ai is a platform. We host and process your data to provide the service, but we do not claim ownership of it.
                </p>
                <p className="text-gray-600">
                  If you close your account, we will delete your data from our active systems upon request. Some data may be retained temporarily in backups or as required by law.
                </p>
              </section>

              <section id="your-rights-and-choices">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Rights and Choices</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>You can review and update your account information at any time through the portal.</li>
                  <li>You can request deletion of your account and associated data by contacting us.</li>
                  <li>Companies can remove products, customer associations, and business data at any time.</li>
                  <li>Customers can disassociate from a company or delete their account at any time.</li>
                </ul>
              </section>

              <section id="contact-us">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Us</h2>
                <p className="text-gray-600">
                  If you have questions about this Privacy Policy or how your data is handled, contact us at: <a href="mailto:help@businesscart.ai" className="text-teal-700 hover:underline">help@businesscart.ai</a>
                </p>
                <p className="text-gray-600 mt-2">
                  BusinessCart, Inc., United States
                </p>
              </section>
            </div>
          </div>
        </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
