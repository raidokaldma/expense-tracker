import { useMemo, useState } from 'react';
import type { TransactionId } from '../../../shared/types';
import {
  type Cell,
  nextSelection,
  rowKeys,
  type SelectHow,
  type Selection,
  selectedIds,
} from '../../components/selection';
import { amountSummary } from './amountSummary';
import type { VisibleRow } from './visibleRows';

/** Rows are selected whole: to the selection, the grid is a single column of rows. */
const SELECTION_COLS = ['row'];
function rowCell(id: string): Cell {
  return { key: id, col: 'row' };
}

/** The selected rows. A selection belongs to the active row it was made at; moving any other way starts it over. */
export function useRowSelection(visible: VisibleRow[], activeId: TransactionId) {
  const [selection, setSelection] = useState<{ at: string; selection: Selection }>({ at: '', selection: null });
  const rowIds = useMemo(() => visible.map((v) => v.transaction.id as string), [visible]);
  const current = selection.at === activeId ? selection.selection : null;
  const selectedRows = useMemo(
    () => rowKeys(selectedIds(current, rowCell(activeId), rowIds, SELECTION_COLS)),
    [current, activeId, rowIds],
  );
  const selectedSummary = useMemo(
    () => amountSummary(visible.filter((v) => selectedRows.has(v.transaction.id))),
    [selectedRows, visible],
  );

  /** Changes the selection for a move from the active row to row `row`. */
  function selectTo(row: number, how: SelectHow) {
    const target = visible[row].transaction.id;
    setSelection({
      at: target,
      selection: nextSelection(current, rowCell(activeId), rowCell(target), how, rowIds, SELECTION_COLS),
    });
  }

  return { selectedRows, selectedSummary, selectTo };
}
