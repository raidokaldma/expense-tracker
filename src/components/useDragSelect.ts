import { type RefObject, useCallback, useEffect, useRef } from 'react';

/** How close to an edge of the scroll area (px) the pointer starts scrolling it. */
const EDGE = 32;
/** The fastest scroll, in px per frame. */
const MAX_STEP = 24;

/**
 * Selecting by dragging. Call the returned `start` on a mouse-down with what was pressed on; until the button is
 * released, each new thing under the pointer goes to `onExtend`. `pick` names what an element is (a cell, a row),
 * or null. Near or past an edge of the scroll area, the area scrolls and what comes under the pointer is picked.
 */
export function useDragSelect<T extends string | number>(
  scrollRef: RefObject<HTMLElement | null>,
  pick: (el: HTMLElement) => T | null,
  onExtend: (target: T) => void,
) {
  const latest = useRef({ pick, onExtend });
  latest.current = { pick, onExtend };
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  return useCallback(
    (startedOn: T) => {
      stop.current?.();
      let pointer: { x: number; y: number } | null = null;
      let last = startedOn;
      let frame = 0;

      // past the edges, what is just inside the area counts; sticky headers are looked through
      const extendAtPointer = () => {
        const area = scrollRef.current;
        if (!pointer || !area) return;
        const box = area.getBoundingClientRect();
        const x = Math.min(Math.max(pointer.x, box.left + 1), box.right - 1);
        const y = Math.min(Math.max(pointer.y, box.top + 1), box.bottom - 1);
        for (const el of document.elementsFromPoint(x, y)) {
          const target = el instanceof HTMLElement ? latest.current.pick(el) : null;
          if (target == null) continue;
          if (target !== last) {
            last = target;
            latest.current.onExtend(target);
          }
          return;
        }
      };

      const scroll = () => {
        const area = scrollRef.current;
        if (pointer && area) {
          const box = area.getBoundingClientRect();
          const dx = step(pointer.x - box.left, box.right - pointer.x);
          const dy = step(pointer.y - box.top, box.bottom - pointer.y);
          if (dx || dy) {
            area.scrollLeft += dx;
            area.scrollTop += dy;
            extendAtPointer();
          }
        }
        frame = requestAnimationFrame(scroll);
      };

      const onMove = (e: MouseEvent) => {
        pointer = { x: e.clientX, y: e.clientY };
        extendAtPointer();
      };
      const onUp = () => stop.current?.();
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      frame = requestAnimationFrame(scroll);
      stop.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        cancelAnimationFrame(frame);
        stop.current = null;
      };
    },
    [scrollRef],
  );
}

/** Scrolling along one axis: faster the nearer the pointer is to an edge, or the further past it. */
function step(fromStart: number, toEnd: number) {
  if (fromStart < EDGE) return -Math.min(MAX_STEP, (EDGE - fromStart) / 2);
  if (toEnd < EDGE) return Math.min(MAX_STEP, (EDGE - toEnd) / 2);
  return 0;
}
