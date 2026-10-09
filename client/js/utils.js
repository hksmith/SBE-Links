// Small DOM / formatting helpers shared by the admin views.
import { toast } from './components/toast.js';

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const O = location.origin;
export const rid = () => Math.random().toString(36).slice(2, 10);

export const ago = t => {
  if (!t) return 'never';
  const m = (Date.now() - t) / 6e4;
  return m < 1 ? 'just now' : m < 60 ? Math.round(m) + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
};

// Sets a value on a nested object using a dotted path ("blocks.0.items.2.title").
export const setp = (o, p, v) => { const k = p.split('.'), l = k.pop(); k.reduce((x, y) => x[y], o)[l] = v; };
export const getp = (o, p) => p.split('.').reduce((x, y) => x[y], o);

export const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { const o = btn.innerHTML; btn.textContent = 'Copied ✓'; setTimeout(() => (btn.innerHTML = o), 1400); }
    else toast('Copied to clipboard');
  } catch {
    toast('Could not copy automatically — ' + text, { error: true, ms: 5000 });
  }
}

// Reads an image file, downsizes it to `max` px on its longest side and returns a data: URL.
export const toData = (file, max, type) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onerror = rej;
  r.onload = () => {
    const im = new Image();
    im.onerror = rej;
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k;
      const x = c.getContext('2d');
      if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL(type, 0.85));
    };
    im.src = r.result;
  };
  r.readAsDataURL(file);
});

export const imageSize = src => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.onerror = () => r([1, 1]); i.src = src; });
