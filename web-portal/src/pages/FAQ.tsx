import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface Question {
  id: string;
  question: string;
  answer: string;
  video?: string;
}

interface SectionContent {
  questions: Question[];
}

const FAQ: React.FC = () => {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestion(openQuestion === questionId ? null : questionId);
  };

  const sections = [
    { id: 'welcome', title: 'Welcome to BusinessCart' },
    { id: 'getting-started-company', title: 'Getting Started: Company Role' },
    { id: 'getting-started-customer', title: 'Getting Started: Customer Role' },
    { id: 'product-management-company', title: 'Product Management: Company Role' },
    { id: 'shopping-ordering-customer', title: 'Shopping & Ordering: Customer Role' },
    { id: 'general-faqs', title: 'General FAQs' },
  ];

  const content: Record<string, SectionContent> = {
    'welcome': {
      questions: [
        {
          id: 'what-is-businesscart',
          question: 'What is BusinessCart?',
          answer: 'BusinessCart is a cloud-native, serverless B2B e-commerce platform designed to streamline transactions between companies and their customers. It empowers businesses to manage products, orders, and customer relationships efficiently.',
        },
        {
          id: 'how-businesscart-solves-needs',
          question: 'How does BusinessCart solve my business needs?',
          answer: 'BusinessCart simplifies the complex world of B2B e-commerce by providing a unified platform for product management, customer-specific pricing, streamlined ordering, and comprehensive order tracking. It reduces manual processes, improves order accuracy, and enhances customer satisfaction. It allows companies to separate their B2B operations from their B2C, offering a dedicated SAAS solution.',
        },
        {
          id: 'benefits-for-companies',
          question: 'What are the benefits for Companies?',
          answer: 'Companies can easily create and manage their product catalogs, set custom pricing and discounts for individual customers, manage inventory, and track orders. Our platform helps companies expand their reach, improve operational efficiency, and build stronger customer relationships.',
        },
        {
          id: 'benefits-for-customers',
          question: 'What are the benefits for Customers?',
          answer: 'Customers gain exclusive access to their suppliers\' product catalogs, view personalized pricing, easily place and track orders, and manage their shipping addresses. The platform offers a seamless and intuitive shopping experience tailored to their business needs.',
        },
      ],
    },
    'getting-started-company': {
      questions: [
        {
          id: 'register-as-company',
          question: 'How do I register as a Company?',
          answer: 'To register as a company, you need a unique CompanyCode provided by a BusinessCart administrator. During registration, you will provide your company details and the CompanyCode.',
          video: '[Video: Company Registration Process]',
        },
        {
          id: 'get-business-code',
          question: 'How do I get a Business Code (CompanyCode)?',
          answer: 'CompanyCodes are generated and distributed by BusinessCart administrators. Please contact our onboarding team at onboarding@businesscart.com to request a CompanyCode and initiate your onboarding process. Additional documentation may be required.',
        },
        {
          id: 'invite-customers',
          question: 'How do I invite customers to my company?',
          answer: 'Once your company account is active, you can generate CustomerCodes through your dashboard. These codes can then be distributed to your customers, allowing them to register and associate with your company.',
          video: '[Video: Inviting Customers and Generating CustomerCodes]',
        },
        {
          id: 'manage-company-profile',
          question: 'How do I manage my company profile?',
          answer: 'You can manage your company\'s profile, including contact information, addresses, and checkout configurations (payment methods, delivery methods, shipping options), from your company dashboard.',
          video: '[Video: Managing Company Profile and Settings]',
        },
      ],
    },
    'getting-started-customer': {
      questions: [
        {
          id: 'register-as-customer',
          question: 'How do I register as a Customer?',
          answer: 'To register as a customer, you need a CustomerCode provided by the company you wish to purchase from. During registration, you will provide your personal details and the CustomerCode to associate with the company.',
          video: '[Video: Customer Registration Process]',
        },
        {
          id: 'use-customer-code',
          question: 'How do I use a Customer Code?',
          answer: 'Enter the CustomerCode during your registration process. This code links your account to a specific company, granting you access to their product catalog and personalized pricing. CustomerCodes can be used by multiple customers from the same company.',
        },
        {
          id: 'manage-customer-account',
          question: 'How do I manage my account?',
          answer: 'You can manage your personal information, view your associated companies, and update your default shipping addresses from your customer account page.',
          video: '[Video: Managing Customer Account Details]',
        },
      ],
    },
    'product-management-company': {
      questions: [
        {
          id: 'add-new-product',
          question: 'How do I add a new product to my catalog?',
          answer: 'From your company dashboard, navigate to the product management section. You can add new products by providing details such as name, description, price, and images.',
          video: '[Video: Adding a New Product]',
        },
        {
          id: 'update-product-details',
          question: 'How do I update product details?',
          answer: 'You can edit existing product details, including name, description, price, and images, from your product management section.',
          video: '[Video: Updating Product Information]',
        },
        {
          id: 'manage-product-inventory',
          question: 'How do I manage product inventory?',
          answer: 'The platform allows you to set and update inventory levels for each of your products, ensuring accurate stock information for your customers.',
          video: '[Video: Managing Product Inventory]',
        },
        {
          id: 'set-custom-pricing',
          question: 'How do I set custom pricing or discounts for specific customers?',
          answer: 'BusinessCart supports customer-specific configurations. You can define custom pricing, discounts, and even available payment/delivery methods for individual customers or customer groups. If a customer does not have a custom configuration for a specific setting, it will automatically fall back to the company\'s default configuration.',
          video: '[Video: Configuring Customer-Specific Pricing and Discounts]',
        },
      ],
    },
    'shopping-ordering-customer': {
      questions: [
        {
          id: 'browse-catalog',
          question: 'How do I browse the product catalog?',
          answer: 'After logging in, you can access the product catalog from your dashboard. You can filter products by company, category, and other attributes to find what you need.',
          video: '[Video: Browsing the Product Catalog]',
        },
        {
          id: 'add-items-to-cart',
          question: 'How do I add items to my cart?',
          answer: 'On any product page or catalog listing, you can specify the quantity and add items directly to your cart. Your cart is managed per company.',
          video: '[Video: Adding Items to Cart]',
        },
        {
          id: 'update-cart-items',
          question: 'How do I update item quantities or remove items from my cart?',
          answer: 'You can view and manage your cart from the cart page. Here, you can adjust quantities, remove items, or clear your entire cart for a specific company.',
          video: '[Video: Managing Cart Items]',
        },
        {
          id: 'checkout-place-order',
          question: 'How do I checkout and place an order?',
          answer: 'The checkout process is a two-step flow. First, you generate a quote from your cart, which provides a detailed cost breakdown. After reviewing the quote, you can proceed to select payment and delivery methods and place your order.',
          video: '[Video: Checkout and Order Placement]',
        },
        {
          id: 'view-order-history',
          question: 'How do I view my past orders?',
          answer: 'Your complete order history is available on the ',
        },
      ],
    },
    'general-faqs': {
      questions: [
        {
          id: 'contact-support',
          question: 'How can I contact support?',
          answer: 'You can reach our support team by emailing support@businesscart.com or by using the contact form on our website. We aim to respond within 24 business hours.',
        },
        {
          id: 'data-security',
          question: 'How is my data secured?',
          answer: 'We employ industry-standard security measures, including encryption and secure authentication protocols, to protect your data. Please refer to our Privacy Policy for more details.',
        },
        {
          id: 'platform-updates',
          question: 'How often is the platform updated?',
          answer: 'We regularly update the platform to introduce new features and improve performance. You will be notified of significant updates.',
        },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">Frequently Asked Questions</h1>
        <div className="grid grid-cols-1 gap-8">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">{section.title}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {content[section.id as keyof typeof content]?.questions.map((q) => (
                  <div key={q.id}>
                                          <button
                                            className="text-left w-full text-teal-600 hover:underline font-medium flex justify-between items-center"
                                            onClick={() => toggleQuestion(q.id)}
                                          >                      {q.question}
                      {openQuestion === q.id ? (
                        <ChevronUpIcon className="h-4 w-4 text-blue-500" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {openQuestion === q.id && (
                      <p className="mt-2 text-gray-600 text-sm pl-4 border-l-2 border-gray-300 ml-2">
                        {q.answer}
                        {q.video && <p className="text-xs text-gray-500 mt-1">{q.video}</p>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
