// Centered modal (replaces prompt()/confirm()) plus a promise-based confirm() hook.
//   <Dialog title text confirm onSubmit={async () => ...} onCancel>…fields…</Dialog>
// onSubmit may throw an Error: its message is shown inside the dialog and the dialog stays open.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';

export function Dialog({ icon = 'plus', title, text, danger, confirm = 'OK', cancel = 'Cancel', onSubmit, onCancel, children }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef(null);
  const busyRef = useRef(false);
  const cancelRef = useRef(onCancel);
  busyRef.current = busy;
  cancelRef.current = onCancel; // always call the latest handler without re-running the focus effect

  useEffect(() => {
    const last = document.activeElement;
    (form.current.querySelector('input') || form.current.querySelector('[type=submit]')).focus();
    const onKey = e => {
      if (e.key === 'Escape' && !busyRef.current) { e.stopPropagation(); cancelRef.current(); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...form.current.querySelectorAll('input,button,select,textarea')].filter(x => !x.disabled);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); last && last.focus && last.focus(); };
  }, []);

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try { await onSubmit(); } catch (x) { setErr(x && x.message ? x.message : 'Something went wrong'); setBusy(false); }
  };

  return (
    <div className="dlg-ov" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <form ref={form} className={'dlg' + (danger ? ' danger' : '')} role="dialog" aria-modal="true" aria-labelledby="dlg-t" noValidate onSubmit={submit} onChange={() => setErr('')}>
        <div className="dlg-hd">
          <span className="dlg-ic"><Icon name={icon} size={20} /></span>
          <div><h3 id="dlg-t">{title}</h3>{text && <p>{text}</p>}</div>
          <button type="button" className="dlg-x" aria-label="Close" disabled={busy} onClick={onCancel}><Icon name="close" size={14} /></button>
        </div>
        <div className="dlg-bd" style={children ? undefined : { paddingTop: 4 }}>
          {children}
          <div className="dlg-err" role="alert">{err}</div>
        </div>
        <div className="dlg-ft">
          <button type="button" disabled={busy} onClick={onCancel}>{cancel}</button>
          <button type="submit" className="pri" aria-busy={busy || undefined}>{confirm}</button>
        </div>
      </form>
    </div>
  );
}

const ConfirmContext = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null);
  const confirm = useCallback(opts => new Promise(resolve => setAsk({ opts, resolve })), []);
  const done = v => { ask.resolve(v); setAsk(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && <Dialog danger icon="trash" confirm="Delete" {...ask.opts} onSubmit={() => done(true)} onCancel={() => done(false)} />}
    </ConfirmContext.Provider>
  );
}
