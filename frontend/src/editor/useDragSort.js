// Drag & drop reordering with a grab handle (⠿). Only the handle starts a drag, so text fields stay usable.
//   const dnd = useDragSort((from, to) => …)
//   <div {...dnd.item(i)} className={dnd.over === i ? 'over' : ''}> <span {...dnd.handle(i)}>⠿</span> … </div>
// Nested lists work: events are stopped at the list that owns the drag.
import { useRef, useState } from 'react';

export function useDragSort(onMove) {
  const [armed, setArmed] = useState(null); // item whose handle is pressed (made draggable)
  const [over, setOver] = useState(null);
  const from = useRef(null);
  const reset = () => { from.current = null; setArmed(null); setOver(null); };

  return {
    over,
    handle: i => ({
      onPointerDown: () => setArmed(i),
      onPointerUp: () => { if (from.current == null) setArmed(null); },
    }),
    item: i => ({
      draggable: armed === i,
      onDragStart: e => {
        if (armed !== i) return;
        e.stopPropagation();
        from.current = i;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', 'x'); } catch { /* old browsers */ }
      },
      onDragOver: e => {
        if (from.current == null) return;
        e.preventDefault(); e.stopPropagation();
        if (over !== i) setOver(i);
      },
      onDrop: e => {
        if (from.current == null) return;
        e.preventDefault(); e.stopPropagation();
        const f = from.current;
        reset();
        if (f !== i) onMove(f, i);
      },
      onDragEnd: e => { if (from.current != null) e.stopPropagation(); reset(); },
    }),
  };
}

export const move = (list, from, to) => { const [m] = list.splice(from, 1); list.splice(to, 0, m); };
