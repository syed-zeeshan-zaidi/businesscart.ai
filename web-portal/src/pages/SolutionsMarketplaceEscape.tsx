import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PricingSection from '../components/PricingSection';
import {
  BanknotesIcon,
  BoltIcon,
  CakeIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  UserGroupIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const Badge: React.FC<{ kind: 'live' | 'beta' | 'q2' | 'q3' | 'q4' }> = ({ kind }) => {
  const config = {
    live: { label: 'LIVE', cls: 'bg-green-100 text-green-800 ring-green-200' },
    beta: { label: 'BETA', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
    q2: { label: 'Q2 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
    q3: { label: 'Q3 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
    q4: { label: 'Q4 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
  }[kind];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ring-1 ring-inset ${config.cls}`}>
      {config.label}
    </span>
  );
};

const marketplaceCosts = [
  { name: 'Etsy', cost: '6.5% transaction + listing fees + ads', vertical: 'Handmade, vintage, craft' },
  { name: 'Amazon', cost: '8-15% referral + FBA fees + storage', vertical: 'Almost everything' },
  { name: 'eBay', cost: '13.25% final value + payment fees', vertical: 'Used, collectibles, electronics' },
  { name: 'DoorDash / UberEats', cost: '15-30% per order + delivery fees', vertical: 'Restaurants, food' },
  { name: 'Instacart', cost: '10-15% + delivery fees + price markup', vertical: 'Grocery, specialty food' },
  { name: 'Reverb', cost: '5% selling fee + payment fees', vertical: 'Music gear' },
  { name: 'Mercari / Poshmark', cost: '10-20% sell fee + payment processing', vertical: 'Apparel, used goods' },
  { name: 'Faire / Tundra', cost: '15-25% on first orders, 15% reorders', vertical: 'B2B wholesale' },
];

const liveFeatures = [
  { icon: CurrencyDollarIcon, title: '$0/month, 6% per order', desc: 'No subscription. No setup fees. Pay only when you sell, and keep 94% instead of 70-85%.' },
  { icon: ShieldCheckIcon, title: 'You own every customer', desc: 'Email, phone, order history, yours forever. Email them, remarket to them, build loyalty without a marketplace in the middle.' },
  { icon: GlobeAltIcon, title: 'Custom domain', desc: 'Your store lives on yourbrand.com, not a marketplace subpage with competitor ads next to your products.' },
  { icon: LockClosedIcon, title: 'Code-gated for B2B / regulars', desc: 'Optional private mode for repeat customers and corporate accounts. Or fully public, your choice.' },
  { icon: BoltIcon, title: 'Sub-1-second pages', desc: 'Static HTML on a global CDN. Faster than Shopify, much faster than any marketplace listing page.' },
  { icon: CpuChipIcon, title: 'AI-readable catalog', desc: 'ChatGPT, Perplexity, Google AI can read your products directly. Marketplace listings are buried. Yours surface in AI shopping.' },
  { icon: ShoppingBagIcon, title: '5 shopping channels included', desc: 'Auto-synced feeds for Google, Facebook, Bing, Pinterest, TikTok. Reach customers without paying marketplace ads.' },
  { icon: BanknotesIcon, title: 'Direct payment to your bank', desc: 'Stripe, Amazon Pay, Authorize.net, cash. Money goes straight to you. No 14-30 day marketplace payout hold.' },
  { icon: UserGroupIcon, title: 'Per-customer pricing', desc: 'Loyalty discounts, wholesale rates, friends-and-family, all enforced automatically. Marketplaces force one price for everyone.' },
  { icon: EnvelopeIcon, title: 'Branded transactional emails', desc: 'Order confirmations from yourbrand.com, not "Order from Amazon." Customers remember who they bought from.' },
];

const verticalLinks = [
  { title: 'D2C Brands', desc: 'Escape Etsy, Amazon, eBay marketplace fees. Branded storefront with shopping channel feeds.', href: '/solutions/d2c-brands', icon: ShoppingBagIcon },
  { title: 'Restaurants & Food', desc: 'Escape DoorDash, UberEats commission. Code-gated regulars portal, catering quotes.', href: '/solutions/restaurants', icon: CakeIcon },
  { title: 'Grocery & Specialty', desc: 'Escape Instacart commissions. Independent and ethnic grocer ordering portal.', href: '/solutions/grocery', icon: ShoppingCartIcon },
  { title: 'Wholesale', desc: 'Escape Faire, Tundra, and B2B marketplace fees. Code-gated catalog with full B2B enforcement.', href: '/solutions/wholesale', icon: UserGroupIcon },
];

const faqs = [
  {
    q: 'I make 80% of my sales on a marketplace. Can I really replace it?',
    a: 'Probably not all of it, at least not at first. The realistic path is gradual: keep selling on the marketplace, add a direct store, and start funneling repeat customers to it via post-purchase emails and packaging inserts. Over time, your direct channel grows and your marketplace dependency shrinks. We do not require exclusivity, and we recommend running both in parallel during the transition.',
  },
  {
    q: 'How do customers find my store if I leave the marketplace?',
    a: 'Multiple channels: (1) Existing customers: once they\'ve bought from you on the marketplace, they\'ll come direct to save money or get loyalty rewards. (2) Google Shopping, Facebook, Pinterest, TikTok feeds, all included. (3) AI-readable pages get cited by ChatGPT, Perplexity, Google AI for shopping queries. (4) SEO: sub-second static pages rank well.',
  },
  {
    q: 'What about marketplace customer service and trust signals?',
    a: 'Marketplace trust is real (returns, escrow). To match it: offer clear return policies on your store (templated for you), use Stripe or Amazon Pay (familiar consumer trust marks), display shipping/returns badges. We don\'t replicate Etsy\'s buyer protection, but you also don\'t pay 6.5%+ to Etsy.',
  },
  {
    q: 'Do I have to abandon my marketplace listings?',
    a: 'No. Many sellers run both: marketplaces for discovery, direct store for repeat customers. The math: a customer who buys from your marketplace once costs you 15-30%. The same customer buying from your direct store costs you 6%. Each repeat purchase you redirect saves real money.',
  },
  {
    q: 'How is BusinessCart different from Shopify for marketplace escape?',
    a: 'Shopify is $39+/mo before your first sale and requires $300-500/mo in apps for SEO, reviews, email, etc. BusinessCart is $0/mo, includes shopping channel feeds, AI-readability, and per-customer pricing built in. For escaping marketplaces, the unit economics matter. You do not want to swap a marketplace tax for a SaaS tax.',
  },
  {
    q: 'What are realistic results in the first 6 months?',
    a: 'Honest answer: results vary widely by category, customer base, and how aggressively you funnel marketplace buyers to your direct store. The math is asymmetric. Even a modest percentage of customers moved off-marketplace recovers significant margin, because you go from paying 15-30% per order to paying 6%. We do not have benchmark data to publish yet; talk to us about your specific category and we will share what we are seeing in similar verticals.',
  },
];

const SolutionsMarketplaceEscape: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative bg-gray-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-wider uppercase text-teal-400">Solutions · Marketplace Escape</p>
              <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                Stop Paying 30% to Marketplaces.{' '}
                <span className="text-teal-400">Own Your Customers.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-200 sm:text-xl">
                Etsy, Amazon, eBay, DoorDash, Instacart, Faire all take 6-30% of every order and keep your customer data. Build your direct store on $0/month and keep 94% of every sale, plus the relationship that drives the next one.
              </p>
              <p className="mt-4 text-sm text-gray-300">
                Run alongside marketplaces or replace them entirely · No exclusivity · Repeat customers move first
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/contact-us"
                  className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800 md:py-4 md:text-lg md:px-10"
                >
                  Start Free
                </Link>
                <a
                  href="https://www.usetgo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-3 border border-gray-200 text-base font-medium rounded-md text-gray-200 hover:text-white hover:border-white md:py-4 md:text-lg md:px-10"
                >
                  See a Live Store
                  <ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The Marketplace Tax */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">The Marketplace Tax: What You're Paying Today</h2>
              <p className="mt-4 text-gray-600">
                Marketplaces helped you start. Now they're the largest expense on your P&amp;L.
              </p>
            </div>
            <div className="mt-10 overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-sm border border-gray-200">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Marketplace</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">What you pay</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Vertical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {marketplaceCosts.map((m) => (
                    <tr key={m.name}>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{m.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{m.cost}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{m.vertical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-sm text-gray-500">
              Plus: marketplace ad spend (the only way to be visible), customer data theft, algorithm changes that can kill your business overnight.
            </p>
          </div>
        </section>

        {/* The Three Costs */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Three Costs Marketplaces Don't Show on the Invoice</h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <UserGroupIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Customer ownership</h3>
                </div>
                <p className="text-gray-600">
                  Marketplaces keep customer email, phone, and purchase history. You can't email a buyer about a new release. The marketplace can, promoting your competitor.
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <ShoppingBagIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Algorithm dependency</h3>
                </div>
                <p className="text-gray-600">
                  An Etsy ranking change, an Amazon policy update, a DoorDash featured-restaurant rotation. Any of them can cut your sales in half overnight. You're not building a business; you're renting one.
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <CurrencyDollarIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Forced ad spend</h3>
                </div>
                <p className="text-gray-600">
                  "Promoted Listings" on Etsy. Amazon Sponsored Products. Featured restaurants on DoorDash. The "free" exposure disappeared years ago. Now you pay commissions AND ads to be seen.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What you get today */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">What You Get When You Build Direct</h2>
              <p className="mt-4 text-gray-600">All features below are <Badge kind="live" /> today.</p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {liveFeatures.map((f) => (
                <div key={f.title} className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-teal-700 text-white flex-shrink-0">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <Badge kind="live" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Add-on Spotlight */}
        <section className="py-16 bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <SparklesIcon className="h-6 w-6 text-teal-400" />
              <p className="text-sm font-semibold tracking-wider uppercase text-teal-400">Premium Add-on</p>
              <Badge kind="live" />
            </div>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              One AI Add-on. Replaces the App Stack You'd Build on Shopify.
            </h2>
            <p className="mt-6 text-lg text-gray-200">
              Don't escape one tax just to pay another. The AI add-on replaces what would be 5-10 separate Shopify apps (Klaviyo, ReCharge, Judge.me, Loox, Gorgias), running heavy operations decoupled from your storefront.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Integration</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  Connect your existing email, accounting, fulfillment systems. No custom code.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Observability</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  Track which marketplace customers are converting to direct. Surface repeat-buyer patterns.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Communication</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  Post-purchase emails that bring marketplace buyers to your direct store. Loyalty automation.
                </p>
              </div>
            </div>
            <p className="mt-8 text-sm text-gray-400">
              Available as an optional add-on on any tier. Starts at $99/mo.{' '}
              <Link to="/contact-us" className="text-teal-400 hover:text-teal-300 font-semibold">
                Talk to us about pricing →
              </Link>
            </p>
          </div>
        </section>

        {/* Vertical landing pages */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Find Your Vertical</h2>
              <p className="mt-4 text-gray-600">
                Marketplace escape looks different for every business type. Pick your vertical for the specific playbook.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {verticalLinks.map((v) => (
                <Link
                  key={v.title}
                  to={v.href}
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white flex-shrink-0">
                      <v.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        {v.title}
                        <ArrowRightIcon className="ml-2 h-4 w-4 text-teal-700" />
                      </h3>
                      <p className="mt-2 text-gray-600 text-sm">{v.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* See it live */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">See a Live Store</h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              <strong>uSetGo INC</strong>, a live storefront built on BusinessCart.ai. Custom domain, sub-second pages, full catalog. Their direct store, not a marketplace listing.
            </p>
            <div className="mt-8">
              <a
                href="https://www.usetgo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                Visit www.usetgo.com
                <ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
              </a>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <PricingSection bgClass="bg-gray-50" cardBgClass="bg-white" />

        {/* FAQ */}
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center">Frequently Asked Questions</h2>
            <div className="mt-10 space-y-6">
              {faqs.map((f) => (
                <div key={f.q} className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{f.q}</h3>
                  <p className="mt-3 text-gray-600">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gray-50">
          <div className="max-w-4xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Build the Channel That Marketplaces Can't Take Away.</h2>
            <p className="mt-4 text-lg text-gray-600">
              $0/month · Keep 94% · Own every customer · Run alongside marketplaces or replace them
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-3">
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                Start Free
              </Link>
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 hover:text-gray-900 hover:border-gray-400"
              >
                Talk to Founder
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SolutionsMarketplaceEscape;
