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
  { route: '/', component: <LandingPage />, output: 'index.html' },
  { route: '/compare', component: <Compare />, output: 'compare/index.html' },
  { route: '/industries', component: <Industries />, output: 'industries/index.html' },
  {
    route: '/blog',
    component: <Blog />,
    output: 'blog/index.html',
    title: 'Blog — BusinessCart.ai',
    description: 'Insights on e-commerce, AI, and growing your business online.',
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
`;

fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
console.log('Generated robots.txt');
