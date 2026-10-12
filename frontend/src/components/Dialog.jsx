// Centered modal dialog that replaces the browser's prompt()/confirm() boxes.
//
//   <Dialog title="…" confirm="Save" onSubmit={async () => result} onClose={result => …}>fields</Dialog>
//
// onSubmit may throw an Error: its message is shown inside the dialog and it stays open.
// onClose receives onSubmit's result, or null when cancelled (Esc, ✕, Cancel, click outside).
//
// showDialog(close => <SomeDialog onClose={close} />) opens a dialog from anywhere and resolves with its result;
// confirmDialog({ title, text, confirm }) resolves true/false.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

export function Dialog({ icon = 'plus', title, text = '', confirm = 'OK', cancel = 'Cancel', danger = false, onSubmit, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null), busyRef = useRef(false), doneRef = useRef(false);
  const lastFocus = useRef(document.activeElement);

  const close = useCallback(value => {
    if (doneRef.current) return;
    doneRef.current = true;
    setClosing(true);
    lastFocus.current?.focus?.();
    setTimeout(() => onClose(value), 140);
  }, [onClose]);

  useEffect(() => {
    const f = formRef.current;
    (f.querySelector('input:not([disabled])') || f.querySelector('[type=submit]')).focus();
    const onKey = e => {
      if (e.key === 'Escape' && !busyRef.current) { e.stopPropagation(); close(null); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const els = [...f.querySelectorAll('input,button,select,textarea')].filter(x => !x.disabled);
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [close]);

  const submit = async e => {
    e.preventDefault();
    if (busyRef.current) return;
    setErr('');
    busyRef.current = true; setBusy(true);
    try {
      const v = onSubmit ? await onSubmit() : true;
      close(v === undefined ? true : v);
    } catch (x) {
      setErr(x && x.message ? x.message : 'Something went wrong');
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  return (
    <div className={'dlg-ov' + (closing ? ' closing' : '')} onMouseDown={e => { if (e.target === e.currentTarget && !busyRef.current) close(null); }}>
      <form ref={formRef} className={'dlg' + (danger ? ' danger' : '')} role="dialog" aria-modal="true" aria-labelledby="dlg-t" noValidate onSubmit={submit} onInput={() => setErr('')}>
        <div className="dlg-hd">
          <span className="dlg-ic"><Icon k={icon} size={20} /></span>
          <div><h3 id="dlg-t">{title}</h3>{text && <p>{text}</p>}</div>
          <button type="button" className="dlg-x" aria-label="Close" onClick={() => !busy && close(null)}><Icon k="close" size={14} /></button>
        </div>
        <div className="dlg-bd" style={children ? undefined : { paddingTop: 4 }}>
          {children}
          <div className="dlg-err" role="alert">{err}</div>
        </div>
        <div className="dlg-ft">
          <button type="button" onClick={() => !busy && close(null)}>{cancel}</button>
          <button type="submit" className="pri" aria-busy={busy || undefined}>{confirm}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- open dialogs from anywhere (rendered by <DialogHost/>) ---------- */
const listeners = new Set();
let open = [], seq = 0;
const emit = () => listeners.forEach(fn => fn(open));

export function showDialog(render) {
  return new Promise(resolve => {
    const d = { id: ++seq };
    d.el = render(value => { open = open.filter(x => x !== d); emit(); resolve(value); });
    open = [...open, d];
    emit();
  });
}

export const confirmDialog = ({ title, text, confirm = 'Delete', danger = true, icon = 'trash' }) =>
  showDialog(close => <Dialog title={title} text={text} confirm={confirm} danger={danger} icon={icon} onClose={close} />).then(v => !!v);

export function DialogHost() {
  const [list, setList] = useState(open);
  useEffect(() => { listeners.add(setList); return () => listeners.delete(setList); }, []);
  return list.map(d => <div key={d.id} style={{ display: 'contents' }}>{d.el}</div>);
}
