import type { Issue } from '../model/schemas';
import type { Api } from '../model/types';

/** An error answer from the server; issues name the fields a request got wrong. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: Issue[];
  constructor(status: number, message: string, issues: Issue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** The Api over HTTP. */
export function createHttpApi(fetchFn: Fetch = (url, init) => fetch(url, init), base = '/api'): Api {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchFn(base + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `${res.status} ${res.statusText}`, data?.issues);
    return data as T;
  }

  return {
    transactions: {
      list: () => request('GET', '/transactions'),
      create: (row) => request('POST', '/transactions', row),
      update: (id, patch) => request('PATCH', `/transactions/${id}`, patch),
      remove: (id) => request('DELETE', `/transactions/${id}`),
      restore: (row) => request('PUT', `/transactions/${row.id}`, row),
      import: (rows) => request('POST', '/transactions/import', rows),
    },
    accounts: {
      list: () => request('GET', '/accounts'),
      create: (name) => request('POST', '/accounts', { name }),
      rename: (id, name) => request('PATCH', `/accounts/${id}`, { name }),
      remove: (id) => request('DELETE', `/accounts/${id}`),
    },
    categories: {
      tree: () => request('GET', '/categories'),
      save: (change) => request('PUT', '/categories', change),
    },
    preferences: {
      get: () => request('GET', '/preferences'),
      set: (p) => request('PATCH', '/preferences', p),
    },
  };
}
