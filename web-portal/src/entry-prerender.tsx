// Stub browser globals so Navbar renders as logged-out state for crawlers
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
globalThis.localStorage = noopStorage as Storage;
globalThis.sessionStorage = noopStorage as Storage;

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import React from 'react';
import LandingPage from './pages/LandingPage';
import Compare from './pages/Compare';
import Industries from './pages/Industries';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import blogPosts from './data/blogPosts';
import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
const baseUrl = 'https://businesscart.ai';

interface PageEntry {
  route: string;
  component: React.ReactElement;
  output: string;
  title?: string;
  description?: string;
  schema?: string;
}

const blogSchema = (post: typeof blogPosts[0]) => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  description: post.metaDescription,
  datePublished: post.date,
  author: { '@type': 'Organization', name: 'BusinessCart.ai' },
  publisher: { '@type': 'Organization', name: 'BusinessCart.ai', url: baseUrl },
  mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
});

const pages: PageEntry[] = [
  {
    route: '/',
    component: <LandingPage />,
    output: 'index.html',
    title: 'BusinessCart.ai: Your Commerce, Your Rules.',
    description: 'Zero monthly fees. Your own branded online store with sub-1-second loads, auto SEO, AI-ready product catalogs, and built-in B2B features. Pay only when you sell.',
  },
  {
    route: '/compare',
    component: <Compare />,
    output: 'compare/index.html',
    title: 'BusinessCart.ai vs. The Competition',
    description: 'Compare BusinessCart.ai with Shopify, WooCommerce, and marketplaces. See pricing, features, and performance side by side.',
    schema: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'BusinessCart.ai vs. The Competition', url: `${baseUrl}/compare` }),
  },
  {
    route: '/industries',
    component: <Industries />,
    output: 'industries/index.html',
    title: 'Industries — BusinessCart.ai',
    description: 'See how BusinessCart.ai serves restaurants, retail, wholesale, manufacturing, and more with zero monthly fees.',
    schema: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Industries', url: `${baseUrl}/industries` }),
  },
  {
    route: '/blog',
    component: <Blog />,
    output: 'blog/index.html',
    title: 'Blog — BusinessCart.ai',
    description: 'Insights on e-commerce, AI, and growing your business online.',
    schema: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'BusinessCart.ai Blog',
      description: 'Insights on e-commerce, AI, and growing your business online.',
      url: `${baseUrl}/blog`,
      publisher: { '@type': 'Organization', name: 'BusinessCart.ai', url: baseUrl },
    }),
  },
  ...blogPosts.map((post) => ({
    route: `/blog/${post.slug}`,
    component: <BlogPost slug={post.slug} />,
    output: `blog/${post.slug}/index.html`,
    title: `${post.title} — BusinessCart.ai`,
    description: post.metaDescription,
    schema: blogSchema(post),
  })),
];

for (const page of pages) {
  const html = renderToString(
    <StaticRouter location={page.route}>
      {page.component}
    </StaticRouter>
  );

  let rendered = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`
  );

  if (page.title) {
    rendered = rendered.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);

    let headInsert =
      `<meta name="description" content="${page.description}" />\n` +
      `<meta property="og:title" content="${page.title}" />\n` +
      `<meta property="og:description" content="${page.description}" />\n` +
      `<meta property="og:type" content="article" />\n` +
      `<meta property="og:url" content="${baseUrl}${page.route}" />\n` +
      `<link rel="canonical" href="${baseUrl}${page.route}" />\n`;

    // Replace Product schema with Article schema for blog posts
    if (page.schema) {
      rendered = rendered.replace(
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">${page.schema}</script>`
      );
    }

    rendered = rendered.replace('</head>', headInsert + '</head>');
  }

  const outputPath = path.join(distDir, page.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Pre-rendered ${page.route} → dist/${page.output}`);
}

// Generate sitemap.xml
const sitemapEntries = pages.map((page) => {
  const priority = page.route === '/' ? '1.0' : page.route === '/blog' ? '0.8' : '0.7';
  return `  <url>\n    <loc>${baseUrl}${page.route}</loc>\n    <priority>${priority}</priority>\n  </url>`;
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
console.log('Generated sitemap.xml');

// Generate robots.txt
const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml

# AI/LLM context: ${baseUrl}/llms.txt
`;

fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
console.log('Generated robots.txt');

// Generate llms.txt
const blogPostEntries = blogPosts.map((post) =>
  `- [${post.title}](${baseUrl}/blog/${post.slug})\n  ${post.metaDescription}`
).join('\n');

const llmsTxt = `# BusinessCart.ai

> Your Commerce, Your Rules.

BusinessCart.ai is a US-based e-commerce platform that gives businesses their own branded online store, private commerce portal, and B2B tools — with zero monthly fees. You pay only when you make a sale. The platform serves businesses of any size, from local restaurants to national distributors.

## Company Information

- **Website:** ${baseUrl}
- **Email:** help@businesscart.ai
- **Phone:** +1 (657) 501-0200
- **Location:** United States (remote-first company)
- **Support:** US-based team, responds within one business day

---

## Pillar 1: Private Commerce (Portal)

The portal-based commerce system where companies create a private, code-gated shopping experience. Customers access the web portal or mobile app, enter a company code, and get their own branded catalog with cart, checkout, and order tracking.

### User Roles

- **admin** — Platform administrator. Creates company codes, manages the platform.
- **company** — Seller. Manages products, customers, orders, locations, payment gateways.
- **customer** — Buyer. Browses catalogs, places orders, manages addresses. Can associate with multiple companies.
- **b2c** — D2C storefront customer. Can checkout on a public storefront without portal registration.

### Company Registration & Access

- BusinessCart.ai provides a business code to the company after verification.
- Company registers with the code and gets a dashboard to manage everything.
- Company generates customer codes and distributes them to their buyers.
- Customer registers with a customer code and associates with that company.
- A single customer can associate with multiple companies and switch between them.
- Catalog is private — only associated customers can see a company's products.

### Product Catalog

- Companies manage their own product catalog.
- Each product has: name, description, price, category, images, stock quantity, deal pricing, and custom attributes.
- Product images served through a global CDN for fast loading.
- Company-level catalog isolation — each company has their own products.

### Cart & Checkout

- Standard shopping cart: add, update, remove items.
- Two-step checkout: cart → quote generation → payment → order confirmation.
- Supports both standard orders (direct checkout) and quote-based orders (negotiation flow).
- Taxes calculated automatically.
- Promotions and discounts applied at checkout.

### Payment Gateways

Companies connect their own payment processor. BusinessCart.ai never touches the money.

- **Stripe** — Redirect to Stripe Checkout hosted page.
- **Amazon Pay** — Button-based integration. Server signs payload, frontend renders Amazon Pay button.
- **Authorize.net** — Redirect to Accept Hosted payment page.
- **Offline methods** (no credentials needed):
  - Pickup & Pay — Customer pays at pickup location.
  - Deliver & Pay — Customer pays on delivery.
  - Purchase Order — B2B invoicing.

Payment gateway credentials are stored encrypted (AES-256-GCM). Payment sessions are tracked with automatic expiry.

### Locations

Companies can manage multiple physical locations:

- Warehouses, storefronts, pickup points.
- Each location has: name, address, operating hours, capacity.
- Customers select pickup or delivery location during checkout.
- Supports pickup, dropoff (company delivers), and shipping.

### Order Management

- Orders tracked from placement through fulfillment.
- Company dashboard shows pending orders and order history.
- Customer dashboard shows their order history across all associated companies.
- Order confirmation with full details sent after purchase.

### Web Portal & Mobile App

- Web portal at businesscart.ai for desktop and mobile browsers.
- Mobile app for iOS and Android.
- Both share the same API backend.
- Customers browse, order, and track deliveries from either interface.

---

## Pillar 2: B2B Commerce

The per-customer configuration layer that sits on top of Private Commerce. Every customer relationship can have unique rules enforced automatically at checkout.

### Per-Customer Configuration

Each company can set unique rules per customer:

- **Pricing** — Discount percentage applied automatically to every order.
- **Payment methods** — Which payment options the customer sees. Different customers can have different methods.
- **Delivery options** — Restrict per customer: shipping, pickup, dropoff. Each customer sees only their allowed options.
- **Order limits** — Minimum and maximum order amounts, quantity limits per product.
- **Spending caps** — Monthly and yearly spending limits per customer.
- **Credit limits** — Credit limit per customer relationship.

If a customer has no custom configuration for a setting, the company's default configuration applies automatically.

### Quote Negotiation

Full negotiation workflow for B2B orders:

1. Customer adds items to cart and submits for a quote.
2. System generates a quote with taxes, shipping, and promotions applied.
3. Company can counter-offer: adjust prices, add comments, apply discounts.
4. Customer can accept, reject, or counter.
5. On approval, the quote converts to an order.
6. Complete negotiation history is preserved on each quote.

### Multi-Company Customers

- A single buyer account can be associated with multiple suppliers.
- Each supplier relationship has independent configuration (pricing, payment methods, delivery options).
- Customer switches between companies from one login.
- Order history maintained per company relationship.

### API-First Platform

- Every operation available via REST API.
- The portal is one interface — companies can build their own, integrate with existing systems, or use the provided portal.

### Planned B2B Features

- **Custom Catalogs** (coming soon) — Assign specific products and categories to each customer.
- **Multi-Language & Currency** (coming soon) — Support for multiple languages and currencies.

---

## Pillar 3: D2C Storefronts

Every company gets an auto-generated public storefront — a standalone website with their branding that anyone can visit and buy from without portal registration.

### How Storefronts Work

- Auto-generated when a company updates their profile, products, or branding.
- Pure static HTML — no JavaScript framework, no client-side rendering needed.
- Loads in under 1 second on any device.
- Served from a global CDN with 99.99% uptime.
- Custom domain support included at no extra cost (e.g., www.yourstore.com).
- Preview subdomain provided automatically (e.g., yourcompany.businesscart.ai).

### AI & LLM Readiness

- Product catalogs are in plain HTML — AI assistants can read them directly without executing JavaScript.
- Every product page has a corresponding markdown (.md) file for AI consumption.
- Every storefront includes an llms.txt file with structured store information and full product catalog.
- Every storefront includes a products.md file with the complete catalog in markdown format.
- Schema.org product markup is auto-generated for every product.

### SEO (Auto-Generated)

Every storefront automatically includes:

- sitemap.xml with all pages and priorities
- Meta tags (title, description) on every page
- OpenGraph tags for social sharing
- Schema.org markup for structured data
- Proper heading hierarchy and semantic HTML
- robots.txt with sitemap and llms.txt references

### Storefront Checkout

- Built-in shopping cart and checkout flow on the storefront itself.
- Customers can browse products and complete purchases without portal registration.
- Payment processed through the company's configured gateway.
- Order confirmation overlay with full details after purchase.

### What Each Storefront Includes

- Homepage with company branding, hero section, and featured products
- All products page with full catalog grid
- Category pages filtered by product category
- Individual product pages with images, pricing, description, attributes, and add-to-cart
- Markdown versions of all pages for AI assistants
- llms.txt with complete store and product information
- sitemap.xml, robots.txt
- Shopping cart (persists in browser)
- Customer login, registration, and order history
- Mobile-responsive design

---

## Pillar 4: AI-Powered Operations (Premium, Coming Soon)

Planned premium features for the Enterprise tier.

- **AI-Driven Integration** — Connect ERP, CRM, and business systems without writing code.
- **AI-Driven Observability** — Deep insights into sales, customers, and operations without building dashboards.
- **AI-Driven Inter-Communication** — Automated order updates, quote follow-ups, and status notifications.

---

## How the Pillars Connect

- **Pillar 1 (Private Commerce)** is the foundation — company registration, products, cart, checkout, payments.
- **Pillar 2 (B2B)** adds the per-customer configuration layer — pricing, payment methods, delivery, quotes.
- **Pillar 3 (D2C Storefronts)** is triggered by Pillar 1 — product and profile updates regenerate the storefront.
- **Pillar 4 (AI)** will integrate across all pillars — observability, integration, automated communication.

---

## Pricing

No monthly fees. No setup costs. Pay only per order.

- **Starter** ($0/month): Portal access, storefront with custom domain, standard checkout, basic B2B configuration, Stripe + offline payments. **6% per order.**
- **Growth** ($0/month): Everything in Starter + negotiable quotes, multiple locations, all payment gateways, full B2B configuration. **5% + $1 per order.**
- **Enterprise** (Custom): Everything in Growth + AI-powered operations, dedicated support, SLA. **Volume pricing.**

---

## How to Get Started

1. Contact us at help@businesscart.ai with your company name and business email.
2. We verify your business and provide a business code.
3. Register your account with the business code.
4. Add your products — names, descriptions, prices, images, categories.
5. Connect your payment provider (Stripe, Amazon Pay, or Authorize.net).
6. Your storefront goes live automatically.

---

## Target Audiences

- **B2B:** Manufacturers, distributors, wholesalers who need per-customer pricing, payment terms, delivery configuration, and quote negotiation.
- **D2C:** Brands, restaurants, retail stores, grocery stores, and local businesses who want their own storefront without marketplace commissions.
- **Both:** Businesses that sell to other businesses AND directly to consumers from one platform.

---

## All Pages on This Website

### Main Pages
- **Homepage:** ${baseUrl}
- **Compare (vs Shopify, WooCommerce, Etsy, DoorDash, Amazon):** ${baseUrl}/compare
- **Industries:** ${baseUrl}/industries
- **About Us:** ${baseUrl}/about
- **Contact Us:** ${baseUrl}/contact-us
- **FAQ:** ${baseUrl}/faq
- **System Status:** ${baseUrl}/system-status
- **Careers:** ${baseUrl}/careers
- **Privacy Policy:** ${baseUrl}/privacy-policy
- **Terms of Service:** ${baseUrl}/terms-of-service

### Blog (${blogPosts.length} posts)
${blogPostEntries}

### Machine-Readable Resources
- **Sitemap:** ${baseUrl}/sitemap.xml
- **Robots:** ${baseUrl}/robots.txt
- **This File:** ${baseUrl}/llms.txt
`;

fs.writeFileSync(path.join(distDir, 'llms.txt'), llmsTxt);
console.log('Generated llms.txt');
