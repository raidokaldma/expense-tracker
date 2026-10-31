import { type RefObject, useLayoutEffect } from 'react';
import type { OverviewPeriod } from '../../../shared/types';
import pivot from './PivotTable.module.css';

interface Options {
  activeRow: number;
  activeCol: number;
  /** Changes the table's layout, so the cell may have moved. */
  period: OverviewPeriod;
  collapsed: ReadonlySet<string>;
}

/** Keeps the active cell in view, clear of the sticky month titles, Net row and category column. */
export function useKeepPivotCellInView(
  scrollRef: RefObject<HTMLDivElement | null>,
  { activeRow, activeCol, period, collapsed }: Options,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after these values have been drawn
  useLayoutEffect(() => {
    const area = scrollRef.current;
    const cell = area?.querySelector(`.${pivot.pivotCell}.${pivot.active}`);
    if (!area || !cell) return;
    const box = area.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const header = area.querySelector<HTMLElement>(`.${pivot.pivotHeader}`);
    const labelWidth = header?.querySelector<HTMLElement>(`.${pivot.pivotLabel}`)?.offsetWidth ?? 0;
    if (r.left < box.left + labelWidth) area.scrollLeft -= box.left + labelWidth - r.left;
    else if (r.right > box.left + area.clientWidth) area.scrollLeft += r.right - (box.left + area.clientWidth);
    // the Net row is always in view, being the footer
    if (cell.closest(`.${pivot.net}`)) return;
    const top = box.top + (header?.offsetHeight ?? 0);
    const bottom = box.top + area.clientHeight - (area.querySelector<HTMLElement>(`.${pivot.net}`)?.offsetHeight ?? 0);
    if (r.top < top) area.scrollTop -= top - r.top;
    else if (r.bottom > bottom) area.scrollTop += r.bottom - bottom;
  }, [activeRow, activeCol, period, collapsed]);
}
