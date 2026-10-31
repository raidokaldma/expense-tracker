import type { Api } from '../model/types';

/**
 * Logs every Api call to the console as the REST request it stands for (e.g. "PATCH /transactions/:id"),
 * with how long it took, so it is easy to see how many requests a user action makes.
 */
export function withRequestLog(api: Api): Api {
  async function request<T>(method: string, path: string, run: () => Promise<T>, body?: unknown): Promise<T> {
    const started = performance.now();
    const took = () => `${Math.round(performance.now() - started)} ms`;
    const extra = body === undefined ? [] : [body];
    try {
      const result = await run();
      console.info(`${method} ${path} · ${took()}`, ...extra);
      return result;
    } catch (err) {
      console.warn(`${method} ${path} · failed after ${took()}`, ...extra, err);
      throw err;
    }
  }

  const { transactions: t, accounts: a, categories: c, preferences: p } = api;
  return {
    transactions: {
      list: () => request('GET', '/transactions', () => t.list()),
      create: (row) => request('POST', '/transactions', () => t.create(row), row),
      update: (id, patch) => request('PATCH', `/transactions/${id}`, () => t.update(id, patch), patch),
      remove: (id) => request('DELETE', `/transactions/${id}`, () => t.remove(id)),
      restore: (row) => request('PUT', `/transactions/${row.id}`, () => t.restore(row), row),
      import: (rows) => request('POST', '/transactions/import', () => t.import(rows), rows),
    },
    accounts: {
      list: () => request('GET', '/accounts', () => a.list()),
      create: (name) => request('POST', '/accounts', () => a.create(name), { name }),
      rename: (id, name) => request('PATCH', `/accounts/${id}`, () => a.rename(id, name), { name }),
      remove: (id) => request('DELETE', `/accounts/${id}`, () => a.remove(id)),
    },
    categories: {
      tree: () => request('GET', '/categories', () => c.tree()),
      save: (change) => request('PUT', '/categories', () => c.save(change), change),
    },
    preferences: {
      get: () => request('GET', '/preferences', () => p.get()),
      set: (prefs) => request('PATCH', '/preferences', () => p.set(prefs), prefs),
    },
  };
}
