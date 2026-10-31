import { type Dispatch, type SetStateAction, useRef } from 'react';
import type { NewTransaction, TransactionId } from '../../../shared/types';
import type { Lookup } from '../../model/lookup';
import { isBlank } from '../../model/validity';
import { createTransaction, updateTransaction } from '../../store/transactions';
import { COLS, type ColKey, draftToNew, parseCell } from './columns';
import type { Move } from './gridKeys';
import type { VisibleRow } from './visibleRows';

interface Options {
  lookup: Lookup;
  /** What has been typed into the new-transaction row. */
  draft: Partial<NewTransaction>;
  setDraft: Dispatch<SetStateAction<Partial<NewTransaction>>>;
  /** Keeps an edited row visible under the current filters. */
  pin: (id: TransactionId) => void;
  moveAfterSave: (move: Move) => void;
  moveOnceShown: (id: TransactionId, col: number, move: Move) => void;
}

/** Saving cell values: into a transaction, or into the draft row, whose first value creates a new transaction. */
export function useCellSaving({ lookup, draft, setDraft, pin, moveAfterSave, moveOnceShown }: Options) {
  // while the draft is being saved as a new transaction, it cannot be edited again
  const creatingDraft = useRef(false);

  const setDraftField = (key: ColKey, value: NewTransaction[ColKey] | undefined) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function updateCell(row: VisibleRow, key: ColKey, value: NewTransaction[ColKey], label: string) {
    updateTransaction(row.transaction.id, { [key]: value }, label);
    pin(row.transaction.id);
  }

  async function createFromDraft(col: number, value: NewTransaction[ColKey], move: Move) {
    const key = COLS[col].key;
    creatingDraft.current = true;
    // the value stays visible in the draft row while it is being saved
    setDraftField(key, value);
    try {
      // new rows go on top of the list (see withMissing); the next draft keeps the account
      const created = await createTransaction(draftToNew(draft, key, value), key);
      pin(created.id);
      setDraft({ accountId: created.accountId ?? undefined });
      // Enter stays on the new row; a click elsewhere ('none') already placed the cursor
      if (move !== 'none') moveOnceShown(created.id, col, move === 'down' ? 'none' : move);
    } finally {
      creatingDraft.current = false;
    }
  }

  /** Saves an already parsed value. */
  async function saveCell(row: VisibleRow, col: number, value: NewTransaction[ColKey], move: Move) {
    const { key, label } = COLS[col];
    if (row.draft && value != null) {
      if (!creatingDraft.current) await createFromDraft(col, value, move);
      return;
    }
    if (row.draft) setDraftField(key, undefined);
    else {
      const prev = row.transaction[key];
      if (isBlank(prev) ? !isBlank(value) : prev !== value) updateCell(row, key, value, `edit ${label.toLowerCase()}`);
    }
    moveAfterSave(move);
  }

  return {
    isCreatingDraft: () => creatingDraft.current,
    saveCell,

    /** Parses and saves text into a cell (paste, fill down); text the column cannot take is not saved. */
    async saveText(row: VisibleRow, col: number, text: string): Promise<'saved' | 'invalid'> {
      const parsed = parseCell(COLS[col].key, text, row.transaction, lookup);
      if (!parsed.ok) return 'invalid';
      await saveCell(row, col, parsed.value, 'none');
      return 'saved';
    },

    clearCell(row: VisibleRow, col: number) {
      const { key, label } = COLS[col];
      if (row.draft) setDraftField(key, undefined);
      else if (!isBlank(row.transaction[key])) updateCell(row, key, null, `clear ${label.toLowerCase()}`);
    },
  };
}
