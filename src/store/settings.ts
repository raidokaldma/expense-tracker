import type { Account, AccountId, CategoryChange, Preferences } from '../../shared/types';
import { api, persist, readAll, setReference, useStore } from './store';
import { undoHistory } from './undoHistory';
import { enqueue } from './writeQueue';

export function createAccount(name: string): Promise<Account> {
  return enqueue(async () => {
    const account = await api().accounts.create(name);
    setReference({ accounts: [...useStore.getState().accounts, account] });
    return account;
  });
}

export function renameAccount(id: AccountId, name: string) {
  setReference({ accounts: useStore.getState().accounts.map((a) => (a.id === id ? { ...a, name } : a)) });
  persist(() => api().accounts.rename(id, name));
}

export function removeAccount(id: AccountId) {
  setReference({ accounts: useStore.getState().accounts.filter((a) => a.id !== id) });
  persist(() => api().accounts.remove(id));
}

export function saveCategories(change: CategoryChange) {
  return enqueue(async () => {
    await api().categories.save(change);
    // transactions of deleted categories were reassigned; undo steps may point at categories that are gone
    undoHistory.clear();
    // the server also dropped deleted categories from the hidden ones
    await readAll();
  });
}

export function setPreferences(patch: Partial<Preferences>) {
  useStore.setState((state) => ({ preferences: { ...state.preferences, ...patch } }));
  persist(() => api().preferences.set(patch));
}
