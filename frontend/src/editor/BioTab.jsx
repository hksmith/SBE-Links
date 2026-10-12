// "Link in Bio" tab: the header card plus every block, each expandable, reorderable by drag.
import { useState } from 'react';
import { ICONS, guess } from '../lib/icons.js';
import { O, rid, cls } from '../lib/utils.js';
import { NAME, ICON, CAT, NEWB, Q, QS } from '../lib/constants.js';
import { Icon, Tile } from '../components/Icon.jsx';
import { Menu } from '../components/Menu.jsx';
import { Modal } from '../components/Modal.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { confirmDialog } from '../components/Dialog.jsx';
import { useEd, Text, Area, FontSelect, Slider } from './fields.jsx';
import { useDragSort, move } from './useDragSort.js';
import { HeaderEditor } from './HeaderEditor.jsx';

export function BioTab({ open, setOpen }) {
  const { cur, update } = useEd();
  const [adding, setAdding] = useState(false);
  const toggle = k => setOpen(open === k ? null : k);
  const dnd = useDragSort((from, to) => update(d => move(d.blocks, from, to)));

  const addBlock = type => {
    const b = { id: rid(), type, off: false, ...NEWB[type]() };
    update(d => { d.blocks.push(b); });
    setOpen(b.id);
    setAdding(false);
  };

  return <>
    {cur.kind === 'template' && <div className="note">In links you can write <code>{'{phone}'}</code>, <code>{'{email}'}</code>, <code>{'{whatsapp}'}</code>, <code>{'{website}'}</code>, <code>{'{linkedin}'}</code>, <code>{'{address}'}</code> or any Excel column, e.g. <code>{'tel:{phone}'}</code> or <code>{'https://wa.me/{whatsapp}'}</code>. Each card fills in its own details; a link with an empty detail is hidden on that card.</div>}
    {cur.company && cur.kind === 'account' && <div className="note">These links belong to this card only. Details like <code>{'{phone}'}</code> come from <b>Contact details</b> in the header.</div>}
    <button className="blk" onClick={() => setAdding(true)}>+ Add block</button>
    <div>
      <div className="bc">
        <div className="bh" onClick={() => toggle('hdr')}>
          <span style={{ width: 12 }} /><span className="chip"><Icon k={cur.kind === 'page' ? 'building' : 'profile'} /></span><b>{cur.kind === 'page' ? 'Company details' : cur.kind === 'template' ? 'Header & sample details' : 'Header'}</b><i />
        </div>
        {open === 'hdr' && <div className="bd"><HeaderEditor /></div>}
      </div>
      {cur.blocks.map((b, i) => (
        <BlockCard key={b.id} b={b} i={i} open={open === b.id} onToggle={() => toggle(b.id)} drag={dnd.item(i)} handle={dnd.handle(i)} over={dnd.over === i} />
      ))}
    </div>
    {adding && <AddBlockModal onPick={addBlock} onClose={() => setAdding(false)} />}
  </>;
}

function BlockCard({ b, i, open, onToggle, drag, handle, over }) {
  const { update } = useEd();
  const duplicate = () => update(d => {
    const c = JSON.parse(JSON.stringify(d.blocks[i]));
    c.id = rid(); (c.items || []).forEach(x => (x.id = rid()));
    d.blocks.splice(i + 1, 0, c);
  });
  const remove = async () => {
    if (await confirmDialog({ title: 'Delete this block?', text: 'You can still undo this afterwards.', confirm: 'Delete block' })) update(d => { d.blocks.splice(i, 1); });
  };
  return (
    <div className={cls('bc', b.off && 'off', over && 'over')} {...drag}>
      <div className="bh" onClick={e => { if (!e.target.closest('button,details,.dg')) onToggle(); }}>
        <span className="dg" title="Drag" {...handle}>⠿</span>
        <span className="chip"><Icon k={ICON[b.type]} /></span>
        <b>{NAME[b.type]}</b><i />
        <Menu summary="•••" label="Block menu">
          <button onClick={duplicate}>Duplicate</button>
          <button onClick={remove}>Delete</button>
        </Menu>
        <button title={b.off ? 'Show block' : 'Hide block'} onClick={() => update(d => { d.blocks[i].off = !d.blocks[i].off; })}><Icon k={b.off ? 'eye-off' : 'eye'} size={16} /></button>
      </div>
      {open && <div className="bd"><BlockBody b={b} i={i} /></div>}
    </div>
  );
}

function BlockBody({ b, i }) {
  const { update, upload, uploadVcf, stats } = useEd();
  switch (b.type) {
    case 'links': return <LinkItems b={b} i={i} isLink />;
    case 'social': return <LinkItems b={b} i={i} isLink={false} />;
    case 'text': return <>
      <Area path={`blocks.${i}.text`} placeholder="Write something" />
      <div className="row" style={{ marginTop: 8 }}>
        <FontSelect path={`blocks.${i}.f`} empty="Theme font" />
        <button style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => update(d => Object.assign(d.blocks[i], { f: '', s: 0 }))}>Reset</button>
      </div>
      <Slider label="Text size" path={`blocks.${i}.s`} min={8} max={72} value={b.s || 16} unit="px" />
    </>;
    case 'video': return <Text path={`blocks.${i}.url`} placeholder="YouTube link" />;
    case 'contact': return <>
      <Text path={`blocks.${i}.label`} placeholder="Button label" />
      <label className="sw"><span>Build it automatically from the person’s details</span><input type="checkbox" checked={!!b.auto} onChange={e => update(d => { d.blocks[i].auto = e.target.checked; })} /><i /></label>
      {b.auto ? <small className="hint">The contact card is made from the name, job title, company, phone, email and website — always up to date, nothing to upload.</small> : <>
      <div className="vcf">
        {b.vcf ? <>
          <span className="chip"><Icon k="contact" /></span>
          <span className="vn"><b>{b.vcfName || 'contact.vcf'}</b><small>Uploaded vCard — used for the button</small></span>
          <button onClick={() => uploadVcf(i)}>Replace</button>
          <button onClick={() => update(d => Object.assign(d.blocks[i], { vcf: '', vcfName: '' }))}>Remove</button>
        </> : <>
          <button onClick={() => uploadVcf(i)}><Icon k="upload" size={14} /> Upload .vcf file</button>
          <small className="hint" style={{ margin: 0 }}>Recommended — opens “Add contact” on Android and iPhone.</small>
        </>}
      </div>
      {!b.vcf && <>
        <small style={{ color: 'var(--mut)' }}>…or paste a link to a vCard hosted elsewhere</small>
        <Text path={`blocks.${i}.url`} placeholder="https://…/contact.vcf" />
      </>}
      </>}
      <small className="hint">The server sends the vCard with the right contact settings, so phones offer to save it instead of just downloading a file. The button only shows once a file or link is set. Taps on it are counted.</small>
      <small>{stats.byLink[b.id] || 0} clicks</small>
    </>;
    case 'images': return <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {b.imgs.map((s, j) => (
          <div key={s + j} style={{ position: 'relative' }}>
            <img className="th" src={s} alt="" />
            <button aria-label="Remove image" style={{ position: 'absolute', top: -6, right: -6, padding: '0 6px' }} onClick={() => update(d => { d.blocks[i].imgs.splice(j, 1); })}>✕</button>
          </div>
        ))}
      </div>
      <button style={{ marginTop: 8 }} onClick={() => upload('img:' + i)}><Icon k="upload" size={14} /> Upload images</button>
    </>;
    default: return <small style={{ color: 'var(--mut)' }}>Nothing to edit.</small>;
  }
}

// Link buttons (isLink) or social chips: title/subtitle/url, icon tile, show/hide, quick-add chips.
function LinkItems({ b, i, isLink }) {
  const { update, upload, stats, curRef } = useEd();
  const [picking, setPicking] = useState(null);
  const dnd = useDragSort((from, to) => update(d => move(d.blocks[i].items, from, to)));
  const item = (j, fn) => update(d => fn(d.blocks[i].items, d.blocks[i].items[j]));

  // Auto-pick an icon when a URL is entered (unless one was chosen by hand).
  const autoIcon = j => {
    const it = curRef.current.blocks[i]?.items[j];
    if (!it || it.img || (it.ico && it.ico !== 'link' && it.ico !== 'globe')) return;
    const g = guess(it.url);
    if (g && g !== it.ico) item(j, (L, x) => { x.ico = g; x.icon = ''; });
  };

  return <>
    <button className="alink" onClick={() => update(d => { d.blocks[i].items.unshift({ id: rid(), ico: b.type === 'social' ? '' : 'link', title: '', sub: '', url: '', off: false }); })}>
      + Add {isLink ? 'link' : 'icon'}
    </button>
    {b.items.map((it, j) => (
      <div key={it.id || j} className={cls('lc', it.off && 'off', dnd.over === j && 'over')} {...dnd.item(j)}>
        <span className="dg ldg" title="Drag to reorder" {...dnd.handle(j)}>⠿</span>
        <div className="lb">
          <Text path={`blocks.${i}.items.${j}.title`} placeholder={isLink ? 'Title' : 'Label (e.g. Instagram)'} className="lt" />
          {isLink && <Text path={`blocks.${i}.items.${j}.sub`} placeholder="Subtitle (optional)" className="ls" />}
          <Text path={`blocks.${i}.items.${j}.url`} placeholder="https://…" className="lu" onBlur={() => autoIcon(j)} />
          <div className="la">
            <span className="stt" title="Clicks"><Icon k="graph" size={15} /> {stats.byLink[it.id] || 0} clicks</span>
            <span style={{ flex: 1 }} />
            <Menu summary={<Icon k="dots" size={15} />} label="Link menu">
              <button onClick={() => item(j, L => L.splice(j + 1, 0, { ...JSON.parse(JSON.stringify(L[j])), id: rid() }))}>Duplicate</button>
              <button onClick={() => item(j, L => L.splice(j, 1))}>Delete</button>
            </Menu>
            <button className={cls('tg', !it.off && 'on')} title={it.off ? 'Hidden' : 'Visible'} aria-label="Show or hide" onClick={() => item(j, (L, x) => { x.off = !x.off; })} />
          </div>
        </div>
        <button className="itile" title="Choose icon" onClick={() => setPicking(j)}><Tile it={it} /></button>
      </div>
    ))}
    <div className="chips">
      {isLink
        ? Object.keys(Q).map(k => <button key={k} onClick={() => update(d => { d.blocks[i].items.push({ id: rid(), ico: Q[k][0], title: Q[k][1], sub: '', url: Q[k][2], off: false }); })}><Icon k={Q[k][0]} size={14} /> {k}</button>)
        : Object.keys(QS).map(k => <button key={k} onClick={() => update(d => { d.blocks[i].items.push({ id: rid(), ico: QS[k][0], title: k, url: QS[k][1], off: false }); })}><Icon k={QS[k][0]} size={14} /> {k}</button>)}
    </div>
    {picking != null && (
      <IconPicker
        onClose={() => setPicking(null)}
        onPick={k => { item(picking, (L, x) => Object.assign(x, { ico: k, img: '', icon: '' })); setPicking(null); }}
        onUpload={() => { const j = picking; setPicking(null); upload(`ico:${i}:${j}`); }}
      />
    )}
  </>;
}

function IconPicker({ onPick, onUpload, onClose }) {
  const [f, setF] = useState('');
  const q = f.toLowerCase();
  const L = Object.entries(ICONS).filter(([k, v]) => v[3] !== 'u' && (k + ' ' + v[0]).toLowerCase().includes(q));
  const group = cat => {
    const g = L.filter(([, v]) => v[3] === cat);
    return g.length ? g.map(([k, v]) => <button key={k} className="ib" title={v[0]} onClick={() => onPick(k)}><Icon k={k} size={28} /><span>{v[0]}</span></button>) : <small>No match</small>;
  };
  return (
    <Modal title="Choose an icon" onClose={onClose}>
      <input autoFocus placeholder="Search icons…" value={f} onChange={e => setF(e.target.value)} style={{ margin: '12px 0 8px' }} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={onUpload}><Icon k="upload" size={14} /> Upload your own</button>
        <button onClick={() => onPick('')}>No icon</button>
      </div>
      <h2>Social &amp; apps</h2><div className="ibs">{group('s')}</div>
      <h2>General</h2><div className="ibs">{group('g')}</div>
    </Modal>
  );
}

function AddBlockModal({ onPick, onClose }) {
  const [f, setF] = useState('');
  const shown = CAT.filter(c => (NAME[c[0]] + c[1]).toLowerCase().includes(f.toLowerCase()));
  return (
    <Modal title="Add a block" onClose={onClose}>
      <input autoFocus placeholder="Search blocks…" value={f} onChange={e => setF(e.target.value)} style={{ margin: '12px 0' }} />
      <div className="tiles">
        {shown.map(([type, desc]) => (
          <button key={type} className="tile" onClick={() => onPick(type)}>
            <span className="chip"><Icon k={ICON[type]} size={20} /></span>
            <b>{NAME[type].split(' –')[0]}</b>
            <small>{desc}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}
