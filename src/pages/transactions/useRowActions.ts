import type { TransactionId } from '../../../shared/types';
import { MOD_LABEL } from '../../keys/keys';
import type { Lookup } from '../../model/lookup';
import { plural } from '../../model/plural';
import { isBlank } from '../../model/validity';
import { showToast } from '../../store/toast';
import { redo, removeTransactions, splitTransaction, undo } from '../../store/transactions';
import { firstRowId } from '../../store/undoHistory';
import { AMOUNT_COL, COLS, DRAFT_ID, editText } from './columns';
import type { Cursor } from './useGridCursor';
import type { VisibleRow } from './visibleRows';

interface Options {
  visible: VisibleRow[];
  rowIndex: number;
  col: number;
  selectedRows: ReadonlySet<string>;
  lookup: Lookup;
  setCursor: (cursor: Cursor) => void;
  pin: (id: TransactionId) => void;
  placeSplit: (sourceId: TransactionId, splitId: TransactionId) => void;
  saveText: (row: VisibleRow, col: number, text: string) => Promise<'saved' | 'invalid'>;
}

/** Fill down, delete, split, undo and redo, each placing the cursor and saying what happened. */
export function useRowActions(options: Options) {
  const activeRow = options.visible[options.rowIndex];
  const { key } = COLS[options.col];

  async function undoOrRedo(direction: 'undo' | 'redo') {
    const item = direction === 'undo' ? await undo() : await redo();
    if (!item) {
      showToast(`Nothing to ${direction}`);
      return;
    }
    const id = firstRowId(item.entry);
    options.pin(id);
    const col = COLS.findIndex((x) => x.key === item.column);
    options.setCursor({ id, col: col < 0 ? options.col : col, at: options.rowIndex });
    showToast(`${direction === 'undo' ? 'Undone' : 'Redone'}: ${item.label}`);
  }

  return {
    undoOrRedo,

    fillDown() {
      const source = activeRow.draft ? options.visible[1] : options.visible[options.rowIndex - 1];
      if (!source || source.draft) return;
      const value = source.transaction[key];
      if (isBlank(value) || value === activeRow.transaction[key]) return;
      void options.saveText(activeRow, options.col, editText(source.transaction, key, options.lookup));
    },

    /** Deletes the selected rows, or the active one. */
    deleteRows() {
      const ids = new Set([...options.selectedRows].filter((id) => id !== DRAFT_ID) as TransactionId[]);
      if (!ids.size) return;
      removeTransactions(ids);
      showToast(`${ids.size === 1 ? 'Row' : plural(ids.size, 'row')} deleted`, {
        action: { label: 'Undo', shortcut: `${MOD_LABEL}Z`, run: () => void undoOrRedo('undo') },
      });
    },

    async splitRow() {
      if (activeRow.draft) return;
      const source = activeRow.transaction.id;
      const row = await splitTransaction(source);
      options.placeSplit(source, row.id);
      options.pin(row.id);
      options.setCursor({ id: row.id, col: AMOUNT_COL, at: options.rowIndex + 1, edit: true });
      showToast('Split — enter the amount for the new row');
    },
  };
}
