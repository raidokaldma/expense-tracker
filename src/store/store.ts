import { create } from 'zustand';
import { DEFAULT_PREFERENCES } from '../../shared/schemas';
import type { Account, Category, CategoryGroup, Preferences, Transaction } from '../../shared/types';
import type { Api } from '../api/api';
import { type Lookup, makeLookup } from '../model/lookup';
import { plural } from '../model/plural';
import { showToast } from './toast';
import { enqueue } from './writeQueue';

interface DataState {
  status: 'loading' | 'ready' | 'error';
  error: string;
  transactions: Transaction[];
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  preferences: Preferences;
  lookup: Lookup;
}

export const useStore = create<DataState>(() => ({
  status: 'loading',
  error: '',
  transactions: [],
  accounts: [],
  groups: [],
  categories: [],
  preferences: DEFAULT_PREFERENCES,
  lookup: makeLookup([], [], []),
}));

let connected: Api | null = null;

export function api(): Api {
  if (!connected) throw new Error('Store used before load()');
  return connected;
}

/** A write whose result the caller does not wait for: on failure, warn and reload the last saved data. */
export function persist(write: () => Promise<unknown>) {
  enqueue(write).catch((err: unknown) => {
    console.error(err);
    showToast('Saving failed — reloaded the last saved data', { warn: true });
    reload().catch(console.error);
  });
}

/** Sets accounts or categories, and the lookup built from them. */
export function setReference(patch: Partial<Pick<DataState, 'accounts' | 'groups' | 'categories'>>) {
  const next = { ...useStore.getState(), ...patch };
  useStore.setState({ ...patch, lookup: makeLookup(next.accounts, next.groups, next.categories) });
}

export async function readAll() {
  const server = api();
  const [transactions, accounts, tree, preferences] = await Promise.all([
    server.transactions.list(),
    server.accounts.list(),
    server.categories.tree(),
    server.preferences.get(),
  ]);
  useStore.setState({ status: 'ready', transactions, preferences });
  setReference({ accounts, groups: tree.groups, categories: tree.categories });
}

export async function load(server: Api) {
  connected = server;
  try {
    await reload();
  } catch (err) {
    useStore.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}

export function reload() {
  return enqueue(readAll);
}

/** Reads everything again for changes made elsewhere, such as an import, and says how many rows arrived. */
export async function refresh() {
  if (useStore.getState().status !== 'ready') return;
  try {
    // counted inside the queue, so rows still being saved here are not taken for new ones
    const added = await enqueue(async () => {
      const before = new Set(useStore.getState().transactions.map((t) => t.id));
      await readAll();
      return useStore.getState().transactions.filter((t) => !before.has(t.id)).length;
    });
    if (added) showToast(plural(added, 'new transaction'));
  } catch (err) {
    console.error(err);
    showToast('Could not reach the server', { warn: true });
  }
}
