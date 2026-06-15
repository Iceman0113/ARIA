import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ARIA — Voice AI Cofounder',
        short_name: 'ARIA',
        description: 'Your voice-first AI cofounder',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/api':         'http://localhost:3001',
      '/neural-map':  'http://localhost:3001',
      '/speak':       'http://localhost:3001',
      '/memory':      'http://localhost:3001',
      '/clients':     'http://localhost:3001',
      '/factory':     'http://localhost:3001',
      '/agents':      'http://localhost:3001',
    },
  },
});
