import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Toaster } from 'react-hot-toast';

const UserGuide: React.FC = () => {
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'getting-started', title: '1. Getting Started: Your Gateway to Seamless Commerce' },
    { id: 'account-registration', title: '1.1 Account Registration & Setup' },
    { id: 'navigating-dashboard', title: '1.2 Navigating the BusinessCart.ai Dashboard' },
    { id: 'for-companies', title: '2. For Companies: Mastering Your E-commerce Operations' },
    { id: 'product-management', title: '2.1 Product Management: Curate Your Catalog with Precision' },
    { id: 'customer-management', title: '2.2 Customer Relationship Management: Build Lasting Partnerships' },
    { id: 'company-profile', title: '2.3 Company Profile & Settings' },
    { id: 'order-export', title: '2.4 Exporting Orders (Accounting & Ad Tracking)' },
    { id: 'for-customers', title: '3. For Customers: Streamlined Purchasing & Account Management' },
    { id: 'browsing-discovery', title: '3.1 Browsing & Discovery: Find Exactly What You Need' },
    { id: 'checkout-experience', title: '3.2 The BusinessCart.ai Checkout Experience' },
    { id: 'your-account', title: '3.3 Your Account: Control at Your Fingertips' },
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
                  Welcome to BusinessCart.ai, your premier B2B & D2C e-commerce platform designed to empower businesses of all sizes. From local enterprises to large corporations, BusinessCart.ai provides a robust, scalable, and intuitive solution to streamline your sales operations, cultivate direct customer relationships, and achieve unparalleled efficiency. Our platform is engineered to adapt to your unique business needs, offering a powerful alternative to traditional marketplaces by putting you in complete control of your commerce experience.
                </p>
              </section>

              <section id="getting-started">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Getting Started: Your Gateway to Seamless Commerce</h2>
                <p className="text-gray-600">
                  Embark on your BusinessCart.ai journey with confidence. This section guides you through the essential steps of setting up your account and understanding the foundational elements of our platform, ensuring a smooth and efficient start.
                </p>
              </section>

              <section id="account-registration">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">1.1 Account Registration & Setup</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">For Companies (Sellers):</h4>
                <p className="text-gray-600 mb-2">
                  As a company, your journey begins with establishing your presence on BusinessCart. This involves creating your comprehensive company profile, which serves as the foundation for your e-commerce operations. You will designate administrative users who will manage your product catalog, customer relationships, and overall platform settings. A critical feature for companies is the ability to issue and manage "Business Codes," which are unique identifiers that grant your specific customers exclusive access to your products and tailored pricing. Furthermore, you'll configure essential operational settings such as linking your preferred payment gateways and defining shipping zones to ensure seamless transactions and delivery.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">For Customers (Buyers):</h4>
                <p className="text-gray-600 mb-2">
                  Customers gain access to BusinessCart.ai through a streamlined registration process. To ensure a secure and personalized buying experience, customers require a unique "Business Code" provided by the company they wish to purchase from. This code acts as your key to accessing exclusive product catalogs and customized pricing. Upon successful registration, you will be guided to your personalized dashboard, where you can manage your profile, update shipping addresses, and begin exploring the curated product offerings from your associated companies.
                </p>
              </section>

              <section id="navigating-dashboard">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">1.2 Navigating the BusinessCart.ai Dashboard</h3>
                <p className="text-gray-600">
                  The BusinessCart.ai dashboard is your central command center, offering a high-level overview of your e-commerce activities. For companies, it provides quick access to sales performance metrics, inventory alerts, and pending orders. Customers will find their dashboard tailored to display recent orders, favorite products, and easy access to their associated companies' catalogs. Both interfaces are designed for intuitive navigation, ensuring that key information and functionalities are always within reach.
                </p>
              </section>

              <section id="for-companies">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">2. For Companies: Mastering Your E-commerce Operations</h2>
                <p className="text-gray-600">
                  BusinessCart.ai empowers companies with a comprehensive suite of tools to efficiently manage their e-commerce operations. From meticulous product curation to robust customer relationship management, this section details how to leverage our platform to its fullest potential.
                </p>
              </section>

              <section id="product-management">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Product Management: Curate Your Catalog with Precision</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Adding and Editing Products:</h4>
                <p className="text-gray-600 mb-2">
                  Effortlessly list your products with our intuitive interface. Provide detailed descriptions, upload high-resolution imagery, and specify key attributes to ensure your products are accurately represented. Manage product variants, such as different sizes, colors, or configurations, to offer a diverse selection. Organize your products into logical categories to enhance discoverability and improve the customer browsing experience.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Inventory Control:</h4>
                <p className="text-gray-600 mb-2">
                  Maintain optimal stock levels with real-time inventory tracking. Set automated reorder points and receive timely alerts to prevent stockouts and ensure continuous product availability. Our system provides a clear overview of your inventory, enabling proactive management.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Dynamic Pricing Strategies:</h4>
                <p className="text-gray-600 mb-2">
                  Implement sophisticated pricing strategies tailored to your business model. Configure tiered pricing for bulk purchases, apply volume discounts, and establish customer-specific pricing to reward loyalty or cater to unique agreements. Create and manage promotional codes to drive sales and engage your customer base effectively.
                </p>
              </section>

              <section id="customer-management">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Customer Relationship Management: Build Lasting Partnerships</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Inviting and Managing Customers:</h4>
                <p className="text-gray-600 mb-2">
                  BusinessCart.ai empowers you to control who accesses your product catalog. Issue and manage unique Business Codes to grant specific customers exclusive access. Segment your customer base for targeted marketing campaigns and personalized pricing structures. Gain valuable insights by viewing individual customer order histories and preferences, fostering stronger relationships.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Order Fulfillment & Management:</h4>
                <p className="text-gray-600 mb-2">
                  Efficiently process incoming orders from quote approval through to shipment. Our platform provides comprehensive tools for tracking order status, facilitating clear communication with your customers, and managing returns and refunds with ease, ensuring a smooth post-purchase experience.
                </p>
              </section>

              <section id="company-profile">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.3 Company Profile & Settings</h3>
                <p className="text-gray-600 mb-2">
                  Maintain your company's brand identity and operational efficiency by easily updating your company information, branding assets, and contact details. Manage user roles and permissions within your company account to ensure secure and appropriate access levels. BusinessCart.ai is designed for flexibility, offering potential integration with external systems such as ERP and CRM platforms to further automate your workflows and enhance data synchronization.
                </p>
              </section>

              <section id="order-export">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">2.4 Exporting Orders (Accounting & Ad Tracking)</h3>
                <p className="text-gray-600 mb-2">
                  From the Orders page, click the Export button next to Refresh. Pick a date range and one of three formats. <strong>Generic CSV</strong> is the full ledger (every status including cancelled) with order ID, date, customer email, payment and delivery method, subtotal, shipping, tax, grand total, item count, tracking, and ad click IDs. Use it for monthly P&L, AR reconciliation, or tax filings. <strong>Google Ads</strong> format produces an offline click-conversions upload (gclid match, cancelled excluded). Upload the CSV in Google Ads under Tools, Conversions, Uploads. <strong>Microsoft Ads</strong> format produces a bulk offline conversions file (msclkid match, cancelled excluded). Upload it in Microsoft Advertising under Tools, Bulk Operations, Upload bulk file. The Conversion Name you enter must match the action you set up in the ad platform (default: Purchase). No app subscription, no Zapier, no third-party tags. Bidding algorithms learn from real conversions within hours of upload.
                </p>
              </section>

              <section id="for-customers">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">3. For Customers: Streamlined Purchasing & Account Management</h2>
                <p className="text-gray-600">
                  Experience a seamless and efficient purchasing journey with BusinessCart. This section guides customers through browsing products, managing their cart, navigating the secure checkout process, and effectively managing their account.
                </p>
              </section>

              <section id="browsing-discovery">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.1 Browsing & Discovery: Find Exactly What You Need</h3>
                <p className="text-gray-600 mb-2">
                  Explore personalized product catalogs curated specifically for your business needs. Utilize robust search and filtering options to quickly locate desired products. Stay informed about exclusive deals and promotions tailored to your account, ensuring you always get the best value.
                </p>
              </section>

              <section id="checkout-experience">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.2 The BusinessCart.ai Checkout Experience</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Building Your Cart:</h4>
                <p className="text-gray-600 mb-2">
                  Effortlessly add products to your cart and adjust quantities as needed. Review your cart contents, including estimated totals, before proceeding to the next step of your purchase.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">The Two-Step Checkout Process:</h4>
                <p className="text-gray-600 mb-2">
                  BusinessCart.ai employs a secure and transparent two-step checkout process to ensure accuracy and control over your orders.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 mb-2 ml-4">
                  <li><b>Quote Generation:</b> Understand how your quote is meticulously generated, incorporating all applicable taxes, shipping costs, and any eligible promotions. This step provides a clear breakdown of your total investment before commitment.</li>
                  <li><b>Order Placement:</b> Once you approve the quote, securely place your order using a payment token. Our system ensures that your transaction is processed efficiently and safely.</li>
                </ul>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Payment & Shipping Options:</h4>
                <p className="text-gray-600 mb-2">
                  Manage and select from multiple secure payment methods. Choose your preferred shipping addresses and methods, ensuring timely and convenient delivery of your products.
                </p>
              </section>

              <section id="your-account">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3.3 Your Account: Control at Your Fingertips</h3>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Order History & Tracking:</h4>
                <p className="text-gray-600 mb-2">
                  Access a comprehensive record of your past orders, facilitating easy reordering and detailed tracking of current shipments. Stay informed every step of the way.
                </p>
                <h4 className="text-lg font-medium text-gray-700 mb-2 mt-4">Profile & Address Management:</h4>
                <p className="text-gray-600 mb-2">
                  Effortlessly update your personal and business information. Manage multiple shipping and billing addresses for ultimate convenience and flexibility in your purchasing process.
                </p>
              </section>

              <section id="advanced-features">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Advanced Features & Support</h2>
                <p className="text-gray-600">
                  BusinessCart.ai is built with advanced capabilities to ensure reliability and provide comprehensive support.
                </p>
              </section>

              <section id="api-troubleshooting">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">4.1 API Status & Troubleshooting</h3>
                <p className="text-gray-600 mb-2">
                  For real-time updates on system performance and availability, please refer to our dedicated API Status page. This resource provides insights into the operational health of BusinessCart.ai services. Should you encounter any issues, our comprehensive troubleshooting tips can guide you through common resolutions. For persistent technical assistance, our support team is readily available to provide expert guidance.
                </p>
              </section>

              <section id="security-privacy">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">4.2 Security & Data Privacy</h3>
                <p className="text-gray-600 mb-2">
                  At BusinessCart, we are unwavering in our commitment to safeguarding your data and ensuring the utmost privacy. Our platform employs industry-leading security protocols, including robust JWT-based authentication for secure access and encrypted transactions. We adhere to stringent data privacy standards, providing you with peace of mind that your business-critical information is protected.
                </p>
              </section>

              <section id="conclusion">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Conclusion</h2>
                <p className="text-gray-600">
                  BusinessCart.ai is more than just an e-commerce platform; it's a strategic partner designed to give you unparalleled control, efficiency, and growth opportunities in the B2B and D2C landscape. By empowering you to own your customer relationships and streamline your operations, we enable you to focus on what truly matters: building a thriving business. Ready to elevate your e-commerce experience? Contact us today for personalized support or to schedule a comprehensive demo tailored to your specific business needs.
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
