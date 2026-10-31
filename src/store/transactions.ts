import type {
  CreateTransaction,
  ImportResult,
  ImportTransaction,
  NewTransaction,
  Transaction,
  TransactionId,
} from '../../shared/types';
import { api, persist, readAll, useStore } from './store';
import { type HistoryItem, inverse, type UndoEntry, undoHistory } from './undoHistory';
import { enqueue, writesDone } from './writeQueue';

function findRow(id: TransactionId) {
  return useStore.getState().transactions.find((t) => t.id === id);
}

function addRows(rows: Transaction[]) {
  useStore.setState((state) => ({ transactions: [...state.transactions, ...rows] }));
}

function dropRows(ids: ReadonlySet<TransactionId>) {
  useStore.setState((state) => ({ transactions: state.transactions.filter((t) => !ids.has(t.id)) }));
}

// Edits show at once; when the write is done, the row is replaced by the stored one. Writes run in order, so the
// last one to finish carries every edit, even if a reload in between showed an older copy.
function replaceRow(row: Transaction) {
  useStore.setState((state) => ({ transactions: state.transactions.map((t) => (t.id === row.id ? row : t)) }));
}

/** Adds a row; the history step is recorded before the queue moves on, so an Undo pressed meanwhile waits for it. */
function addRow(save: () => Promise<Transaction>, label: string, column?: keyof NewTransaction) {
  return enqueue(async () => {
    const row = await save();
    addRows([row]);
    undoHistory.record({ entry: { kind: 'create', rows: [row] }, label, column });
    return row;
  });
}

export function createTransaction(t: CreateTransaction, column?: keyof NewTransaction) {
  return addRow(() => api().transactions.create(t), 'new row', column);
}

/** A new row with everything but the amount and category; it keeps the bank id, so a re-import skips it too. */
export function splitTransaction(id: TransactionId) {
  const { id: _id, updatedAt: _updatedAt, ...source } = findRow(id)!;
  return addRow(() => api().transactions.create({ ...source, amount: null, categoryId: null }), 'split', 'amount');
}

export function updateTransaction(id: TransactionId, patch: Partial<NewTransaction>, label: string) {
  const row = findRow(id);
  if (!row) return;
  const fields = Object.keys(patch) as (keyof NewTransaction)[];
  const before = Object.fromEntries(fields.map((field) => [field, row[field]])) as Partial<NewTransaction>;
  replaceRow({ ...row, ...patch });
  undoHistory.record({ entry: { kind: 'update', id, before, after: patch }, label, column: fields[0] });
  persist(() => api().transactions.update(id, patch).then(replaceRow));
}

/** Deletes the rows as one step: a single Undo brings them all back. */
export function removeTransactions(ids: ReadonlySet<TransactionId>) {
  const rows = useStore.getState().transactions.filter((t) => ids.has(t.id));
  if (!rows.length) return;
  dropRows(ids);
  undoHistory.record({
    entry: { kind: 'remove', rows },
    label: rows.length === 1 ? 'delete row' : `delete ${rows.length} rows`,
  });
  for (const row of rows) persist(() => api().transactions.remove(row.id));
}

/** Applies the inverse of the last step. Returns the step for cursor placement, or null when there is none. */
export async function undo(): Promise<HistoryItem | null> {
  await writesDone();
  const item = undoHistory.takeUndo();
  if (item) apply(inverse(item.entry));
  return item ?? null;
}

export async function redo(): Promise<HistoryItem | null> {
  await writesDone();
  const item = undoHistory.takeRedo();
  if (item) apply(item.entry);
  return item ?? null;
}

function apply(entry: UndoEntry) {
  const server = api().transactions;
  switch (entry.kind) {
    case 'update': {
      const row = findRow(entry.id);
      if (row) replaceRow({ ...row, ...entry.after });
      persist(() => server.update(entry.id, entry.after).then(replaceRow));
      return;
    }
    case 'create':
      // the rows come back with their original ids
      addRows(entry.rows);
      for (const row of entry.rows) persist(() => server.restore(row));
      return;
    case 'remove':
      dropRows(new Set(entry.rows.map((r) => r.id)));
      for (const row of entry.rows) persist(() => server.remove(row.id));
      return;
  }
}

export function importTransactions(rows: ImportTransaction[]): Promise<ImportResult> {
  return enqueue(async () => {
    const result = await api().transactions.import(rows);
    // undoing an earlier delete could bring back a row the import just added again
    undoHistory.clear();
    await readAll();
    return result;
  });
}
