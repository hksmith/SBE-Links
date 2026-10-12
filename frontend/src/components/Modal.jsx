import { useEffect } from 'react';
import { Icon } from './Icon.jsx';

// Large overlay panel used by the icon picker and "Add a block".
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2 style={{ flex: 1, margin: 0, fontSize: 18, textTransform: 'none', color: 'var(--ink)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><Icon k="close" size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
