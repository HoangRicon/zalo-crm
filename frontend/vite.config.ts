import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Open-core: `@ee` resolves to the extension bundle when present (private repo)
// and falls back to no-op stubs in the Community edition (where src/_ee is
// stripped). Same config in both editions — auto-detected, no env flag needed.
const eeDir = existsSync(fileURLToPath(new URL('./src/_ee', import.meta.url)))
  ? './src/_ee'
  : './src/_ee-stubs';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // Sprint 7 R12 2026-07-21: PWA plugin (manifest + service worker + offline cache).
    // registerType: 'autoUpdate' → user gets new SW mà không cần reload tab (nếu tab đã mở
    // trước đó thì auto-update lần tiếp theo). Phase 2: thêm injectManifest cho custom SW.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg', 'icons/maskable-512.svg'],
      manifest: {
        name: 'ZCRM — Zalo Sales CRM',
        short_name: 'ZCRM',
        description: 'Quản lý khách hàng, broadcast, tự động hoá Zalo',
        theme_color: '#1f6feb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          // Phase 1: trỏ SVG (chấp nhận trên Android/Chrome). Phase 2: convert → PNG với sharp
          // để đạt Lighthouse PWA audit ≥ 90. SVG không đạt yêu cầu Lighthouse strict.
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching cho API quan trọng: chat list (last-known), avatar (cache-first).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/conversations/sidebar'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-conversations',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 }, // 1 ngày
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/avatars/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-avatars',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 ngày
            },
          },
        ],
        // Navigation fallback: khi offline, service worker serves precached shell.
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: true, // dev mode cũng test được SW
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ee': fileURLToPath(new URL(eeDir, import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});