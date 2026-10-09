// Fetch wrapper for the admin API. A 401 means the session expired: reload to show the login page.
export async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.reload(); throw new Error('Signed out'); }
  return r;
}

export const getJson = async url => (await api(url)).json();

// Uploads an image (data: URL) and returns its short "/media/<id>" URL.
export async function uploadImage(dataUrl) {
  const r = await api('/api/media', 'POST', { data: dataUrl });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || 'Upload failed');
  return j.url;
}
