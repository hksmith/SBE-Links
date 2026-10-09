// Centered modal dialog that replaces the browser's prompt()/confirm() boxes.
//   const value = await openDialog({ title, text, body, confirm, onSubmit })
// Resolves with whatever onSubmit returns, or null when cancelled.
// onSubmit may throw an Error: its message is shown inside the dialog and it stays open.
import { IC } from '../icons.js';
import { esc } from '../utils.js';

export function openDialog({ icon = 'plus', title, text = '', body = '', confirm = 'OK', cancel = 'Cancel', danger = false, onOpen, onSubmit } = {}) {
  return new Promise(resolve => {
    const lastFocus = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'dlg-ov';
    ov.innerHTML = `<form class="dlg${danger ? ' danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-t" novalidate>
      <div class="dlg-hd"><span class="dlg-ic">${IC(icon, 20)}</span><div><h3 id="dlg-t">${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>
        <button type="button" class="dlg-x" data-dlg-cancel aria-label="Close">${IC('close', 14)}</button></div>
      ${body ? `<div class="dlg-bd">${body}<div class="dlg-err" role="alert"></div></div>` : '<div class="dlg-bd" style="padding-top:4px"><div class="dlg-err" role="alert"></div></div>'}
      <div class="dlg-ft"><button type="button" data-dlg-cancel>${esc(cancel)}</button><button type="submit" class="pri">${esc(confirm)}</button></div>
    </form>`;
    const form = ov.querySelector('form'), err = ov.querySelector('.dlg-err'), ok = ov.querySelector('[type=submit]');
    let busy = false;

    const close = value => {
      document.removeEventListener('keydown', onKey, true);
      ov.classList.add('closing');
      setTimeout(() => ov.remove(), 140);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      resolve(value);
    };
    const onKey = e => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(null); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...form.querySelectorAll('input,button,select,textarea')].filter(x => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };

    form.addEventListener('input', () => { err.textContent = ''; });
    ov.addEventListener('mousedown', e => { if (e.target === ov && !busy) close(null); });
    ov.addEventListener('click', e => { if (e.target.closest('[data-dlg-cancel]') && !busy) close(null); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      err.textContent = '';
      busy = true; ok.setAttribute('aria-busy', 'true');
      try {
        const v = onSubmit ? await onSubmit(form) : true;
        close(v === undefined ? true : v);
      } catch (x) {
        err.textContent = x && x.message ? x.message : 'Something went wrong';
      } finally {
        busy = false; ok.removeAttribute('aria-busy');
      }
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    if (onOpen) onOpen(form);
    (form.querySelector('input') || ok).focus();
  });
}

export const confirmDialog = ({ title, text, confirm = 'Delete', danger = true, icon = 'trash' }) =>
  openDialog({ title, text, confirm, danger, icon }).then(v => !!v);
