import { isMod } from '../keys/keys';

/** A cell of a table: its row's key and its column's key. Row keys never contain "|". */
export interface Cell {
  key: string;
  col: string;
}

export const cellId = (cell: Cell) => `${cell.key}|${cell.col}`;

export const cellFromId = (id: string): Cell => {
  const at = id.lastIndexOf('|');
  return { key: id.slice(0, at), col: id.slice(at + 1) };
};

/** The keys of the rows that the cells are on. */
export const rowKeys = (ids: Iterable<string>) => new Set([...ids].map((id) => cellFromId(id).key));

/**
 * Selected cells beyond the active one. Null selects the active cell only. Otherwise the cells picked with ⌘+click,
 * plus the rectangle from `anchor` to the active cell (none when `anchor` is null).
 */
export type Selection = { picked: ReadonlySet<string>; anchor: Cell | null } | null;

/** How a move or click changes the selection: start over, extend from the anchor (Shift), add or remove (⌘). */
export type SelectHow = 'only' | 'extend' | 'toggle';

export const selectHow = (e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): SelectHow =>
  e.shiftKey ? 'extend' : isMod(e) ? 'toggle' : 'only';

/** Every cell between two cells, both included; the order of `keys` and `cols` decides what is between. */
function rectangle(a: Cell, b: Cell, keys: string[], cols: string[]): string[] {
  const [r1, r2] = [keys.indexOf(a.key), keys.indexOf(b.key)].sort((x, y) => x - y);
  const [c1, c2] = [cols.indexOf(a.col), cols.indexOf(b.col)].sort((x, y) => x - y);
  if (r1 < 0 || c1 < 0) return [cellId(b)];
  const ids: string[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ids.push(cellId({ key: keys[r], col: cols[c] }));
  return ids;
}

/** The ids of the selected cells that are in the table now (rows disappear, columns change). */
export function selectedIds(selection: Selection, active: Cell, keys: string[], cols: string[]): Set<string> {
  if (!selection) return new Set([cellId(active)]);
  const ids = new Set(selection.picked);
  if (selection.anchor) for (const id of rectangle(selection.anchor, active, keys, cols)) ids.add(id);
  const [rows, columns] = [new Set(keys), new Set(cols)];
  return new Set(
    [...ids].filter((id) => {
      const cell = cellFromId(id);
      return rows.has(cell.key) && columns.has(cell.col);
    }),
  );
}

/** The selection after moving from the active cell to `target`. */
export function nextSelection(
  selection: Selection,
  active: Cell,
  target: Cell,
  how: SelectHow,
  keys: string[],
  cols: string[],
): Selection {
  if (how === 'only') return null;
  if (how === 'extend') return { picked: selection?.picked ?? new Set(), anchor: selection?.anchor ?? active };
  const picked = selectedIds(selection, active, keys, cols);
  const id = cellId(target);
  const wasSelected = picked.delete(id);
  if (!wasSelected) picked.add(id);
  // a removed cell is still the active one, but not selected
  return { picked, anchor: wasSelected ? null : target };
}
