// Vite config for the admin app.
//   npm run build  -> client/dist (served by the Node server at /admin)
//   npm run dev    -> http://localhost:5173/admin/ with hot reload; API calls are proxied to the server on :3000
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const SERVER = process.env.API_URL || 'http://localhost:3000';
const proxied = ['/api', '/login', '/logout', '/media', '/n/', '/go/', '/vcf/'];

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(here, 'index.html'),
        login: resolve(here, 'login.html'),
      },
    },
  },
  server: {
    proxy: Object.fromEntries(proxied.map(p => [p, { target: SERVER, changeOrigin: false }])),
  },
});
