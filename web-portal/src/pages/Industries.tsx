import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  ShoppingBagIcon,
  CpuChipIcon,
  UserGroupIcon,
  CakeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const solutions = [
  {
    title: 'D2C Brands',
    href: '/solutions/d2c-brands',
    icon: ShoppingBagIcon,
    summary: 'Branded online store with sub-second pages, AI-readable products, and 5 shopping channels — without monthly fees, plugin sprawl, or marketplace commissions.',
    audience: 'For: Side hustlers, Etsy/Amazon escapees, Shopify defectors',
  },
  {
    title: 'AI-Era Commerce',
    href: '/solutions/ai-commerce',
    icon: CpuChipIcon,
    summary: 'The first storefront built for AI shopping. Static HTML, schema.org, llms.txt, and markdown — get cited by ChatGPT, Perplexity, and Google AI.',
    audience: 'For: SEO-savvy merchants betting on AI discovery',
  },
  {
    title: 'Wholesale & B2B',
    href: '/solutions/wholesale',
    icon: UserGroupIcon,
    summary: 'Per-customer pricing, credit limits, spend caps, and quote negotiation — enforced automatically. Stop running B2B in spreadsheets.',
    audience: 'For: SMB wholesalers running orders via email',
  },
  {
    title: 'Restaurants & Food',
    href: '/solutions/restaurants',
    icon: CakeIcon,
    summary: 'Direct ordering for catering, meal-prep, bakeries, food trucks, and corporate lunch — code-gated regulars portal, no DoorDash 30% tax.',
    audience: 'For: Food businesses DoorDash serves poorly',
  },
  {
    title: 'Grocery & Specialty Food',
    href: '/solutions/grocery',
    icon: ShoppingCartIcon,
    summary: 'Online ordering for independent and ethnic grocers — without Instacart\'s 10-15% cut. Specialty, organic, butcher, bakery, pet supply.',
    audience: 'For: Independent specialty grocers',
  },
  {
    title: 'Manufacturers',
    href: '/solutions/manufacturers',
    icon: CubeIcon,
    summary: 'Distributor ordering without the email chains. Per-distributor pricing, MOQ, lead times, credit limits — channel conflict structurally impossible.',
    audience: 'For: Manufacturers selling to distributor networks',
  },
  {
    title: 'Distributors',
    href: '/solutions/distributors',
    icon: ArrowsRightLeftIcon,
    summary: 'Per-customer tier pricing, multi-warehouse inventory, multi-supplier buyer accounts. A buying experience that beats Amazon Business.',
    audience: 'For: Distributors managing supplier + customer sides',
  },
  {
    title: 'Marketplace Escape',
    href: '/solutions/marketplace-escape',
    icon: CurrencyDollarIcon,
    summary: 'Stop paying 15-30% to Etsy, Amazon, eBay, DoorDash, Instacart, Faire. Build your direct channel, keep 94%, own every customer.',
    audience: 'For: Anyone paying marketplace commissions',
  },
];

const Industries: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-gray-800 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              Solutions for Every Business Type
            </h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              One platform. Eight tailored solutions. Pick the page that fits your business — each one shows what's live today, what's in beta, and what's coming in 2026.
            </p>
          </div>
        </section>

        {/* Solutions Grid */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              {solutions.map((s) => (
                <Link
                  key={s.title}
                  to={s.href}
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white flex-shrink-0">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center group-hover:text-teal-700">
                        {s.title}
                        <ArrowRightIcon className="ml-2 h-4 w-4 text-teal-700 transition-transform group-hover:translate-x-1" />
                      </h2>
                      <p className="mt-2 text-gray-600">{s.summary}</p>
                      <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.audience}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto text-center py-16 px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900">Not Sure Which Fits You?</h2>
            <p className="mt-4 text-lg text-gray-600">
              Tell us about your business. We'll point you to the right solution — or build a custom one.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-3">
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                Talk to Founder
              </Link>
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 hover:text-gray-900 hover:border-gray-400"
              >
                Start Free
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Industries;
