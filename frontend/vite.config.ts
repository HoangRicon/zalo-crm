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

// vite-plugin-pwa tạm thời disabled — xem comment bên dưới (PWA assets có sẵn trong public/).
import type { Plugin } from 'vite';

const noopPlugin: Plugin = {
  name: 'pwa-disabled',
  // Phase 2 sẽ re-enable khi vite-plugin-pwa fix conflict với rolldown 1.x.
};

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    noopPlugin,
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