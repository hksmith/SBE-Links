// Copies text; resolves to false when the browser refuses (e.g. insecure context).
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
