// Stub browser globals so Navbar renders as logged-out state for crawlers
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
globalThis.localStorage = noopStorage as Storage;
globalThis.sessionStorage = noopStorage as Storage;

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import React from 'react';
import LandingPage from './pages/LandingPage';
import fs from 'fs';
import path from 'path';

const html = renderToString(
  <StaticRouter location="/">
    <LandingPage />
  </StaticRouter>
);

const distPath = path.resolve(process.cwd(), 'dist/index.html');
const indexHtml = fs.readFileSync(distPath, 'utf-8');

const prerendered = indexHtml.replace(
  '<div id="root"></div>',
  `<div id="root">${html}</div>`
);

fs.writeFileSync(distPath, prerendered);
console.log('Pre-rendered landing page into dist/index.html');
