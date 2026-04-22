import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  BanknotesIcon,
  BoltIcon,
  CheckIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MapPinIcon,
  PhotoIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TagIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const Badge: React.FC<{ kind: 'live' | 'beta' | 'q2' | 'q3' | 'q4' | 'y2027' }> = ({ kind }) => {
  const config = {
    live: { label: 'LIVE', cls: 'bg-green-100 text-green-800 ring-green-200' },
    beta: { label: 'BETA', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
    q2: { label: 'Q2 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
    q3: { label: 'Q3 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
    q4: { label: 'Q4 2026', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
    y2027: { label: '2027+', cls: 'bg-slate-100 text-slate-700 ring-slate-200' },
  }[kind];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ring-1 ring-inset ${config.cls}`}>
      {config.label}
    </span>
  );
};

const liveFeatures = [
  { icon: CurrencyDollarIcon, title: '$0/month, 6% per order', desc: 'No subscription. No setup fees. Pay only when an order comes in.' },
  { icon: LockClosedIcon, title: 'Code-gated regulars portal', desc: 'Your catalog lives behind a private code you share with regulars and corporate buyers (restaurants, offices). No competitors next to you.' },
  { icon: BanknotesIcon, title: 'Cash, card, or PO accepted', desc: 'Cash on pickup, cash on delivery, Stripe, Amazon Pay, Authorize.net, purchase orders — you decide which method per customer.' },
  { icon: MapPinIcon, title: 'Multiple locations', desc: 'Manage multiple storefronts, warehouses, or pickup points — each with operating hours and contact details.' },
  { icon: ShoppingBagIcon, title: 'Google Shopping + 4 more channels', desc: 'Auto-synced feeds for Google Shopping, Facebook, Bing, Pinterest, and TikTok. Local grocery shoppers find you on Google.' },
  { icon: BoltIcon, title: 'Sub-1-second catalog pages', desc: 'Static HTML on a global CDN. Hundreds of products, instant load on any device.' },
  { icon: TagIcon, title: 'Time-based deals', desc: 'Schedule weekly specials, weekend markdowns, end-of-day perishable discounts with start and end dates.' },
  { icon: UserGroupIcon, title: 'Per-customer pricing', desc: 'Restaurants and corporate accounts get their negotiated wholesale rate automatically. Retail customers see retail prices.' },
  { icon: CpuChipIcon, title: 'AI-readable product pages', desc: 'ChatGPT, Perplexity, and Google AI can read your catalog directly. Local searches like "Halal butcher near me" surface your products.' },
  { icon: ShieldCheckIcon, title: 'You own customer data', desc: 'Every customer\'s contact info and order history belongs to you — not Instacart, not a marketplace, not a competitor.' },
  { icon: GlobeAltIcon, title: 'Custom domain', desc: 'Your store lives on yourgrocery.com — your brand, your URL, your discoverability.' },
  { icon: PhotoIcon, title: 'Image CDN included', desc: 'High-quality product photos delivered globally. Fresh produce, perfect cuts of meat, displayed beautifully.' },
];

const betaFeatures = [
  { title: 'Delivery zone (radius geofencing)', desc: 'Set a delivery radius per location today. Automatic order rejection outside the zone is in active development.' },
  { title: 'Operating-hours enforcement', desc: 'Operating hours stored per location today. Automatic blocking of orders placed outside hours is in active development.' },
];

const roadmap = [
  { quarter: 'q3' as const, feature: 'Recurring weekly grocery orders', why: 'Standing orders for restaurants, offices, regular households' },
  { quarter: 'q4' as const, feature: 'Weight-based pricing ($/lb)', why: 'Sell produce, meat, cheese, deli items by weight at checkout' },
  { quarter: 'q4' as const, feature: 'Time-slot delivery (2-4pm windows)', why: 'Customers pick a delivery window at checkout' },
  { quarter: 'q4' as const, feature: 'Multi-language storefronts', why: 'Serve ethnic grocery customers in their preferred language' },
  { quarter: 'y2027' as const, feature: 'Substitution rules ("if no organic, use regular")', why: 'Complex UX + business logic — moved to 2027 to ship correctly rather than rush' },
  { quarter: 'y2027' as const, feature: 'EBT / SNAP payments (US)', why: 'USDA certification + TPP processor partnership is a 12-18 month process — honest timeline is 2027+' },
];

const faqs = [
  {
    q: 'Who is this best for?',
    a: 'Independent and specialty grocers: ethnic markets (Asian, Latin, Halal, Kosher, Indian), organic and health-food stores, co-ops, butcher shops, fish markets, cheese shops, bakeries, pet food and supply stores. Anyone whose customers know them and want to order pickup or scheduled delivery without paying Instacart\'s tax.',
  },
  {
    q: 'How is this different from Instacart?',
    a: 'Instacart is a marketplace that takes 10-15% per order plus delivery fees, keeps your customer data, and uses it to upsell competitors. We are a direct ordering platform — your customers come to your store, on your domain, paying you directly. You own everything.',
  },
  {
    q: 'Can I sell items by weight (per pound)?',
    a: 'Not yet — weight-based pricing ships Q3 2026. Today, products are priced per unit. For now, you can use packaged increments (1/4 lb, 1/2 lb, 1 lb pre-packaged) as separate SKUs. If weight-based pricing is critical from day one, talk to us about timing.',
  },
  {
    q: 'Do you support EBT or SNAP payments?',
    a: 'EBT/SNAP is on the 2027+ roadmap. USDA SNAP certification and partnership with a Third-Party Processor (TPP) is a 12-18 month process minimum, so we are not promising it sooner than we can deliver. Today we support cash, card (Stripe, Amazon Pay, Authorize.net), and purchase orders. If EBT is critical for your market, let us know — strong demand can accelerate prioritization.',
  },
  {
    q: 'Can restaurants and corporate buyers order from me with their own pricing?',
    a: 'Yes — that is built in. Per-customer pricing, payment methods, credit limits, min/max order amounts, monthly and yearly spend caps — all enforced automatically. Your retail customers see retail prices; your wholesale customers see their negotiated rate.',
  },
  {
    q: 'How do customers find my store?',
    a: 'Multiple ways. (1) Direct: share your custom domain and customer code with regulars. (2) Google Shopping: auto-synced product feed surfaces you in local shopping results. (3) AI assistants: your AI-readable catalog gets cited by ChatGPT, Perplexity, and Google AI for queries like "halal butcher near me" or "organic produce delivery". (4) Social: Facebook, Pinterest, TikTok feeds included.',
  },
];

const SolutionsGrocery: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative bg-gray-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-wider uppercase text-teal-400">Solutions · Grocery &amp; Specialty Food</p>
              <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                Online Ordering for Independent Grocers —{' '}
                <span className="text-teal-400">Without Instacart's Cut.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-200 sm:text-xl">
                Specialty, ethnic, organic, butcher, bakery, pet supply — your regulars order direct, you keep 100% of the margin and 100% of the customer relationship.
              </p>
              <p className="mt-4 text-sm text-gray-300">
                $0/month · No commission to a marketplace · Cash, card, or PO accepted · You own every customer
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

        {/* The Pain */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Marketplaces Are Eating Independent Grocery</h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CurrencyDollarIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Instacart takes 10-15% per order</h3>
                </div>
                <p className="text-gray-600">
                  Plus delivery fees, plus markup on your products. On already-thin grocery margins, this is the difference between profit and loss for many independents.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <UserGroupIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">You don't own your customers</h3>
                </div>
                <p className="text-gray-600">
                  Marketplaces keep customer contact info. You can't email a regular about a fresh shipment. You can't build loyalty. The marketplace can — for your competitor.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <ShoppingCartIcon className="h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Generic platforms don't fit your business</h3>
                </div>
                <p className="text-gray-600">
                  Specialty grocers, ethnic markets, butcher shops, bakeries — your customers know you and want a fast, private way to order. Generic Shopify-style storefronts make you look like every other shop.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Side by Side */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center">How We Compare</h2>
            <div className="mt-10 overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-900"></th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-500">Instacart</th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-500">Mercato / Rosie</th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-teal-700">BusinessCart.ai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Cost', '10-15% + delivery fees', '$99-499/mo', '$0-1,999/mo (3 tiers)'],
                    ['You own customer data', 'No', 'Limited', 'Yes — fully'],
                    ['Custom domain', 'No', 'Sometimes', 'Yes'],
                    ['Code-gated wholesale customers', 'No', 'No', 'Yes'],
                    ['Per-customer pricing (restaurants/offices)', 'No', 'Limited', 'Built-in'],
                    ['Cash on pickup / delivery', 'No', 'Limited', 'Yes'],
                    ['AI-readable for local search', 'No', 'No', 'Yes'],
                    ['Google Shopping feed', 'No', 'Sometimes', 'Built-in'],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{row[0]}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{row[1]}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{row[2]}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 font-semibold">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* What you get today */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Everything You Need to Sell Direct. $0 Here.</h2>
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
              One AI Add-on. Replaces 10,000 Apps.
            </h2>
            <p className="mt-6 text-lg text-gray-200">
              Connect your inventory, accounting, or supplier system without writing code. The AI add-on handles heavy operations decoupled from your storefront — pages stay fast while the AI manages the back-office.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Integration</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  Inventory, suppliers, accounting — any system, no custom code. The AI handles the data plumbing.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Observability</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  AI surfaces fast-moving items, perishable risk, supplier delays, and customer trends automatically.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI-Driven Communication</h3>
                <p className="mt-2 text-gray-300 text-sm">
                  Order confirmations, restock alerts, special-order follow-ups — handled by AI so your team focuses on customers.
                </p>
              </div>
            </div>
            <p className="mt-8 text-sm text-gray-400">
              Available on <span className="text-white font-semibold">Growth</span> and <span className="text-white font-semibold">Enterprise</span> tiers as a premium add-on.{' '}
              <Link to="/contact-us" className="text-teal-400 hover:text-teal-300 font-semibold">
                Talk to us about pricing →
              </Link>
            </p>
          </div>
        </section>

        {/* In Beta */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Honest Beta Status</h2>
              <p className="mt-4 text-gray-600">
                Built with known gaps. We tell you upfront so you can plan accordingly.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {betaFeatures.map((f) => (
                <div key={f.title} className="bg-white rounded-lg p-6 shadow-sm border border-amber-100">
                  <div className="flex items-center gap-3">
                    <Badge kind="beta" />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coming in 2026 */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900">Where We're Going</h2>
              <p className="mt-4 text-gray-600">
                Specific dates so you can plan around grocery-specific feature launches.
              </p>
            </div>
            <div className="mt-10 overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">Feature</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">Why it matters</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roadmap.map((r) => (
                    <tr key={r.feature}>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{r.feature}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{r.why}</td>
                      <td className="px-4 py-4 text-sm"><Badge kind={r.quarter} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* See it live */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">See a Live Storefront</h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              <strong>uSetGo INC</strong> — a live storefront built on BusinessCart.ai. Custom domain, sub-second catalog pages, full product listing.
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

        {/* How it works */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Live in Under a Day</h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                { step: '1', title: 'Add your catalog', desc: 'Upload products with photos, prices, and categories. Use CSV bulk-add (beta — Q2 2026) or web portal entry today.' },
                { step: '2', title: 'Configure ordering', desc: 'Set delivery vs pickup options, locations, payment methods (cash + card + PO), and per-customer rules for wholesale buyers.' },
                { step: '3', title: 'Go live', desc: 'Share your custom domain with the public, your code with regulars and wholesale customers. Google Shopping feed auto-syncs.' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-700 text-white text-2xl font-bold mx-auto">
                    {s.step}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Free to Start. Premium When You Need It.</h2>
              <p className="mt-3 text-lg text-gray-600">$0 to start · No setup costs · 30-day money-back on Growth and Enterprise</p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col">
                <h3 className="text-2xl font-bold text-gray-900">Starter</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">$0<span className="text-lg font-medium text-gray-500"> / mo</span></p>
                <ul className="mt-6 space-y-3 flex-grow">
                  {['Code-gated catalog portal', 'Custom domain', 'Stripe + cash payments', '1 location'].map((i) => (
                    <li key={i} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                      <span className="ml-3 text-base text-gray-700">{i}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">6% per order · Capped at $5/order</p>
                <Link
                  to="/contact-us"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Get Started
                </Link>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col ring-2 ring-teal-700">
                <h3 className="text-2xl font-bold text-gray-900">Growth</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">$499<span className="text-lg font-medium text-gray-500"> / mo</span></p>
                <ul className="mt-6 space-y-3 flex-grow">
                  {['Everything in Starter', 'Wholesale customer pricing + limits', 'Multiple locations', 'All payment gateways (PO, Amazon Pay, Authorize.net)', 'AI add-on: $99/mo (basic)'].map((i) => (
                    <li key={i} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                      <span className="ml-3 text-base text-gray-700">{i}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">+ 1% per order · 30-day money-back</p>
                <Link
                  to="/contact-us"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Contact Us
                </Link>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col">
                <h3 className="text-2xl font-bold text-gray-900">Enterprise</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">$1,999<span className="text-lg font-medium text-gray-500"> / mo</span></p>
                <ul className="mt-6 space-y-3 flex-grow">
                  {['Everything in Growth', 'Full AI add-on: $499/mo (full suite + dedicated AI engineer)', 'Dedicated success manager + SLA', 'Volume processing rates'].map((i) => (
                    <li key={i} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                      <span className="ml-3 text-base text-gray-700">{i}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">+ 0.25% per order · 30-day money-back</p>
                <Link
                  to="/contact-us"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>

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
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Stop Letting Marketplaces Eat Your Margin.</h2>
            <p className="mt-4 text-lg text-gray-600">
              $0/month · 6% per order · You own every customer · Cash, card, or PO accepted
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

export default SolutionsGrocery;
