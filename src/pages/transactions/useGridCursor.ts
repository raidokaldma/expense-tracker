import { useLayoutEffect, useState } from 'react';
import type { TransactionId } from '../../../shared/types';
import { COLS, DRAFT_ID } from './columns';
import { isEditMove, type Move, positionAfter } from './gridKeys';
import type { VisibleRow } from './visibleRows';

/**
 * The active cell follows its row (by id), so rows appearing or disappearing above it never move it to another
 * transaction. `at` is the last known position, used when the row itself disappears.
 */
export interface Cursor {
  id: TransactionId;
  col: number;
  at: number;
  /** Scroll the row to the middle of the grid (after a jump from Find or Overview). */
  center?: boolean;
  /** Open the editor once the cursor is there (Tab, split, double-click). */
  edit?: boolean;
}

/** A move relative to a row that is not in the list yet (just created from the draft). */
interface PendingMove {
  id: TransactionId;
  col: number;
  move: Move;
}

export function useGridCursor(visible: VisibleRow[]) {
  const [cursor, setCursor] = useState<Cursor>({ id: DRAFT_ID, col: 0, at: 0 });
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const found = visible.findIndex((v) => v.transaction.id === cursor.id);
  const rowIndex = found >= 0 ? found : Math.min(cursor.at, visible.length - 1);

  const moveTo = (row: number, col: number, extra: Partial<Cursor> = {}) =>
    setCursor({ id: visible[row].transaction.id, col, at: row, ...extra });

  const moveFrom = (row: number, col: number, move: Move) => {
    const to = positionAfter({ row, col }, move, visible.length);
    moveTo(to.row, to.col, { edit: isEditMove(move) });
  };

  useLayoutEffect(() => {
    if (!pendingMove) return;
    const at = visible.findIndex((v) => v.transaction.id === pendingMove.id);
    if (at < 0) return;
    setPendingMove(null);
    moveFrom(at, pendingMove.col, pendingMove.move);
  });

  return {
    cursor,
    setCursor,
    rowIndex,
    activeRow: visible[rowIndex],
    column: COLS[cursor.col],
    moveTo,

    /** Moves the cursor after a save in the active cell. */
    moveAfterSave(move: Move) {
      if (move !== 'none') moveFrom(rowIndex, cursor.col, move);
    },

    /** Moves relative to row `id` once it appears in the list. */
    moveOnceShown: (id: TransactionId, col: number, move: Move) => setPendingMove({ id, col, move }),

    clearEditRequest: () => setCursor((c) => ({ ...c, edit: false })),
  };
}
