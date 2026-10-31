// What each key does in the transactions grid, as pure functions; the page carries the commands out.
import { colMove, isMod, type KeyLike, rowMove } from '../../keys/keys';
import { COLS } from './columns';

const LAST_COL = COLS.length - 1;

/** Where the cursor goes after saving: Enter = down, Shift+Enter = up, Tab = next cell and keep editing. */
export type Move = 'none' | 'down' | 'up' | 'right-edit' | 'left-edit';

interface CellPos {
  row: number;
  col: number;
}

export const isEditMove = (move: Move) => move === 'right-edit' || move === 'left-edit';

/** The cell a move leads to: down, up, or along the row with Tab / Shift+Tab, wrapping to the next row. */
export function positionAfter({ row, col }: CellPos, move: Move, rowCount: number): CellPos {
  if (move === 'right-edit')
    return col < LAST_COL ? { row, col: col + 1 } : { row: Math.min(row + 1, rowCount - 1), col: 0 };
  if (move === 'left-edit')
    return col > 0 ? { row, col: col - 1 } : row > 0 ? { row: row - 1, col: LAST_COL } : { row, col };
  if (move === 'down') return { row: Math.min(row + 1, rowCount - 1), col };
  if (move === 'up') return { row: Math.max(row - 1, 0), col };
  return { row, col };
}

type GridKey = KeyLike & { repeat: boolean };

/** Arrow, page, Home / End and Tab moves; null for any other key, or a Tab with nowhere to go. */
export function gridMove(e: GridKey, at: CellPos, rowCount: number): CellPos | null {
  const row = rowMove(e, at.row, rowCount);
  if (row != null) return { row, col: e.key === 'Home' ? 0 : e.key === 'End' ? LAST_COL : at.col };
  const col = colMove(e, at.col, COLS.length);
  if (col != null) return { row: at.row, col };
  if (e.key !== 'Tab') return null;
  const to = positionAfter(at, e.shiftKey ? 'left-edit' : 'right-edit', rowCount);
  return to.row === at.row && to.col === at.col ? null : to;
}

export type GridCommand =
  | 'edit'
  | 'clear'
  | 'deleteRow'
  | 'splitRow'
  | 'undo'
  | 'redo'
  | 'fillDown'
  | 'focusFilter'
  /** A held ⌘⌫ or ⌘⇧S: the key is ours, but only its first press counts. */
  | 'ignore'
  /** A character typed on a cell: starts editing with it. */
  | { typed: string };

/** What a key that is not a move does; null when the key is not the grid's. */
export function gridCommand(e: GridKey): GridCommand | null {
  const key = e.key.toLowerCase();
  const mod = isMod(e);
  if (key === 'enter' || key === 'f2') return 'edit';
  // holding the shortcut deletes or splits one row only
  if (mod && (key === 'delete' || key === 'backspace')) return e.repeat ? 'ignore' : 'deleteRow';
  if (key === 'delete' || key === 'backspace') return 'clear';
  if (mod && e.shiftKey && key === 's') return e.repeat ? 'ignore' : 'splitRow';
  if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) return 'redo';
  if (mod && key === 'z') return 'undo';
  if (mod && key === 'd') return 'fillDown';
  if (key === '/' && !mod) return 'focusFilter';
  // printable keys start editing; Option (Mac) and AltGr (Ctrl+Alt) characters still count
  if (e.key.length === 1 && !e.metaKey && (!e.ctrlKey || e.altKey)) return { typed: e.key };
  return null;
}
