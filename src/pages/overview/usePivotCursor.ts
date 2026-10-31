import { useState } from 'react';
import { type Cell, nextSelection, type SelectHow, type Selection, selectedIds } from '../../components/selection';
import type { Lookup } from '../../model/lookup';
import { categoryOfRowKey, groupRowKey } from '../../model/pivot';

/** The active cell and the selected cells of the pivot table. */
export function usePivotCursor(keys: string[], cols: string[], lookup: Lookup) {
  const [cursor, setCursor] = useState<Cell | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  // a cell on a row that disappeared (collapsed, hidden) resolves to its group, else to the first row
  function resolve(cell: Cell | null): Cell | null {
    if (!keys.length) return null;
    let key = cell?.key ?? keys[0];
    const group = keys.includes(key) ? undefined : lookup.groupOf(categoryOfRowKey(key));
    if (group) key = groupRowKey(group.id);
    if (!keys.includes(key)) key = keys[0];
    return { key, col: cell && cols.includes(cell.col) ? cell.col : cols[0] };
  }

  const active = resolve(cursor);

  return {
    active,
    activeRow: active ? keys.indexOf(active.key) : -1,
    activeCol: active ? cols.indexOf(active.col) : -1,
    selected: active ? selectedIds(selection, active, keys, cols) : new Set<string>(),

    /** Makes `cell` the active one; the selection starts over, extends to it or adds / removes it. */
    moveTo(cell: Cell, how: SelectHow) {
      if (active) setSelection(nextSelection(selection, active, cell, how, keys, cols));
      setCursor(cell);
    },

    /** Puts the cursor on `cell` with nothing else selected. */
    jumpTo(cell: Cell) {
      setCursor(cell);
      setSelection(null);
    },
  };
}
