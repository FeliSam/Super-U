import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 8083,
    host: true,
    proxy: {
      '/ops': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/catalog': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/stores': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
});
