// Two ways to reach the server (see README):
//  1. Proxy mode (default, VITE_API_URL empty): the browser calls this site's own /api, /login, /logout, /media
//     and the Vercel rewrites in vercel.json forward them to the server. Same origin, so the cookie is first-party.
//  2. Direct mode (VITE_API_URL=https://your-api.onrender.com): the browser calls the server itself. The server
//     must list this site in CLIENT_ORIGIN and use COOKIE_SAMESITE=none.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Where the public pages (/n/<slug>, /<slug>) live. They are served by the Node server, not by this app,
// so NFC links, "Open page" and the preview base URL must use the server's own address.
const fallback = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
// Order: VITE_PUBLIC_URL (optional override) → VITE_API_URL → the server address in vercel.json → dev/localhost.
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || API_URL || __SERVER_ORIGIN__ || fallback).replace(/\/+$/, '');
export const PUBLIC_HOST = PUBLIC_URL.replace(/^https?:\/\//, '');
export const nfcUrl = slug => `${PUBLIC_URL}/n/${slug}`;
export const pageUrl = slug => `${PUBLIC_URL}/${slug}`;

// Uploaded images are stored as "/media/<id>". In direct mode they must be loaded from the server.
export const asset = url => (API_URL && typeof url === 'string' && url.startsWith('/media/') ? API_URL + url : url);
