import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api':         'http://localhost:3001',
      '/neural-map':  'http://localhost:3001',
      '/speak':       'http://localhost:3001',
      '/memory':      'http://localhost:3001',
      '/clients':     'http://localhost:3001',
      '/factory':     'http://localhost:3001',
    },
  },
});
