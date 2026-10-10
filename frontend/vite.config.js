import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite server forwards the backend routes to the Node server, which is exactly
// what the rewrites in vercel.json do in production. The browser only ever talks to one origin,
// so the backend's SameSite=Strict login cookie just works.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_BACKEND_URL || 'http://localhost:3000';
  const proxy = Object.fromEntries(
    ['/api', '/login', '/logout', '/media'].map(p => [p, { target, changeOrigin: true }]),
  );
  return { plugins: [react()], server: { port: 5173, proxy }, preview: { port: 4173, proxy } };
});
