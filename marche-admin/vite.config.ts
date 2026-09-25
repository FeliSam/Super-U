import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Build servi par l'API sur https://api.moxtapp.ru/panel/ (même origine, voir server/src/panel.ts).
// En dev (vite, port 8083) le panel reste à la racine avec le proxy vers l'API locale.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/panel/' : '/',
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
}));
