import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BanknotesIcon, UserGroupIcon, PuzzlePieceIcon, CloudArrowUpIcon, CogIcon, ServerIcon, UserCircleIcon, AdjustmentsHorizontalIcon, CommandLineIcon, CpuChipIcon, CheckIcon, ClipboardDocumentListIcon, GlobeAltIcon, CubeIcon } from '@heroicons/react/24/outline';
import { ShoppingCartIcon } from '@heroicons/react/24/solid';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />

      <main>
        {/* Hero Section */}
        <div className="relative bg-gray-800 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative z-10 pt-16 pb-8 sm:pt-24 sm:pb-16 md:pt-32 md:pb-20 lg:max-w-2xl lg:w-full lg:pt-40 lg:pb-28 xl:pt-48 xl:pb-32">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="sm:text-center lg:text-left">
                  <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                    <span className="block xl:inline">Stop Paying Middlemen.</span>{' '}
                    <span className="block text-teal-400 xl:inline">Start Owning Your Commerce.</span>
                  </h1>
                  <p className="mt-3 text-base text-gray-200 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                    BusinessCart.ai gives your business its own branded storefront, per-customer B2B configuration, and direct payment collection — no marketplace fees, no generic platforms, no compromises.
                  </p>
                  <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                    <div className="rounded-md shadow">
                      <Link
                        to="/contact-us"
                        className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800 md:py-4 md:text-lg md:px-10"
                      >
                        Request a Demo
                      </Link>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-3">
                      <a
                        href="#how-it-works"
                        className="w-full flex items-center justify-center px-8 py-3 border border-gray-200 text-base font-medium rounded-md text-gray-200 hover:text-white hover:border-white md:py-4 md:text-lg md:px-10"
                      >
                        See How It Works
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 flex items-center justify-center p-8">
            <ShoppingCartIcon className="h-auto w-full max-w-lg text-teal-700 opacity-20" />
          </div>
        </div>

        {/* Social Proof */}
        <div className="bg-gray-100 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-gray-600 tracking-wider uppercase">
                Trusted by businesses from Main Street to Enterprise
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-5">
                {/* Placeholder Logos */}
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-500 font-bold text-2xl">Manufacturers</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-500 font-bold text-2xl">Distributors</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <p className="text-gray-500 font-bold text-2xl">Retail</p>
                </div>
                <div className="col-span-1 flex justify-center md:col-span-3 lg:col-span-1">
                  <p className="text-gray-500 font-bold text-2xl">Brands</p>
                </div>
                <div className="col-span-2 flex justify-center md:col-span-3 lg:col-span-1">
                  <p className="text-gray-500 font-bold text-2xl">Enterprise</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The Problem Section */}
        <div className="py-16 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">The Platforms You Rely On Weren't Built for Your Business</h2>
              <p className="mt-4 text-lg text-gray-500">
                Marketplace fees eating your margins. B2B platforms that treat every customer the same. Storefronts too slow to convert. BusinessCart.ai replaces all of it.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">They Take Your Revenue</h3>
                <p className="mt-2 text-base text-gray-500">
                  15-30% commission on every order. Your margins shrink while the platform profits from your hard work.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">They Own Your Customers</h3>
                <p className="mt-2 text-base text-gray-500">
                  You can't email them. You can't remarket to them. When a customer orders through a marketplace, that customer belongs to the platform.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <PuzzlePieceIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Every Customer Gets the Same Deal</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your B2B customers have different pricing, payment terms, and delivery needs — but your platform forces one-size-fits-all rules on all of them.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CpuChipIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Slow Pages Lose Customers</h3>
                <p className="mt-2 text-base text-gray-500">
                  Heavy JavaScript frameworks, bloated code, poor SEO. Your storefront takes seconds to load while customers leave.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Private Commerce Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Your Own Private Commerce — Like DoorDash, But You Own Everything</h2>
              <p className="mt-4 text-lg text-gray-500">
                Your products, your customers, your rules. Share your company code and customers access your private catalog through our portal or mobile app. You collect the payment. You keep the data.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CogIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Private, Code-Gated Access</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your catalog is private. Customers can only see your products when you share your company code. No public listing, no competitors sitting next to you.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CloudArrowUpIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Web Portal & Mobile App</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your customers use the BusinessCart.ai portal or mobile app to browse your catalog, place orders, and track deliveries — just like DoorDash, but exclusively yours.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Direct Payment Collection</h3>
                <p className="mt-2 text-base text-gray-500">
                  Connect your Stripe or Amazon Pay account. Customers pay you directly — we never touch your money.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <ClipboardDocumentListIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Cart, Quotes & Checkout</h3>
                <p className="mt-2 text-base text-gray-500">
                  Full shopping cart, quote-based checkout, payment processing, and order confirmation. Standard orders or negotiable quotes — your choice per customer.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <ServerIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Pickup, Dropoff, or Shipping</h3>
                <p className="mt-2 text-base text-gray-500">
                  Manage multiple locations — warehouses, storefronts, pickup points — each with operating hours and capacity. Customers pick up, your team drops off, or you ship via carrier.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <UserCircleIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Customer Accounts & Company Switching</h3>
                <p className="mt-2 text-base text-gray-500">
                  Each customer gets their own account with order history, saved addresses, and the ability to switch between multiple suppliers — all from one login.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* B2B Section */}
        <div className="py-16 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">B2B Commerce That Knows Every Customer Is Different</h2>
              <p className="mt-4 text-lg text-gray-500">
                Set unique pricing, payment terms, delivery options, and order limits for each customer — enforced automatically at checkout, not tracked in spreadsheets.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <AdjustmentsHorizontalIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Per-Customer Pricing</h3>
                <p className="mt-2 text-base text-gray-500">
                  Assign a specific discount percentage to each customer. Applied automatically to every order they place.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Per-Customer Payment Methods</h3>
                <p className="mt-2 text-base text-gray-500">
                  Customer A pays via Stripe. Customer B uses purchase orders. Customer C pays cash on pickup. You control who gets what.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <ServerIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Per-Customer Delivery Options</h3>
                <p className="mt-2 text-base text-gray-500">
                  Restrict delivery methods per customer — some get shipping, some get pickup only. Each customer sees only their options.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <PuzzlePieceIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Order Limits & Credit</h3>
                <p className="mt-2 text-base text-gray-500">
                  Set min/max order amounts, quantity limits, monthly and yearly spending caps, and credit limits per customer relationship.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CommandLineIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Quote Negotiation</h3>
                <p className="mt-2 text-base text-gray-500">
                  Full negotiation workflow — customer proposes, you counter-offer, add comments, apply discounts, approve. Complete history preserved.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Multi-Company Customers</h3>
                <p className="mt-2 text-base text-gray-500">
                  A single buyer can be associated with multiple suppliers, each with independent configurations. All managed from one account.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CloudArrowUpIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">API-First Platform</h3>
                <p className="mt-2 text-base text-gray-500">
                  Every operation available via REST API. The portal is one interface — build your own, integrate with existing systems, or use ours.
                </p>
              </div>
              <div className="flex flex-col items-center text-center relative">
                <span className="absolute -top-2 right-0 bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CubeIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Custom Catalogs</h3>
                <p className="mt-2 text-base text-gray-500">
                  Assign specific products and categories to each customer. Company-level catalog isolation is available today.
                </p>
              </div>
              <div className="flex flex-col items-center text-center relative">
                <span className="absolute -top-2 right-0 bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <GlobeAltIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Multi-Language & Currency</h3>
                <p className="mt-2 text-base text-gray-500">
                  Support for multiple languages and currencies so your customers can shop in their preferred language and pay in their local currency.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">The Fastest Storefront Your Customers Will Ever Use</h2>
              <p className="mt-4 text-lg text-gray-500">
                Every company gets an auto-generated storefront with your branding, custom domain, and built-in checkout. And unlike other platforms, it loads in under a second, ranks higher on Google, and costs almost nothing to run.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CpuChipIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Sub-Second Page Load</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your storefront loads in under 1 second — on any device, any connection. Faster pages mean more conversions and lower bounce rates.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CheckIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">SEO That Works Out of the Box</h3>
                <p className="mt-2 text-base text-gray-500">
                  Sitemap, meta tags, OpenGraph, schema.org markup — all generated automatically for every product and page. No plugins, no configuration, no SEO expert needed.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CommandLineIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">AI & LLM Ready</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your product catalog is structured for AI tools and voice assistants to understand — giving your store visibility in the next generation of search.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CloudArrowUpIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">99.99% Uptime, Globally Distributed</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your store is served from 200+ locations worldwide. Traffic spikes don't slow you down. No server to crash, no downtime to worry about.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Lower Your Ad Costs</h3>
                <p className="mt-2 text-base text-gray-500">
                  Fast pages and clean code mean higher Google Quality Scores, lower cost-per-click, and better ad placement — your marketing budget goes further without changing a single campaign.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CogIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Modern, Accessible, Standards-Compliant</h3>
                <p className="mt-2 text-base text-gray-500">
                  Semantic HTML, proper heading structure, fast on mobile, accessible to screen readers. Your store meets modern web standards without extra work.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Section */}
        <div className="py-16 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Your AI-Powered Operations Team</h2>
              <p className="mt-4 text-lg text-gray-500">
                Most businesses need developers and consultants to connect systems, analyze data, and automate communication. BusinessCart.ai's AI handles it for you — across your entire commerce operation.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CpuChipIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">AI-Driven Integration</h3>
                <p className="mt-4 text-base text-gray-500">
                  Connect your ERP, CRM, and business systems without writing code. Our AI automates data pipelines — syncing orders, inventory, and customer data across your tools.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <CheckIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">AI-Driven Observability</h3>
                <p className="mt-4 text-base text-gray-500">
                  Get deep insights into your sales, customers, and operations. AI-powered analytics surfaces what matters — no dashboards to build, no reports to configure.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-teal-700 text-white">
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">AI-Driven Inter-Communication</h3>
                <p className="mt-4 text-base text-gray-500">
                  Let AI handle the routine back-and-forth — order updates, quote follow-ups, status notifications. Your team focuses on decisions, not data entry.
                </p>
              </div>
            </div>
            <div className="mt-10 text-center">
              <p className="text-sm text-gray-500">
                Available as a premium addon.{' '}
                <Link to="/contact-us" className="text-teal-700 hover:text-teal-800 font-semibold">
                  Contact us to learn more →
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div id="how-it-works" className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Live in Three Steps</h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-700 text-white text-2xl font-bold">
                  1
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Create Your Company Account</h3>
                <p className="mt-2 text-base text-gray-500">
                  Sign up, set your company name, upload your logo, and choose your brand colors.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-700 text-white text-2xl font-bold">
                  2
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Add Your Products</h3>
                <p className="mt-2 text-base text-gray-500">
                  Upload your catalog with images, prices, categories, and deal pricing. Connect your payment gateway.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-700 text-white text-2xl font-bold">
                  3
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900">Launch Your Store</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your storefront goes live and your portal catalog is ready. Share your company code with customers or your storefront link with the world.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="py-16 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Simple Pricing. No Monthly Fees.</h2>
              <p className="mt-4 text-lg font-semibold text-gray-900">
                You only pay a small percentage per order.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">No Subscriptions</span>
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">No Setup Costs</span>
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">No Hidden Charges</span>
              </div>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col">
                <h3 className="text-2xl font-bold text-gray-900">Starter</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">$0<span className="text-lg font-medium text-gray-500"> / mo</span></p>
                <ul className="mt-6 space-y-4 flex-grow">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Private commerce portal access</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Storefront with custom domain</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Standard checkout</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Basic B2B configuration</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Stripe + offline payments</span>
                  </li>
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">6% per order</p>
                <Link
                  to="/register"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Get Started
                </Link>
              </div>
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col ring-2 ring-teal-700">
                <h3 className="text-2xl font-bold text-gray-900">Growth</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">$0<span className="text-lg font-medium text-gray-500"> / mo</span></p>
                <ul className="mt-6 space-y-4 flex-grow">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Everything in Starter</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Negotiable quotes</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Multiple locations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">All payment gateways</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Full B2B configuration</span>
                  </li>
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">5% + $1 per order</p>
                <Link
                  to="/contact-us"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Contact Us
                </Link>
              </div>
              <div className="bg-gray-50 rounded-lg shadow-lg p-8 flex flex-col">
                <h3 className="text-2xl font-bold text-gray-900">Enterprise</h3>
                <p className="mt-2 text-4xl font-extrabold text-teal-700">Custom</p>
                <ul className="mt-6 space-y-4 flex-grow">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Everything in Growth</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">AI-powered integration</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">AI observability & analytics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">AI inter-communication</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-teal-700 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-base text-gray-700">Dedicated support & SLA</span>
                  </li>
                </ul>
                <p className="mt-6 text-sm font-semibold text-gray-900 text-center">Volume pricing</p>
                <Link
                  to="/contact-us"
                  className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gray-50">
          <div className="max-w-4xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              <span className="block">Ready to Own Your Commerce?</span>
            </h2>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Customers</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Revenue</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Data</span>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-teal-100 text-teal-800">Your Store</span>
            </div>
            <p className="mt-4 text-lg leading-6 text-gray-500">
              Private commerce portal, per-customer B2B configuration, and the fastest storefronts on the web — all in one platform. No monthly fees — you only pay per order.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-3">
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-700 hover:bg-teal-800"
              >
                Request a Demo
              </Link>
              <Link
                to="/contact-us"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 hover:text-gray-900 hover:border-gray-400"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;