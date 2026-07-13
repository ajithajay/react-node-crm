import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)), // repo-root .env (VITE_* vars)
  // react-grid-layout bundles react-draggable, which reads `process.env.NODE_ENV` in a debug-log
  // path; Vite doesn't define a `process` global in the browser, so that reference threw a
  // ReferenceError on every drag/resize mousedown (crashing DraggableCore.handleDragStart before it
  // ever started tracking the drag — the actual cause of "resize doesn't extend"). This replaces the
  // literal text at build time so no runtime `process` lookup happens in the browser bundle.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
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
