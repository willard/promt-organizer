import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict CSP for the packaged app only; the dev server needs inline scripts for React Fast Refresh.
const csp: Plugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'",
      },
      injectTo: 'head-prepend',
    },
  ],
};

export default defineConfig({
  plugins: [react(), csp],
  // Relative asset paths so the built index.html loads via file:// in Electron.
  base: './',
  // Prefer 5173 but fall back to the next free port if something else is using it.
  server: { port: 5173, strictPort: false },
});
