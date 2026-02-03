import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        name: 'SkitourScout',
        short_name: 'SkitourScout',
        description: 'Check ski touring conditions in Polish mountains - Tatry & Beskidy',
        theme_color: '#1e3a5f',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Open-Meteo API responses
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 30, // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache proxy API responses
            urlPattern: /^\/api\/proxy\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'proxy-api-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Proxy for TOPR avalanche data (bypasses CORS)
      '/api/proxy/topr': {
        target: 'https://lawiny.topr.pl',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/topr/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SkitourScout/1.0)',
        },
      },
      // Proxy for DuckDuckGo search (bypasses CORS)
      '/api/proxy/ddg': {
        target: 'https://html.duckduckgo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/ddg/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SkitourScout/1.0)',
        },
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
