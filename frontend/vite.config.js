import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite server forwards the backend routes to the Node server, which is exactly
// what the rewrites in vercel.json do in production. The browser only ever talks to one origin,
// so the backend's SameSite=Strict login cookie just works.
// The server address is written once, in the rewrites of vercel.json. Read it here so the app can use it for
// NFC links, "Open page" and the preview (the placeholder address counts as "not set").
function serverOriginFromVercelJson() {
  try {
    const rule = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).rewrites.find(r => r.source.startsWith('/api/'));
    const origin = new URL(rule.destination).origin;
    return origin === 'https://api.example.com' ? '' : origin;
  } catch { return ''; }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_BACKEND_URL || 'http://localhost:3000';
  const proxy = Object.fromEntries(
    ['/api', '/login', '/logout', '/media'].map(p => [p, { target, changeOrigin: true }]),
  );
  return { define: { __SERVER_ORIGIN__: JSON.stringify(serverOriginFromVercelJson()) }, plugins: [react()], server: { port: 5173, proxy }, preview: { port: 4173, proxy } };
});
