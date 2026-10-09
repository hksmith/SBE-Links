// Small non-blocking notifications at the bottom of the screen.
let box;
export function toast(text, { error = false, ms = 2600 } = {}) {
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' err' : '');
  t.textContent = text;
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
