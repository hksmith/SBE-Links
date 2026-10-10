// "Link in Bio" tab: profile header + the list of blocks (links, social chips, text, images, ...).
import { useRef, useState } from 'react';
import { Icon, Tile, guessIcon, useIcons } from '../../icons.jsx';
import { useConfirm } from '../../components/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import { asset, nfcUrl } from '../../config.js';
import { copyText } from '../../clipboard.js';
import { CAT, FONTS, ICON, NAME, NEWB, Q, QS } from '../../constants.js';
import { rid } from '../../utils.js';
import { Field, Menu, Overlay, Slider } from './controls.jsx';

/* ---------- pickers ---------- */
function IconPicker({ i, j, ed, onClose }) {
  const icons = useIcons();
  const [f, setF] = useState('');
  const q = f.toLowerCase();
  const L = Object.entries(icons).filter(([k, v]) => v[3] !== 'u' && (k + ' ' + v[0]).toLowerCase().includes(q));
  const pick = k => { ed.update(a => { const t = a.blocks[i].items[j]; t.ico = k; t.img = ''; t.icon = ''; }); onClose(); };
  const group = g => {
    const rows = L.filter(([, v]) => v[3] === g);
    return rows.length
      ? <div className="ibs">{rows.map(([k, v]) => <button key={k} className="ib" title={v[0]} onClick={() => pick(k)}><Icon name={k} size={28} /><span>{v[0]}</span></button>)}</div>
      : <small>No match</small>;
  };
  return (
    <Overlay title="Choose an icon" onClose={onClose}>
      <input autoFocus placeholder="Search icons…" aria-label="Search icons" value={f} onChange={e => setF(e.target.value)} style={{ margin: '12px 0 8px' }} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => { onClose(); ed.pickFile(`ico:${i}:${j}`); }}><Icon name="upload" size={14} /> Upload your own</button>
        <button onClick={() => pick('')}>No icon</button>
      </div>
      <h2>Social &amp; apps</h2>{group('s')}
      <h2>General</h2>{group('g')}
    </Overlay>
  );
}

function AddBlock({ ed, onClose }) {
  const [f, setF] = useState('');
  const add = type => {
    const b = { id: rid(), type, off: false, ...NEWB[type]() };
    ed.update(a => { a.blocks.push(b); });
    ed.setOpen(b.id);
    onClose();
  };
  return (
    <Overlay title="Add a block" onClose={onClose}>
      <input autoFocus placeholder="Search blocks…" aria-label="Search blocks" value={f} onChange={e => setF(e.target.value)} style={{ margin: '12px 0' }} />
      <div className="tiles">
        {CAT.filter(c => (NAME[c[0]] + c[1]).toLowerCase().includes(f.toLowerCase())).map(c => (
          <button key={c[0]} className="tile" onClick={() => add(c[0])}>
            <span className="chip"><Icon name={ICON[c[0]]} size={20} /></span>
            <b>{NAME[c[0]].split(' –')[0]}</b><small>{c[1]}</small>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

/* ---------- drag & drop helper (blocks and links inside a block) ---------- */
function useReorder() {
  const drag = useRef(null);
  const [ready, setReady] = useState(null); // key of the handle being pressed, makes its card draggable
  const [over, setOver] = useState(null);
  const end = () => { drag.current = null; setReady(null); setOver(null); };
  // props for a draggable card: key identifies the card, group+index say what is being moved
  const card = (key, group, index, onMove) => ({
    draggable: ready === key,
    onDragStart: e => {
      if (e.target !== e.currentTarget) return;
      e.stopPropagation();
      drag.current = { group, index };
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'x'); } catch { /* some browsers refuse */ }
    },
    onDragOver: e => { if (drag.current && drag.current.group === group) { e.preventDefault(); e.stopPropagation(); setOver(key); } },
    onDrop: e => {
      const d = drag.current;
      if (d && d.group === group) { e.preventDefault(); e.stopPropagation(); if (d.index !== index) onMove(d.index, index); }
      end();
    },
    onDragEnd: end,
  });
  const handle = key => ({ onPointerDown: () => setReady(key), onPointerUp: () => setReady(null) });
  return { card, handle, over };
}

/* ---------- link / social items ---------- */
function Items({ ed, b, i, isL, openPicker }) {
  const { account, stats, update } = ed;
  const icons = useIcons();
  const dnd = useReorder();
  const clicks = id => (stats && stats.byLink && stats.byLink[id]) || 0;
  const items = path => update(a => path(a.blocks[i].items));

  const autoIcon = j => {
    const it = account.blocks[i].items[j];
    if (it.img || (it.ico && it.ico !== 'link' && it.ico !== 'globe')) return;
    const g = guessIcon(it.url, icons);
    if (g && g !== it.ico) update(a => { const t = a.blocks[i].items[j]; t.ico = g; t.icon = ''; });
  };

  return (
    <>
      <button className="alink" onClick={() => items(L => L.unshift({ id: rid(), ico: isL ? 'link' : '', title: '', sub: '', url: '', off: false }))}>+ Add {isL ? 'link' : 'icon'}</button>
      {b.items.map((it, j) => {
        const key = `l${i}:${it.id}`;
        return (
          <div key={it.id} className={`lc ${it.off ? 'off' : ''} ${dnd.over === key ? 'over' : ''}`}
            {...dnd.card(key, 'l' + i, j, (from, to) => items(L => { const [m] = L.splice(from, 1); L.splice(to, 0, m); }))}>
            <span className="dg ldg" title="Drag to reorder" {...dnd.handle(key)}>⠿</span>
            <div className="lb">
              <Field ed={ed} path={`blocks.${i}.items.${j}.title`} placeholder={isL ? 'Title' : 'Label (e.g. Instagram)'} className="lt" />
              {isL && <Field ed={ed} path={`blocks.${i}.items.${j}.sub`} placeholder="Subtitle (optional)" className="ls" />}
              <Field ed={ed} path={`blocks.${i}.items.${j}.url`} placeholder="https://…" className="lu" onBlur={() => autoIcon(j)} />
              <div className="la">
                <span className="stt" title="Clicks"><Icon name="graph" size={15} /> {clicks(it.id)} clicks</span>
                <span style={{ flex: 1 }} />
                <Menu label={<Icon name="dots" size={15} />} title="Link options">
                  <button onClick={() => items(L => L.splice(j + 1, 0, { ...structuredClone(L[j]), id: rid() }))}>Duplicate</button>
                  <button onClick={() => items(L => L.splice(j, 1))}>Delete</button>
                </Menu>
                <button className={`tg ${it.off ? '' : 'on'}`} role="switch" aria-checked={!it.off} aria-label={it.off ? 'Hidden. Show link' : 'Visible. Hide link'}
                  title={it.off ? 'Hidden' : 'Visible'} onClick={() => items(L => { L[j].off = !L[j].off; })} />
              </div>
            </div>
            <button className="itile" title="Choose icon" aria-label="Choose icon" onClick={() => openPicker(i, j)}><Tile item={it} /></button>
          </div>
        );
      })}
      <div className="chips">
        {isL
          ? Object.keys(Q).map(k => <button key={k} onClick={() => items(L => L.push({ id: rid(), ico: Q[k][0], title: Q[k][1], sub: '', url: Q[k][2], off: false }))}><Icon name={Q[k][0]} size={14} /> {k}</button>)
          : Object.keys(QS).map(k => <button key={k} onClick={() => items(L => L.push({ id: rid(), ico: QS[k][0], title: k, url: QS[k][1], off: false }))}><Icon name={QS[k][0]} size={14} /> {k}</button>)}
      </div>
    </>
  );
}

/* ---------- one block's editor ---------- */
function BlockBody({ ed, b, i, openPicker }) {
  const { account, stats, update } = ed;
  const clicks = (stats && stats.byLink && stats.byLink[b.id]) || 0;
  if (b.type === 'links') return <Items ed={ed} b={b} i={i} isL openPicker={openPicker} />;
  if (b.type === 'social') return <Items ed={ed} b={b} i={i} isL={false} openPicker={openPicker} />;
  if (b.type === 'text') {
    return (
      <>
        <textarea aria-label="Text" placeholder="Write something" value={b.text} onChange={e => ed.set(`blocks.${i}.text`, e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <select aria-label="Font" value={b.f || ''} onChange={e => ed.set(`blocks.${i}.f`, e.target.value)}>
            <option value="">Theme font</option>
            {FONTS.map(f => <option key={f}>{f}</option>)}
          </select>
          <button style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => update(a => { a.blocks[i].f = ''; a.blocks[i].s = 0; })}>Reset</button>
        </div>
        <Slider ed={ed} label="Text size" path={`blocks.${i}.s`} min={8} max={72} value={b.s || 16} unit="px" />
      </>
    );
  }
  if (b.type === 'video') return <Field ed={ed} path={`blocks.${i}.url`} placeholder="YouTube link" />;
  if (b.type === 'contact') {
    return (
      <>
        <Field ed={ed} path={`blocks.${i}.label`} placeholder="Button label" />
        <Field ed={ed} path={`blocks.${i}.url`} placeholder="Paste your vCard link (https://…)" />
        <small className="hint">Create the vCard yourself, host it, and paste its link here. The button only shows once a link is set. Taps on it are counted.</small>
        <small>{clicks} clicks</small>
      </>
    );
  }
  if (b.type === 'images') {
    return (
      <>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {b.imgs.map((s, j) => (
            <div key={s + j} style={{ position: 'relative' }}>
              <img className="th" src={asset(s)} alt="" />
              <button aria-label="Remove image" style={{ position: 'absolute', top: -6, right: -6, padding: '0 6px' }} onClick={() => update(a => { a.blocks[i].imgs.splice(j, 1); })}>✕</button>
            </div>
          ))}
        </div>
        <button style={{ marginTop: 8 }} onClick={() => ed.pickFile('img:' + i, true)}><Icon name="upload" size={14} /> Upload images</button>
      </>
    );
  }
  return <small style={{ color: 'var(--mut)' }}>Nothing to edit.</small>;
}

/* ---------- profile header ---------- */
function HeaderBody({ ed }) {
  const { account, update } = ed;
  const toast = useToast();
  const p = account.profile;
  const url = nfcUrl(account.slug);
  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        {p.photo && <img className="th" src={asset(p.photo)} alt="" />}
        <button onClick={() => ed.pickFile('photo')}><Icon name="upload" size={14} /> {p.photo ? 'Change' : 'Upload'} photo</button>
        {p.photo && <button onClick={() => update(a => { a.profile.photo = ''; })}>Remove</button>}
      </div>
      <Field ed={ed} path="profile.name" placeholder="Full name" />
      <Field ed={ed} path="profile.title" placeholder="Job title (e.g. Manager)" />
      <Field ed={ed} path="profile.department" placeholder="Department" />
      <Field ed={ed} path="profile.company" placeholder="Company name" />
      <textarea aria-label="Bio" placeholder="Short bio (optional)" value={p.bio} onChange={e => ed.set('profile.bio', e.target.value)} />
      <div className="row" style={{ marginBottom: 4 }}>
        {p.logo && <img className="th" src={asset(p.logo)} alt="" style={{ objectFit: 'contain', background: '#fff' }} />}
        <button onClick={() => ed.pickFile('logo')}><Icon name="upload" size={14} /> {p.logo ? 'Change' : 'Upload'} company logo</button>
        {p.logo && <button onClick={() => update(a => { a.profile.logo = ''; })}>Remove</button>}
      </div>
      <small className="hint">The company logo shows in the top-right corner of the page.</small>
      {p.logo && (
        <div className="lgc">
          <h2 style={{ margin: '10px 0 0' }}>Logo size &amp; crop</h2>
          <Slider ed={ed} label="Size (% of page width)" path="profile.logoSize" min={10} max={45} value={Math.min(p.logoSize ?? 30, 45)} unit="%" />
          <Slider ed={ed} label="Crop height (%)" path="profile.logoH" min={15} max={150} value={p.logoH ?? 40} unit="%" />
          <Slider ed={ed} label="Zoom (%)" path="profile.logoZoom" min={50} max={300} value={p.logoZoom ?? 100} unit="%" />
          <Slider ed={ed} label="Move left / right" path="profile.logoX" min={-50} max={50} value={p.logoX ?? 0} unit="%" />
          <Slider ed={ed} label="Move up / down" path="profile.logoY" min={-50} max={50} value={p.logoY ?? 0} unit="%" />
          <button onClick={() => update(a => Object.assign(a.profile, { logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 }))}>Reset logo</button>
        </div>
      )}
      <small style={{ color: 'var(--mut)' }}>Page address (don’t change after programming the NFC card)</small>
      <Field ed={ed} path="slug" placeholder="page-address" />
      <small style={{ color: 'var(--mut)' }}>NFC card URL</small>
      <div className="row">
        <input readOnly aria-label="NFC card URL" value={url} />
        <button onClick={async () => toast((await copyText(url)) ? 'NFC link copied' : url, { ms: 5000 })}>Copy</button>
      </div>
    </>
  );
}

export default function BioTab({ ed }) {
  const { account, open, setOpen, update } = ed;
  const confirm = useConfirm();
  const dnd = useReorder();
  const [picker, setPicker] = useState(null); // [blockIndex, itemIndex]
  const [adding, setAdding] = useState(false);

  const toggleOpen = (e, id) => { if (!e.target.closest('button, .mn, .dg')) setOpen(open === id ? null : id); };
  const removeBlock = async i => {
    const ok = await confirm({ title: 'Delete this block?', text: 'You can still undo this afterwards.', confirm: 'Delete block' });
    if (ok) update(a => { a.blocks.splice(i, 1); });
  };
  const duplicate = i => update(a => {
    const c = structuredClone(a.blocks[i]);
    c.id = rid();
    (c.items || []).forEach(x => { x.id = rid(); });
    a.blocks.splice(i + 1, 0, c);
  });

  return (
    <>
      <button className="blk" onClick={() => setAdding(true)}>+ Add block</button>
      <div>
        <div className="bc">
          <div className="bh" onClick={e => toggleOpen(e, 'hdr')}>
            <span style={{ width: 12 }} /><span className="chip"><Icon name="profile" size={18} /></span><button className="bt" aria-expanded={open === 'hdr'} onClick={() => setOpen(open === 'hdr' ? null : 'hdr')}>Header</button><i />
          </div>
          {open === 'hdr' && <div className="bd"><HeaderBody ed={ed} /></div>}
        </div>

        {account.blocks.map((b, i) => (
          <div key={b.id} className={`bc ${b.off ? 'off' : ''} ${dnd.over === 'b' + b.id ? 'over' : ''}`}
            {...dnd.card('b' + b.id, 'blocks', i, (from, to) => update(a => { const [m] = a.blocks.splice(from, 1); a.blocks.splice(to, 0, m); }))}>
            <div className="bh" onClick={e => toggleOpen(e, b.id)}>
              <span className="dg" title="Drag" {...dnd.handle('b' + b.id)}>⠿</span>
              <span className="chip"><Icon name={ICON[b.type]} size={18} /></span>
              <button className="bt" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>{NAME[b.type]}</button><i />
              <Menu title="Block options">
                <button onClick={() => duplicate(i)}>Duplicate</button>
                <button onClick={() => removeBlock(i)}>Delete</button>
              </Menu>
              <button aria-label={b.off ? 'Hidden. Show block' : 'Visible. Hide block'} title={b.off ? 'Hidden' : 'Visible'} onClick={() => update(a => { a.blocks[i].off = !a.blocks[i].off; })}>
                <Icon name={b.off ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
            {open === b.id && <div className="bd"><BlockBody ed={ed} b={b} i={i} openPicker={(bi, ij) => setPicker([bi, ij])} /></div>}
          </div>
        ))}
      </div>
      {adding && <AddBlock ed={ed} onClose={() => setAdding(false)} />}
      {picker && <IconPicker i={picker[0]} j={picker[1]} ed={ed} onClose={() => setPicker(null)} />}
    </>
  );
}
