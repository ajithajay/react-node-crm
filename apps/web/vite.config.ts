import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)), // repo-root .env (VITE_* vars)
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      // Second HTML entry: the isolated Scalar playground iframe (no app Tailwind — see playground/main.tsx).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        playground: fileURLToPath(new URL('./playground.html', import.meta.url)),
      },
    },
  },
  server: {
    port: Number(process.env.WEB_PORT) || 3000,
    host: true, // allow subdomain hosts like app.lvh.me
    allowedHosts: ['.lvh.me'], // any <sub>.lvh.me / app.lvh.me dev host
  },
});
