// Small formatting / data helpers shared by the admin views.
import { toast } from './toast.js';

export const O = location.origin;
export const rid = () => Math.random().toString(36).slice(2, 10);
export const cls = (...a) => a.filter(Boolean).join(' ');

export const ago = t => {
  if (!t) return 'never';
  const m = (Date.now() - t) / 6e4;
  return m < 1 ? 'just now' : m < 60 ? Math.round(m) + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
};

// Read / write a nested value with a dotted path ("blocks.0.items.2.title"). setp creates missing objects.
export const getp = (o, p) => p.split('.').reduce((x, y) => (x == null ? x : x[y]), o);
export const setp = (o, p, v) => {
  const k = p.split('.'), l = k.pop();
  let x = o;
  for (const y of k) { if (x[y] == null) x[y] = {}; x = x[y]; }
  x[l] = v;
};

export const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Copies text; resolves true on success. On failure shows the text in a toast so it can be copied by hand.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast('Could not copy automatically — ' + text, { error: true, ms: 5000 });
    return false;
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

// Opens the browser's file chooser. Resolves with the chosen files ([] when cancelled).
// Must be called directly from a click handler (before any await) or browsers block it.
export function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise(resolve => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = multiple; i.hidden = true;
    const done = files => { i.remove(); resolve(files); };
    i.addEventListener('change', () => done([...i.files]));
    i.addEventListener('cancel', () => done([]));
    document.body.appendChild(i);
    i.click();
  });
}
