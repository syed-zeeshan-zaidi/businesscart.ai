import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PricingSection from '../components/PricingSection';
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CheckIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  CakeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const solutions = [
  { title: 'D2C Brands', href: '/solutions/d2c-brands', icon: ShoppingBagIcon, audience: 'Side hustlers, Etsy/Amazon escapees, Shopify defectors', summary: 'Branded online store with sub-second pages, AI-readable products, 5 shopping channels.' },
  { title: 'AI-Era Commerce', href: '/solutions/ai-commerce', icon: CpuChipIcon, audience: 'SEO-savvy merchants betting on AI discovery', summary: 'Static HTML, schema.org, llms.txt, markdown product pages — get cited by ChatGPT, Perplexity, Google AI.' },
  { title: 'Wholesale & B2B', href: '/solutions/wholesale', icon: UserGroupIcon, audience: 'SMB wholesalers running orders via email', summary: 'Per-customer pricing, credit limits, spend caps, quote negotiation — enforced automatically.' },
  { title: 'Restaurants & Food', href: '/solutions/restaurants', icon: CakeIcon, audience: 'Food businesses DoorDash serves poorly', summary: 'Direct ordering for catering, meal-prep, bakeries, food trucks, corporate lunch — no 30% tax.' },
  { title: 'Grocery & Specialty', href: '/solutions/grocery', icon: ShoppingCartIcon, audience: 'Independent specialty grocers', summary: 'Online ordering for ethnic, organic, butcher, bakery, pet supply — without Instacart\'s cut.' },
  { title: 'Manufacturers', href: '/solutions/manufacturers', icon: CubeIcon, audience: 'Manufacturers selling to distributor networks', summary: 'Distributor ordering portal. Per-distributor pricing, MOQ, lead times, credit limits enforced.' },
  { title: 'Distributors', href: '/solutions/distributors', icon: ArrowsRightLeftIcon, audience: 'Distributors managing supplier + customer sides', summary: 'Per-customer tier pricing, multi-warehouse, multi-supplier accounts. Beats Amazon Business.' },
  { title: 'Marketplace Escape', href: '/solutions/marketplace-escape', icon: CurrencyDollarIcon, audience: 'Anyone paying marketplace commissions', summary: 'Stop paying 15-30% to Etsy, Amazon, eBay, DoorDash, Instacart, Faire. Build direct, keep 94%.' },
];

const pillars = [
  {
    icon: GlobeAltIcon,
    title: 'Public Storefronts (D2C)',
    desc: 'Auto-generated branded site on your custom domain. Sub-second load, AI-readable, 5 shopping channels included. For selling to anyone who finds you.',
  },
  {
    icon: LockClosedIcon,
    title: 'Private Portals (B2B)',
    desc: 'Code-gated catalog with per-customer pricing, credit limits, spend caps, and quote workflow — enforced automatically. For selling to wholesale or repeat customers.',
  },
  {
    icon: SparklesIcon,
    title: 'One AI Add-on (Premium)',
    desc: 'Replaces the 10-app integration, observability, and automation stack. Connects ERP, accounting, CRM — runs heavy operations decoupled from your storefront.',
  },
];

const whyUs = [
  { icon: CurrencyDollarIcon, title: 'Pricing Scales With You', desc: 'Every feature in every tier — no feature locks. Starter: $0/mo + 6% per order (capped at $5). Auto-promotes to Growth ($499/mo) at 100+ orders/mo, Enterprise ($1,999/mo) at 1,001+. Your bill grows only when your business does.' },
  { icon: BoltIcon, title: 'Sub-1-Second Pages', desc: 'Static HTML on a global CDN. Faster than any Shopify theme, by default — no apps, no plugins, no work.' },
  { icon: CpuChipIcon, title: 'AI-Readable from Day One', desc: 'llms.txt + schema.org + markdown product pages. ChatGPT, Perplexity, and Google AI can read your catalog directly.' },
  { icon: ShieldCheckIcon, title: 'Direct Payment to Your Bank', desc: 'Stripe, Amazon Pay, Authorize.net, or cash. Money goes straight to you. We never touch it. You own every customer.' },
  { icon: UserGroupIcon, title: 'Per-Customer B2B Power', desc: 'Per-customer pricing, credit limits, spend caps, quote workflow — enforced automatically at every order. Available on every tier.' },
  { icon: SparklesIcon, title: 'One AI Add-on Replaces Dozens', desc: 'Connect any ERP, accounting, or CRM without writing code. Decoupled from your storefront so heavy operations never slow your pages.' },
];

const faqs = [
  {
    q: 'What does this actually cost me?',
    a: 'Three tiers — every feature included in every tier. Tier auto-applies based on your monthly order volume; no manual upgrades, no feature locks. Starter ($0/mo + 6% per order, capped at $5) for up to 100 orders/month. Growth ($499/mo + 1% per order) for 101–1,000 orders. Enterprise ($1,999/mo + 0.25% per order) at 1,001+. Optional AI add-on starts at $99/mo on any tier. 30-day money-back on Growth and Enterprise.',
  },
  {
    q: 'How is this different from Shopify?',
    a: 'Shopify is $39+/month before your first sale, plus $300-500/month in essential apps (Klaviyo, ReCharge, Judge.me, etc.), and its themes render with JavaScript — invisible to AI assistants. BusinessCart is $0/month, ships AI-readable static HTML, includes 5 shopping channels and a B2B portal built in. The whole app stack collapses into one platform.',
  },
  {
    q: 'Do I need a developer?',
    a: 'No. Sign up, add your products, share your URL or customer codes. Static HTML, SEO meta tags, schema.org, sitemap, robots.txt, and shopping feeds are all auto-generated when you save a product.',
  },
  {
    q: 'Can I migrate from Shopify, Etsy, or my existing tools?',
    a: 'Manual product upload works today. Bulk CSV import is in beta and ships Q2 2026. Customer migration is straightforward — most marketplaces don\'t share customer emails anyway, but you can collect them on a launch announcement.',
  },
  {
    q: 'Which solution page should I read first?',
    a: 'Pick the one closest to your business in the Solutions grid above — each card links directly. If your business spans multiple (e.g., D2C + wholesale), start with the larger revenue side. Or talk to founder for a tailored recommendation.',
  },
  {
    q: 'Can I leave if I don\'t like it?',
    a: 'Anytime. Products, customers, orders, and images are all exportable as CSV. No contract, no monthly fees — leaving costs nothing.',
  },
];

const LandingPage: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />

      <main>
        {/* Hero — split: text left, live store proof right */}
        <section className="relative bg-gray-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              {/* Left: hero text */}
              <div>
                <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                  Your Online Store. Your B2B Portal.{' '}
                  <span className="text-teal-400">$0 Monthly.</span>
                </h1>
                <p className="mt-6 text-lg text-gray-200 sm:text-xl">
                  One platform built for D2C brands, wholesalers, restaurants, grocers, and manufacturers. Sub-second pages, AI-readable products, no plugin stack. Pay only when you sell.
                </p>
                <p className="mt-4 text-sm text-gray-300">
                  $0 monthly · Pay only per order · Live in minutes · Powering usetgo.com today
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/contact-us"
                    className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800 md:py-4 md:text-lg md:px-10"
                  >
                    Start Free
                  </Link>
                  <a
                    href="#solutions"
                    className="inline-flex items-center justify-center px-8 py-3 border border-gray-200 text-base font-medium rounded-md text-gray-200 hover:text-white hover:border-white md:py-4 md:text-lg md:px-10"
                  >
                    Find Your Solution
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </a>
                </div>
              </div>

              {/* Right: live store proof card */}
              <div>
                <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                  {/* Browser bar mock */}
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400" />
                      <div className="h-3 w-3 rounded-full bg-yellow-400" />
                      <div className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                    <div className="ml-3 flex-1 bg-white rounded px-3 py-1 text-xs text-gray-600 font-mono truncate">
                      🔒 www.usetgo.com
                    </div>
                  </div>
                  {/* Proof body */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        LIVE NOW
                      </span>
                      <span className="text-xs text-gray-500">Built on BusinessCart.ai</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">uSetGo INC</p>
                    <p className="mt-1 text-sm text-gray-600">A live D2C storefront powered by BusinessCart.ai — custom domain, full catalog, sub-second pages.</p>

                    <ul className="mt-5 space-y-2.5">
                      {[
                        'Sub-1-second page load',
                        'AI-readable (llms.txt + schema.org)',
                        'Custom domain included',
                        'Auto-generated SEO + sitemap',
                      ].map((item) => (
                        <li key={item} className="flex items-start text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-teal-700 mt-0.5 flex-shrink-0" />
                          <span className="ml-2">{item}</span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href="https://www.usetgo.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                    >
                      Visit www.usetgo.com
                      <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solutions Grid — segmentation moment */}
        <section id="solutions" className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Find Your Solution</h2>
              <p className="mt-4 text-lg text-gray-600">
                Eight tailored playbooks. Pick the one closest to your business — each shows what's live today, what's in beta, and what's coming in 2026.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {solutions.map((s) => (
                <Link
                  key={s.title}
                  to={s.href}
                  className="bg-gray-50 rounded-lg p-6 hover:bg-white hover:shadow-md transition-all border border-gray-200 group flex flex-col"
                >
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mb-4">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-teal-700 flex items-center">
                    {s.title}
                    <ArrowRightIcon className="ml-1.5 h-4 w-4 text-teal-700 transition-transform group-hover:translate-x-1" />
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 flex-grow">{s.summary}</p>
                  <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">For: {s.audience}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* What Is This — 3-pillar architecture */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">How BusinessCart Works</h2>
              <p className="mt-4 text-lg text-gray-600">
                One platform, three distinct capabilities. Use any combination — or all three.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {pillars.map((p) => (
                <div key={p.title} className="bg-white rounded-lg p-8 shadow-sm">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mb-4">
                    <p.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-3 text-gray-600">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us — 6 universal benefits */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Why Build on BusinessCart</h2>
              <p className="mt-4 text-lg text-gray-600">
                Six things that hold true regardless of what you sell or who you sell to.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {whyUs.map((w) => (
                <div key={w.title} className="flex flex-col">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white mb-4">
                    <w.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{w.title}</h3>
                  <p className="mt-2 text-gray-600">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works — 4 steps */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Live in Under an Hour</h2>
              <p className="mt-4 text-lg text-gray-600">
                Four steps from signup to your first order.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                { step: '1', title: 'Sign up free', desc: 'No credit card. Set your brand colors, upload your logo.' },
                { step: '2', title: 'Add your products', desc: 'Upload images, set prices, write descriptions. Manual today, bulk CSV in Q2 2026.' },
                { step: '3', title: 'Share your URL or customer codes', desc: 'Public storefront, private B2B portal, or both — your choice per customer.' },
                { step: '4', title: 'Get paid directly', desc: 'Stripe, Amazon Pay, cash — money goes straight to your bank. We never touch it.' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-700 text-white text-2xl font-bold mx-auto">
                    {s.step}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing - Auto-Scaling, Every Feature in Every Tier (shared component) */}
        <PricingSection bgClass="bg-white" cardBgClass="bg-gray-50" />

        {/* FAQ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center sm:text-4xl">Frequently Asked Questions</h2>
            <div className="mt-10 space-y-6">
              {faqs.map((f) => (
                <div key={f.q} className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{f.q}</h3>
                  <p className="mt-3 text-gray-600">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-white">
          <div className="max-w-4xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Ready to Own Your Commerce?</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Customers</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Revenue</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Data</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Store</span>
            </div>
            <p className="mt-6 text-lg text-gray-600">
              $0 to start · 6% per order · No surprise fees · No app stack · No marketplace commissions
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

export default LandingPage;
