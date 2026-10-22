// "QR codes" screen (admins only, internal tool): every QR code with its scan totals, and the
// dialog to make a new one or change what an existing one opens (a link, an uploaded file, or a text).
// The printed code always holds <site>/q/<code>, so what it opens can be changed later without reprinting.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJson, send, LOGIN_URL } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { ago, pickFiles } from '../lib/utils.js';
import { qrSvg, qrUrl, downloadPng } from '../lib/qrdraw.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { Dialog, showDialog } from '../components/Dialog.jsx';
import { TopBar, Footer } from '../components/TopBar.jsx';

export const TYPE = { link: 'Link', file: 'File', text: 'Text' };
export const TYPE_ICON = { link: 'link', file: 'file', text: 'text' };
export const MAX_MB = 10;

export const fmtSize = b => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
export const destination = q => (q.type === 'link' ? q.url : q.type === 'file' ? (q.file ? `${q.file.name} · ${fmtSize(q.file.size)}` : 'No file') : q.text);

export function QrThumb({ q, size = 58 }) {
  const svg = useMemo(() => qrSvg(qrUrl(q.code), q.style || {}, { margin: 2 }), [q.code, q.style]);
  return <span className="qr-th" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function QrCodes() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');

  const load = useCallback(async () => setList(await getJson('/api/qr')), []);
  useEffect(() => { load().catch(() => setList([])); }, [load]);

  const add = async () => {
    const made = await showDialog(close => <QrDialog onClose={close} />);
    if (made) { toast('QR code created'); navigate('/qr/' + made.id); }
  };

  const f = q.toLowerCase();
  const shown = (list || []).filter(x => (type === 'all' || x.type === type) && (x.name + x.code + x.note + destination(x)).toLowerCase().includes(f));
  const T = (list || []).reduce((a, x) => ({ s: a.s + x.scans, u: a.u + x.unique, on: a.on + (x.active ? 1 : 0) }), { s: 0, u: 0, on: 0 });

  return <>
    <TopBar />
    <main>
      <div className="hero">
        <button onClick={() => navigate('/')}><Icon k="back" size={14} /> Accounts</button>
        <h1 style={{ marginTop: 12 }}>QR codes</h1>
        <p>Make a QR code for a link, a file (PDF, photo, video, any document) or a short text, name it, and see every scan. What a code opens can be changed later without reprinting it.</p>
      </div>
      <div className="stats">
        <div className="st"><small>QR codes</small><div>{list ? list.length : '–'}</div></div>
        <div className="st"><small>Total scans</small><div>{list ? T.s : '–'}</div></div>
        <div className="st"><small>Unique scanners</small><div>{list ? T.u : '–'}</div></div>
        <div className="st"><small>Active</small><div>{list ? T.on : '–'}</div></div>
      </div>
      <div className="usr-actions">
        <button className="blk" onClick={add} disabled={!list}><Icon k="qr" size={16} /> New QR code</button>
      </div>
      <div className="qr-filter">
        <input placeholder="Search QR codes…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="seg">
          {[['all', 'All'], ['link', 'Links'], ['file', 'Files'], ['text', 'Text']].map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}
        </div>
      </div>
      <div>
        {shown.map(x => (
          <div key={x.id} className={'acc qr-row' + (x.active ? '' : ' off')} onClick={() => navigate('/qr/' + x.id)}>
            <QrThumb q={x} />
            <div className="ai">
              <b>{x.name} {!x.active && <span className="tag warn">Paused</span>}</b>
              <small className="qr-dest"><Icon k={TYPE_ICON[x.type]} size={12} /> {destination(x)}</small><br />
              <small>/q/{x.code} · last scan {ago(x.last)}</small>
            </div>
            <div className="nums">
              <div><b>{x.scans}</b><small>Scans</small></div>
              <div><b>{x.unique}</b><small>Unique</small></div>
            </div>
            <CopyButton text={qrUrl(x.code)}>Copy link</CopyButton>
            <button title="Download PNG" onClick={e => { e.stopPropagation(); downloadPng(qrUrl(x.code), x.style || {}, x.name).catch(() => toast('Could not make the image', { error: true })); }}><Icon k="download" size={15} /> PNG</button>
          </div>
        ))}
        {list && !shown.length && <p style={{ color: 'var(--mut)' }}>{list.length ? 'No QR codes match.' : 'No QR codes yet. Click “New QR code”.'}</p>}
      </div>
    </main>
    <Footer />
  </>;
}

/* ---------- uploading the file a QR code opens ---------- */

export function uploadQrFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_MB * 1048576) return reject(new Error(`The file is too large. The limit is ${MAX_MB} MB.`));
    const x = new XMLHttpRequest();
    x.open('POST', '/api/qr/files');
    x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    x.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => {
      if (x.status === 401) { location.href = LOGIN_URL; return reject(new Error('Signed out')); }
      let j = {};
      try { j = JSON.parse(x.responseText); } catch { /* not JSON */ }
      if (x.status === 413) return reject(new Error(j.message || `The file is too large. The limit is ${MAX_MB} MB.`));
      if (x.status >= 300) return reject(new Error(j.message || 'Upload failed. Please try again.'));
      resolve(j);
    };
    x.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    x.send(file);
  });
}

/* ---------- new QR code / change what it opens ---------- */

export function QrDialog({ qr, onClose }) {
  const [name, setName] = useState(qr ? qr.name : '');
  const [type, setType] = useState(qr ? qr.type : 'link');
  const [url, setUrl] = useState(qr ? qr.url : '');
  const [text, setText] = useState(qr ? qr.text : '');
  const [file, setFile] = useState(qr ? qr.file : null);
  const [note, setNote] = useState(qr ? qr.note : '');
  const [code, setCode] = useState('');
  const [more, setMore] = useState(false);
  const [up, setUp] = useState(null); // upload progress 0..1, null when idle
  const [upErr, setUpErr] = useState('');
  const nameRef = useRef(null);

  const choose = async () => {
    const [f] = await pickFiles();
    if (!f) return;
    setUpErr(''); setUp(0);
    try {
      const r = await uploadQrFile(f, setUp);
      setFile(r);
      if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setUpErr(e.message); }
    setUp(null);
  };

  const submit = async () => {
    if (up !== null) throw new Error('Please wait for the upload to finish.');
    if (!name.trim()) { nameRef.current.focus(); throw new Error('Please give the QR code a name.'); }
    const body = { name: name.trim(), type, url, text, note, file: file ? { id: file.id } : null };
    if (!qr && code.trim()) body.code = code.trim();
    return send(qr ? '/api/qr/' + qr.id : '/api/qr', qr ? 'PUT' : 'POST', body, 'Could not save. Please try again.');
  };

  return (
    <Dialog icon="qr" title={qr ? 'Edit QR code' : 'New QR code'}
      text={qr ? 'The printed code stays the same: it simply opens the new content.' : 'Choose what it opens. You can change that later without reprinting.'}
      confirm={qr ? 'Save changes' : 'Create QR code'} onSubmit={submit} onClose={onClose}>
      <div className="fld"><label htmlFor="qr-name">Name</label>
        <input id="qr-name" ref={nameRef} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office flyer – October" autoComplete="off" /></div>
      <div className="fld"><label>It opens</label>
        <div className="seg qr-seg">
          {Object.entries(TYPE).map(([k, l]) => <button type="button" key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}><Icon k={TYPE_ICON[k]} size={14} /> {l}</button>)}
        </div>
      </div>
      {type === 'link' && <div className="fld"><label htmlFor="qr-url">Link</label>
        <input id="qr-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… (website, form, Google Drive, WhatsApp, map…)" autoComplete="off" spellCheck={false} /></div>}
      {type === 'file' && <div className="fld"><label>File</label>
        <div className="upl">
          {up !== null
            ? <div className="upl-p"><span>Uploading… {Math.round(up * 100)}%</span><div className="bar"><i style={{ width: `${up * 100}%` }} /></div></div>
            : file
              ? <><Icon k="file" size={20} /><div className="vn"><b>{file.name}</b><small>{fmtSize(file.size)} · {file.type}</small></div><button type="button" onClick={choose}>Replace</button></>
              : <button type="button" className="upl-btn" onClick={choose}><Icon k="upload" size={16} /> Choose a file</button>}
        </div>
        <small className="dlg-hint">PDF, photo, video, Word, Excel, PowerPoint, zip… up to {MAX_MB} MB. PDFs, photos and videos open on the phone; other files download.</small>
        {upErr && <small className="dlg-hint" style={{ color: '#dc2626' }}>{upErr}</small>}
      </div>}
      {type === 'text' && <div className="fld"><label htmlFor="qr-text">Text</label>
        <textarea id="qr-text" maxLength={5000} rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Shown on a simple page when scanned (links in it are clickable)." /></div>}
      {!more && <button type="button" className="qr-more" onClick={() => setMore(true)}>{qr ? '+ Note' : '+ Note and short code'}</button>}
      {more && <>
        <div className="fld"><label htmlFor="qr-note">Note <small style={{ color: 'var(--mut)', fontWeight: 400 }}>(only you see it)</small></label>
          <input id="qr-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. printed on 500 flyers for the expo" autoComplete="off" /></div>
        {!qr && <div className="fld"><label htmlFor="qr-code">Short code</label>
          <div className="dlg-url"><span>{location.host}/q/</span><input id="qr-code" maxLength={32} value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="made automatically" autoComplete="off" spellCheck={false} /></div>
          <small className="dlg-hint">Optional. Shorter codes make simpler, easier-to-scan QR codes.</small></div>}
      </>}
      {qr && note && !more && <small className="dlg-hint">Note: {note}</small>}
    </Dialog>
  );
}

export const editQr = qr => showDialog(close => <QrDialog qr={qr} onClose={close} />);
