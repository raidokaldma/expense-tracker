import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../../components/cx';
import type { TransactionId } from '../../model/types';
import { COLS } from './columns';
import s from './transactions.module.css';
import { useKeepCellInView } from './useKeepCellInView';
import type { VisibleRow } from './visibleRows';

/** Row height 28px + 1px border; rows are positioned by index, so every row has this height. */
const ROW_PITCH = 29;

interface Props {
  rows: VisibleRow[];
  /** The active cell. */
  rowIndex: number;
  col: number;
  /** Scroll the active row to the middle (after a jump from Find or Overview). */
  center?: boolean;
  /** Ids of the selected rows; shaded when there are several. */
  selectedRows: ReadonlySet<string>;
  /** A row to highlight briefly. */
  flashId: TransactionId | null;
  /** The scroll area. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The element with the keyboard focus. */
  gridRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** The column titles and filters, kept in view while scrolling. */
  header: ReactNode;
  renderCell: (row: VisibleRow, index: number, col: number) => ReactNode;
}

/**
 * The transactions grid: a sticky header and virtual rows (only those in view are drawn), with the active cell
 * kept in view. The page decides what goes into each cell.
 */
export function TransactionsGrid({
  rows,
  rowIndex,
  col,
  center,
  selectedRows,
  flashId,
  scrollRef,
  gridRef,
  onKeyDown,
  header,
  renderCell,
}: Props) {
  const headRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(66);
  useLayoutEffect(() => {
    if (headRef.current) setHeaderHeight(headRef.current.offsetHeight);
  }, []);

  useKeepCellInView({
    scrollRef,
    headRef,
    rowIndex,
    col,
    rowHeight: ROW_PITCH,
    headerHeight,
    center,
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PITCH,
    overscan: 25,
    scrollMargin: headerHeight,
  });

  return (
    <div className={s.wrap} ref={scrollRef}>
      <div
        className={s.grid}
        role="grid"
        aria-label="Transactions"
        aria-activedescendant={`c-${rowIndex}-${col}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        ref={gridRef}
      >
        <div className={s.ghead} role="rowgroup" ref={headRef}>
          {header}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            const selected = selectedRows.has(row.transaction.id);
            return (
              <div
                key={row.transaction.id}
                className={cx(
                  s.row,
                  s.vrow,
                  item.index === rowIndex && s.cur,
                  row.draft && s.draft,
                  selected && selectedRows.size > 1 && s.sel,
                  row.transaction.id === flashId && s.flash,
                )}
                style={{ transform: `translateY(${item.start - headerHeight}px)` }}
                role="row"
                aria-selected={selected}
                data-row={item.index}
              >
                <div className={cx(s.cell, s.idx, 'mono')} role="rowheader">
                  <span>{row.draft ? '+' : row.number}</span>
                </div>
                {COLS.map((_, columnIndex) => renderCell(row, item.index, columnIndex))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
