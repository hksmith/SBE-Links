import { useEffect, useRef, useState } from 'react';

// Small drop-down menu (the "•••" menus and the user menu). Closes on outside click or after picking an item.
export function Menu({ summary, className = '', label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <details ref={ref} className={('mn ' + className).trim()} open={open}>
      <summary aria-label={label} onClick={e => { e.preventDefault(); setOpen(o => !o); }}>{summary}</summary>
      <div onClick={() => setOpen(false)}>{children}</div>
    </details>
  );
}
