import React from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface PricingSectionProps {
  bgClass?: string;
  cardBgClass?: string;
}

const includedFeatures = [
  'Branded storefront on your custom domain (sub-second loads, AI-readable)',
  'Private B2B portal — gate access with customer codes',
  'Per-customer pricing, credit limits, spend caps & quote negotiation',
  'Customer groups & custom catalogs for B2B segments',
  'All payment options: Stripe, Amazon Pay, Authorize.net, PO, offline',
  'Shopping-channel feeds: Google, Meta, Bing, Pinterest, TikTok and more',
  'AI discovery built-in: schema.org, llms.txt, markdown product pages',
  'Multiple pickup and warehouse locations',
  'Time-based deals and automated email notifications',
  'Real-time dashboard with built-in analytics and visitor tracking — revenue, orders, low-stock, CSV export, no Google Analytics or third-party tags needed',
  'Full REST API for custom integrations, apps, and ERP sync',
  'End-to-end support: technical, migration, integration, and onboarding',
];

const PricingSection: React.FC<PricingSectionProps> = ({
  bgClass = 'bg-white',
  cardBgClass = 'bg-gray-50',
}) => {
  return (
    <section className={`py-16 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Pricing That Scales With You. Every Feature, Every Tier.</h2>
          <p className="mt-6 inline-block bg-teal-50 border-l-4 border-teal-700 text-gray-800 text-base sm:text-lg px-6 py-4 rounded-r-md text-left font-medium">
            Your tier auto-applies based on monthly order volume — <strong className="text-teal-800">no manual upgrades, no feature locks, and tier changes only at month boundaries so you always see them coming.</strong> Your platform fee grows only when your business does.
          </p>
        </div>

        {/* What's included for everyone */}
        <div className="mt-10 max-w-5xl mx-auto bg-teal-50 border border-teal-200 rounded-lg p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-teal-900 text-center">Included in every tier — Starter through Enterprise</h3>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm text-gray-700">
            {includedFeatures.map((feat) => (
              <div key={feat} className="flex items-start">
                <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                <span className="ml-2">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tier cards (informational — auto-applied, not chosen) */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className={`${cardBgClass} rounded-lg shadow-lg p-8 text-center flex flex-col`}>
            <h3 className="text-2xl font-bold text-gray-900">Starter</h3>
            <p className="mt-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">Up to 100 orders / month</p>
            <p className="mt-5 text-4xl font-extrabold text-teal-700">$0<span className="text-lg font-medium text-gray-500"> / mo</span></p>
            <p className="mt-3 text-base text-gray-700">+ 6% per order, capped at $5</p>
            <p className="mt-auto pt-6 text-xs text-gray-500">Auto-applies under 100 orders/mo</p>
          </div>

          <div className={`${cardBgClass} rounded-lg shadow-lg p-8 text-center flex flex-col ring-2 ring-teal-700 relative`}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-teal-700 text-white text-xs font-semibold px-3 py-1 rounded-full">30-day money-back</span>
            <h3 className="text-2xl font-bold text-gray-900">Growth</h3>
            <p className="mt-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">101 – 1,000 orders / month</p>
            <p className="mt-5 text-4xl font-extrabold text-teal-700">$499<span className="text-lg font-medium text-gray-500"> / mo</span></p>
            <p className="mt-3 text-base text-gray-700">+ 1% per order</p>
            <p className="mt-auto pt-6 text-xs text-gray-500">Auto-applies between 101 and 1,000 orders/mo</p>
          </div>

          <div className={`${cardBgClass} rounded-lg shadow-lg p-8 text-center flex flex-col`}>
            <h3 className="text-2xl font-bold text-gray-900">Enterprise</h3>
            <p className="mt-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">1,001+ orders / month</p>
            <p className="mt-5 text-4xl font-extrabold text-teal-700">$1,999<span className="text-lg font-medium text-gray-500"> / mo</span></p>
            <p className="mt-3 text-base text-gray-700">+ 0.25% per order</p>
            <p className="mt-auto pt-6 text-xs text-gray-500">Auto-applies at 1,001+ orders/mo · Includes dedicated success manager + SLA</p>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600 max-w-3xl mx-auto">
          <strong className="text-gray-800">High-AOV B2B stays on Starter longer</strong> — the $5/order cap protects wholesale customers with few but large orders.
        </p>
        <p className="mt-4 text-center text-sm text-gray-600 max-w-3xl mx-auto">
          Optional AI integration add-on: starts at $99/mo, available on any tier. · 30-day money-back on Growth and Enterprise · No setup costs · No long-term contracts
        </p>

        <div className="mt-8 text-center">
          <Link
            to="/contact-us"
            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
          >
            Start Free
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
