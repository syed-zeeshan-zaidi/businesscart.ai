import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PrivacyPolicy: React.FC = () => {
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'information-we-collect', title: 'Information We Collect' },
    { id: 'how-we-use-your-information', title: 'How We Use Your Information' },
    { id: 'how-we-share-your-information', title: 'How We Share Your Information' },
    { id: 'data-security', title: 'Data Security' },
    { id: 'your-rights-and-choices', title: 'Your Rights and Choices' },
    { id: 'contact-us', title: 'Contact Us' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Privacy Policy</h2>
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
              <section id="introduction">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Introduction</h2>
                <p className="text-gray-600">
                  Welcome to BusinessCart.ai. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SaaS B2B e-commerce platform. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the service.
                </p>
              </section>
              <section id="information-we-collect">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Information We Collect</h2>
                <p className="text-gray-600 mb-4">We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><b>Company Data:</b> Information your company provides when creating an account, such as company name, address, contact information, and tax identification number.</li>
                  <li><b>Personal Data:</b> Personally identifiable information, such as your name, shipping address, email address, and telephone number, and demographic information, such as your age, gender, hometown, and interests, that you voluntarily give to us when you register with the Application.</li>
                  <li><b>Financial Data:</b> Financial information, such as data related to your payment method (e.g. valid credit card number, card brand, expiration date) that we may collect when you purchase, order, return, or exchange. We store only very limited, if any, financial information that we collect. Otherwise, all financial information is stored by our payment processor.</li>
                  <li><b>Transaction Data:</b> Information about the products you purchase, your order history, and your interactions with other businesses on the platform.</li>
                </ul>
              </section>
              <section id="how-we-use-your-information">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How We Use Your Information</h2>
                <p className="text-gray-600 mb-4">Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Create and manage your account.</li>
                  <li>Process your transactions and deliver the products and services you request.</li>
                  <li>Email you regarding your account or order.</li>
                  <li>Improve our platform and services.</li>
                  <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
                </ul>
              </section>
              <section id="how-we-share-your-information">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How We Share Your Information</h2>
                <p className="text-gray-600 mb-4">We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><b>By Law or to Protect Rights:</b> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                  <li><b>Third-Party Service Providers:</b> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
                  <li><b>Business Partners:</b> We may share your information with your business partners to facilitate transactions and provide the services you have requested.</li>
                </ul>
              </section>
              <section id="data-security">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Data Security</h2>
                <p className="text-gray-600">
                  We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                </p>
              </section>
              <section id="your-rights-and-choices">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Rights and Choices</h2>
                <p className="text-gray-600">
                  You may at any time review or change the information in your account or terminate your account by logging into your account settings and updating your account. Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, some information may be retained in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our Terms of Service and/or comply with legal requirements.
                </p>
              </section>
              <section id="contact-us">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Us</h2>
                <p className="text-gray-600">
                  If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:help@businesscart.ai" className="text-teal-600 hover:underline">help@businesscart.ai</a>
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

export default PrivacyPolicy;
