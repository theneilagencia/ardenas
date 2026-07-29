import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Demo data lives in IndexedDB; the shell must survive offline.
        navigateFallback: '/index.html',
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Arden.AS',
        short_name: 'Arden.AS',
        description: 'Plataforma de operações Arden.AS',
        lang: 'pt-BR',
        theme_color: '#111111',
        background_color: '#F7F7F5',
        display: 'standalone',
        icons: [
          { src: 'favicon.png', sizes: '64x64', type: 'image/png' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
