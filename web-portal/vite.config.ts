import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      workbox: {
        // Only precache hashed assets (JS/CSS) — NOT HTML (HTML must be network-first)
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        // Disable NavigationRoute — pre-rendered pages must be fetched fresh, not served from SW cache
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML pages — network-first (fresh on every visit, cached as offline fallback)
            urlPattern: /\/(index\.html)?$|\/compare|\/industries|\/solutions|\/blog|\/faq|\/about|\/careers|\/contact|\/privacy|\/terms/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            // API calls — never cache
            urlPattern: /\/accounts\/|\/products\/|\/checkout\/|\/codes\/|\/customers\/|\/visitors\//,
            handler: 'NetworkOnly',
          },
          {
            // Product images from CDN
            urlPattern: /cloudfront\.net/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'BusinessCart',
        short_name: 'BusinessCart',
        description: 'Your Commerce, Your Rules.',
        theme_color: '#0d9488',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Bundle all heroicons into a single shared chunk so they load as one
          // request (was previously 12+ tiny chunks per page).
          if (id.includes('@heroicons')) return 'heroicons';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
