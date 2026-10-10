// Thin fetch wrapper for the backend. Paths are written as "/api/...". With no VITE_API_URL they stay same-origin and
// reach the Node server through the Vercel rewrites (or the Vite dev proxy); otherwise they go straight to VITE_API_URL.
import { API_URL } from './config.js';

const listeners = new Set();

// Called whenever the server answers 401, i.e. the session is missing or expired.
export const onSignedOut = fn => { listeners.add(fn); return () => listeners.delete(fn); };

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || (status ? `Request failed (${status})` : 'Network error'));
    this.status = status;
    this.body = body;
  }
}

export async function api(url, { method = 'GET', body, raw = false } = {}) {
  let r;
  try {
    r = await fetch(API_URL + url, {
      method,
      credentials: API_URL ? 'include' : 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { message: 'Could not reach the server.' });
  }
  if (r.status === 401 && url !== '/login') {
    listeners.forEach(fn => fn());
    throw new ApiError(401, { message: 'Your session has expired. Please sign in again.' });
  }
  if (raw) {
    if (!r.ok) throw new ApiError(r.status, null);
    return r;
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, data);
  return data;
}

// Uploads one image (as a data: URL) and returns its short "/media/<id>" URL.
export const uploadImage = async dataUrl => (await api('/api/media', { method: 'POST', body: { data: dataUrl } })).url;
