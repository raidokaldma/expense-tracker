import { type RefObject, useLayoutEffect } from 'react';

/** Width of the sticky row-number column. */
const ROW_NUMBER_WIDTH = 56;

interface Options {
  /** The grid's scroll area. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The sticky column titles, whose cells give each column's position. */
  headRef: RefObject<HTMLDivElement | null>;
  rowIndex: number;
  col: number;
  rowHeight: number;
  headerHeight: number;
  /** Scroll the row to the middle (after a jump from Find or Overview). */
  center?: boolean;
}

/**
 * Scrolls the grid just enough to show the active cell below the sticky header and right of the row numbers.
 * Rows all have the same height, so the position is computed rather than measured. Jumps are instant.
 */
export function useKeepCellInView({ scrollRef, headRef, rowIndex, col, rowHeight, headerHeight, center }: Options) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable
  useLayoutEffect(() => {
    const area = scrollRef.current;
    if (!area) return;
    const top = headerHeight + rowIndex * rowHeight;
    const bottom = top + rowHeight;
    let scrollTo: number | null = null;
    if (center) scrollTo = top - headerHeight - (area.clientHeight - headerHeight - rowHeight) / 2;
    else if (top < area.scrollTop + headerHeight) scrollTo = top - headerHeight;
    else if (bottom > area.scrollTop + area.clientHeight) scrollTo = bottom - area.clientHeight;
    if (scrollTo != null)
      area.scrollTop = Math.max(0, Math.min(area.scrollHeight - area.clientHeight, Math.round(scrollTo)));

    const title = headRef.current?.querySelectorAll('[role="columnheader"]')[col + 1];
    if (!title) return;
    const box = area.getBoundingClientRect();
    const cell = title.getBoundingClientRect();
    if (cell.left < box.left + ROW_NUMBER_WIDTH) area.scrollLeft -= box.left + ROW_NUMBER_WIDTH - cell.left;
    else if (cell.right > box.left + area.clientWidth) area.scrollLeft += cell.right - (box.left + area.clientWidth);
  }, [rowIndex, col, center, rowHeight, headerHeight]);
}
