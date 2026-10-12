// Small non-blocking notifications. Call toast() from anywhere; <Toasts/> renders them.
const listeners = new Set();
let items = [], seq = 0;
const emit = () => listeners.forEach(fn => fn(items));

export function toast(text, { error = false, ms = 2600 } = {}) {
  const t = { id: ++seq, text, error };
  items = [...items, t];
  emit();
  setTimeout(() => { items = items.filter(x => x !== t); emit(); }, ms);
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  fn(items);
  return () => listeners.delete(fn);
}
