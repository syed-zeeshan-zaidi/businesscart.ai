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
import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

const pages: { route: string; component: React.ReactElement; output: string }[] = [
  { route: '/', component: <LandingPage />, output: 'index.html' },
  { route: '/compare', component: <Compare />, output: 'compare/index.html' },
  { route: '/industries', component: <Industries />, output: 'industries/index.html' },
];

for (const page of pages) {
  const html = renderToString(
    <StaticRouter location={page.route}>
      {page.component}
    </StaticRouter>
  );

  const rendered = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`
  );

  const outputPath = path.join(distDir, page.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Pre-rendered ${page.route} → dist/${page.output}`);
}
