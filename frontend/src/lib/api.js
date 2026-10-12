// Fetch wrapper for the admin API.
import { toast } from './toast.js';

// Two ways of hosting this app:
//  - by the Node server under /admin (base '/admin/'): the server shows the sign-in page or the app at /admin,
//    depending on the login cookie; the Vite dev server needs the real file names.
//  - on Vercel (base '/'): the app is at / and the sign-in page is a plain file, /login.html.
const BASE = import.meta.env.BASE_URL;
const ON_SERVER = BASE !== '/';
export const LOGIN_URL = !ON_SERVER ? '/login.html' : import.meta.env.DEV ? BASE + 'login.html' : '/admin';
export const APP_URL = !ON_SERVER ? '/' : import.meta.env.DEV ? BASE : '/admin';

export async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.href = LOGIN_URL; throw new Error('Signed out'); } // session expired
  if (r.status === 403) { // e.g. a viewer, or an admin who was just changed to viewer
    toast('You only have permission to view statistics.', { error: true });
    throw new Error('Not allowed');
  }
  return r;
}

export async function getJson(url) {
  const r = await api(url);
  if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).message || 'Request failed'), { status: r.status });
  return r.json();
}

// Sends JSON and returns the parsed reply; throws an Error with the server's message when it fails.
export async function send(url, method, body, fallback = 'Something went wrong. Please try again.') {
  const r = await api(url, method, body);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || fallback);
  return j;
}

// Uploads an image (data: URL) and returns its short "/media/<id>" URL.
export const uploadImage = async dataUrl => (await send('/api/media', 'POST', { data: dataUrl }, 'Upload failed')).url;
