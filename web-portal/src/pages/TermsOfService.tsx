import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const TermsOfService: React.FC = () => {
  const sections = [
    { id: 'acceptance-of-terms', title: 'Acceptance of Terms' },
    { id: 'description-of-service', title: 'Description of Service' },
    { id: 'user-accounts', title: 'User Accounts' },
    { id: 'responsibilities', title: 'Responsibilities' },
    { id: 'payment-and-fees', title: 'Payment and Fees' },
    { id: 'termination', title: 'Termination' },
    { id: 'limitation-of-liability', title: 'Limitation of Liability' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Terms of Service</h2>
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
              <section id="acceptance-of-terms">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Acceptance of Terms</h2>
                <p className="text-gray-600">
                  By accessing and using the BusinessCart.ai platform, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services. Any participation in this service will constitute acceptance of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>
              <section id="description-of-service">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Description of Service</h2>
                <p className="text-gray-600">
                  Our service is a SaaS B2B e-commerce platform that allows businesses (Companies) to sell their products to their designated customers (Customers). We provide tools for managing products, orders, and customer relationships. The service is provided on an "as is" and "as available" basis. We reserve the right to modify, suspend, or discontinue the service at any time without notice and without any liability to you.
                </p>
              </section>
              <section id="user-accounts">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">3. User Accounts</h2>
                <p className="text-gray-600">
                  To access most features of the service, you must register for an account. When you register for an account, you may be required to provide us with some information about yourself, such as your name, email address, or other contact information. You agree that the information you provide to us is accurate and that you will keep it accurate and up-to-date at all times. You are solely responsible for maintaining the confidentiality of your account and password, and you accept responsibility for all activities that occur under your account.
                </p>
              </section>
              <section id="responsibilities">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Responsibilities</h2>
                <p className="text-gray-600 mb-4"><b>Companies</b> are responsible for managing their product catalogs, pricing, and inventory. They are also responsible for fulfilling orders and providing customer service to their Customers.</p>
                <p className="text-gray-600"><b>Customers</b> are responsible for providing accurate shipping and payment information. They are also responsible for paying for the products they order.</p>
              </section>
              <section id="payment-and-fees">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">5. Payment and Fees</h2>
                <p className="text-gray-600">
                  Certain features of the service may require you to pay fees. Before you pay any fees, you will have an opportunity to review and accept the fees that you will be charged. All fees are in U.S. Dollars and are non-refundable. We may use a third-party payment processor to bill you through a payment account linked to your account on the services.
                </p>
              </section>
              <section id="termination">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">6. Termination</h2>
                <p className="text-gray-600">
                  We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
                </p>
              </section>
              <section id="limitation-of-liability">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">7. Limitation of Liability</h2>
                <p className="text-gray-600">
                  In no event shall BusinessCart.ai, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
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

export default TermsOfService;
