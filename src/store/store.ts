import { create } from 'zustand';
import { type Lookup, makeLookup } from '../model/lookup';
import { plural } from '../model/plural';
import { DEFAULT_PREFERENCES } from '../model/schemas';
import type {
  Account,
  AccountId,
  Api,
  Category,
  CategoryChange,
  CategoryGroup,
  CreateTransaction,
  ImportResult,
  ImportTransaction,
  NewTransaction,
  Preferences,
  Transaction,
  TransactionId,
  UndoEntry,
} from '../model/types';

/** An undo step plus where the cursor goes when it is undone or redone. */
export interface HistoryItem {
  entry: UndoEntry;
  /** What the step did, for "Undone: …" ("clear category"); undo puts the cursor on the row, so no row is named. */
  label: string;
  column?: keyof NewTransaction;
}

export interface Toast {
  text: string;
  warn: boolean;
  /** A button in the toast, such as Undo after a delete. */
  action?: ToastAction;
  seq: number;
}

export interface ToastAction {
  label: string;
  /** The key that does the same, shown next to the label. */
  shortcut?: string;
  run: () => void;
}

interface DataState {
  status: 'loading' | 'ready' | 'error';
  error: string;
  transactions: Transaction[];
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  preferences: Preferences;
  lookup: Lookup;
  history: HistoryItem[];
  future: HistoryItem[];
  toast: Toast | null;
}

const HISTORY_LIMIT = 200;

let connected: Api | null = null;
const api = (): Api => {
  if (!connected) throw new Error('Store used before load()');
  return connected;
};

export const useStore = create<DataState>(() => ({
  status: 'loading',
  error: '',
  transactions: [],
  accounts: [],
  groups: [],
  categories: [],
  preferences: DEFAULT_PREFERENCES,
  lookup: makeLookup([], [], []),
  history: [],
  future: [],
  toast: null,
}));

const set = useStore.setState;
const get = useStore.getState;

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * A short message at the bottom of the page, for what happened out of view or could go unnoticed (deletes, saves,
 * undo, failures); not for changes already visible where the user is looking. A newer message replaces it.
 */
export function showToast(text: string, { warn = false, action }: { warn?: boolean; action?: ToastAction } = {}) {
  clearTimeout(toastTimer);
  set({ toast: { text, warn, action, seq: ++toastSeq } });
  // warnings and messages with a button stay longer
  toastTimer = setTimeout(() => set({ toast: null }), warn || action ? 6000 : 3000);
}

// Every write runs through one queue, in the order it was made. Reloads, undo and imports wait their turn too,
// so nothing reads storage before earlier writes have landed.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  // one failed task must not block the ones after it
  queue = run.catch(() => undefined);
  return run;
}

/** A write whose result the caller does not wait for: on failure, warn and reload the last saved data. */
function persist(write: () => Promise<unknown>) {
  enqueue(write).catch((err: unknown) => {
    console.error(err);
    showToast('Saving failed — reloaded the last saved data', { warn: true });
    reload().catch(console.error);
  });
}

function setReference(patch: Partial<Pick<DataState, 'accounts' | 'groups' | 'categories'>>) {
  const s = { ...get(), ...patch };
  set({ ...patch, lookup: makeLookup(s.accounts, s.groups, s.categories) });
}

function pushHistory(item: HistoryItem) {
  set((s) => ({ history: [...s.history, item].slice(-HISTORY_LIMIT), future: [] }));
}

// Edits show at once; when the write is done, the row is replaced by the stored one. Writes run in order, so the
// last one to finish carries every edit, even if a reload in between showed an older copy.
const replaceRow = (row: Transaction) =>
  set((s) => ({ transactions: s.transactions.map((t) => (t.id === row.id ? row : t)) }));

export async function load(a: Api) {
  connected = a;
  try {
    await reload();
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}

async function readAll() {
  const a = api();
  const [transactions, accounts, tree, preferences] = await Promise.all([
    a.transactions.list(),
    a.accounts.list(),
    a.categories.tree(),
    a.preferences.get(),
  ]);
  set({ status: 'ready', transactions, preferences });
  setReference({ accounts, groups: tree.groups, categories: tree.categories });
}

export const reload = () => enqueue(readAll);

/** Reads everything again for changes made elsewhere, such as an import, and says how many rows arrived. */
export async function refresh() {
  if (get().status !== 'ready') return;
  try {
    // counted inside the queue, so rows still being saved here are not taken for new ones
    const added = await enqueue(async () => {
      const before = new Set(get().transactions.map((t) => t.id));
      await readAll();
      return get().transactions.filter((t) => !before.has(t.id)).length;
    });
    if (added) showToast(plural(added, 'new transaction'));
  } catch (err) {
    console.error(err);
    showToast('Could not reach the server', { warn: true });
  }
}

// ---------- transactions ----------

/** Adds a row; the history step is recorded before the queue moves on, so an Undo pressed meanwhile waits for it. */
function addRow(save: () => Promise<Transaction>, label: string, column?: keyof NewTransaction) {
  return enqueue(async () => {
    const row = await save();
    set((s) => ({ transactions: [...s.transactions, row] }));
    pushHistory({ entry: { kind: 'create', row }, label, column });
    return row;
  });
}

export const createTransaction = (t: CreateTransaction, column?: keyof NewTransaction) =>
  addRow(() => api().transactions.create(t), 'new row', column);

/** A new row with everything but the amount and category; it keeps the bank id, so a re-import skips it too. */
export function splitTransaction(id: TransactionId) {
  const { id: _id, updatedAt: _updatedAt, ...source } = get().transactions.find((t) => t.id === id)!;
  return addRow(() => api().transactions.create({ ...source, amount: null, categoryId: null }), 'split', 'amount');
}

export function updateTransaction(id: TransactionId, patch: Partial<NewTransaction>, label: string) {
  const row = get().transactions.find((t) => t.id === id);
  if (!row) return;
  const before: Partial<NewTransaction> = {};
  for (const k of Object.keys(patch) as (keyof NewTransaction)[]) (before as Record<string, unknown>)[k] = row[k];
  replaceRow({ ...row, ...patch });
  pushHistory({
    entry: { kind: 'update', id, before, after: patch },
    label,
    column: Object.keys(patch)[0] as keyof NewTransaction,
  });
  persist(() => api().transactions.update(id, patch).then(replaceRow));
}

/** Deletes the rows as one step: a single Undo brings them all back. */
export function removeTransactions(ids: ReadonlySet<TransactionId>) {
  const rows = get().transactions.filter((t) => ids.has(t.id));
  if (!rows.length) return;
  set((s) => ({ transactions: s.transactions.filter((t) => !ids.has(t.id)) }));
  pushHistory({
    entry: { kind: 'remove', rows },
    label: rows.length === 1 ? 'delete row' : `delete ${rows.length} rows`,
  });
  for (const row of rows) persist(() => api().transactions.remove(row.id));
}

/** Applies the inverse of the last step. Returns the step for cursor placement, or null when there is none. */
export async function undo(): Promise<HistoryItem | null> {
  await queue;
  return step('history', 'future', true);
}

export async function redo(): Promise<HistoryItem | null> {
  await queue;
  return step('future', 'history', false);
}

function step(from: 'history' | 'future', to: 'history' | 'future', backwards: boolean): HistoryItem | null {
  const stack = get()[from];
  const item = stack[stack.length - 1];
  if (!item) return null;
  set((s) => ({ [from]: s[from].slice(0, -1), [to]: [...s[to], item] }));
  const e = item.entry;
  const a = api();
  if (e.kind === 'update') {
    const patch = backwards ? e.before : e.after;
    const row = get().transactions.find((t) => t.id === e.id);
    if (row) replaceRow({ ...row, ...patch });
    persist(() => a.transactions.update(e.id, patch).then(replaceRow));
  } else {
    const rows = e.kind === 'create' ? [e.row] : e.rows;
    const ids = new Set(rows.map((r) => r.id));
    if ((e.kind === 'create') === backwards) {
      // undo a create / redo a remove
      set((s) => ({ transactions: s.transactions.filter((t) => !ids.has(t.id)) }));
      for (const row of rows) persist(() => a.transactions.remove(row.id));
    } else {
      // undo a remove / redo a create: the rows come back with their original ids
      set((s) => ({ transactions: [...s.transactions, ...rows] }));
      for (const row of rows) persist(() => a.transactions.restore(row));
    }
  }
  return item;
}

export const importTransactions = (rows: ImportTransaction[]): Promise<ImportResult> =>
  enqueue(async () => {
    const result = await api().transactions.import(rows);
    // undoing an earlier delete could bring back a row the import just added again
    set({ history: [], future: [] });
    await readAll();
    return result;
  });

// ---------- accounts, categories, preferences ----------

export const createAccount = (name: string): Promise<Account> =>
  enqueue(async () => {
    const account = await api().accounts.create(name);
    setReference({ accounts: [...get().accounts, account] });
    return account;
  });

export function renameAccount(id: AccountId, name: string) {
  setReference({ accounts: get().accounts.map((a) => (a.id === id ? { ...a, name } : a)) });
  persist(() => api().accounts.rename(id, name));
}

export function removeAccount(id: AccountId) {
  setReference({ accounts: get().accounts.filter((a) => a.id !== id) });
  persist(() => api().accounts.remove(id));
}

export const saveCategories = (change: CategoryChange) =>
  enqueue(async () => {
    await api().categories.save(change);
    // transactions of deleted categories were reassigned; undo steps may point at categories that are gone
    set({ history: [], future: [] });
    // the server also dropped deleted categories from the hidden ones
    await readAll();
  });

export function setPreferences(p: Partial<Preferences>) {
  set((s) => ({ preferences: { ...s.preferences, ...p } }));
  persist(() => api().preferences.set(p));
}
