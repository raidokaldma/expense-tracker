import type { NewTransaction, Transaction, TransactionId } from '../../shared/types';

export type UndoEntry =
  | { kind: 'update'; id: TransactionId; before: Partial<NewTransaction>; after: Partial<NewTransaction> }
  | { kind: 'create'; rows: Transaction[] }
  | { kind: 'remove'; rows: Transaction[] };

/** An undo step plus where the cursor goes when it is undone or redone. */
export interface HistoryItem {
  entry: UndoEntry;
  /** What the step did, for "Undone: …" ("clear category"); undo puts the cursor on the row, so no row is named. */
  label: string;
  column?: keyof NewTransaction;
}

export function inverse(entry: UndoEntry): UndoEntry {
  switch (entry.kind) {
    case 'update':
      return { ...entry, before: entry.after, after: entry.before };
    case 'create':
      return { kind: 'remove', rows: entry.rows };
    case 'remove':
      return { kind: 'create', rows: entry.rows };
  }
}

export function firstRowId(entry: UndoEntry) {
  return entry.kind === 'update' ? entry.id : entry.rows[0].id;
}

const LIMIT = 200;

class UndoHistory {
  private done: HistoryItem[] = [];
  private undone: HistoryItem[] = [];

  record(item: HistoryItem) {
    this.done = [...this.done, item].slice(-LIMIT);
    this.undone = [];
  }

  takeUndo(): HistoryItem | undefined {
    const item = this.done.pop();
    if (item) this.undone.push(item);
    return item;
  }

  takeRedo(): HistoryItem | undefined {
    const item = this.undone.pop();
    if (item) this.done.push(item);
    return item;
  }

  clear() {
    this.done = [];
    this.undone = [];
  }
}

/** The app's one undo history; it lives as long as the page. */
export const undoHistory = new UndoHistory();
