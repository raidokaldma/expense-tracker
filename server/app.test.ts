import { beforeEach, describe, expect, it } from 'vitest';
import type { Account, CategoryTree, ImportTransaction, Timestamp, Transaction } from '../src/model/types.ts';
import { createApp } from './app.ts';
import { migrate, openDatabase } from './db.ts';
import { EXAMPLE_SEED, readSeed } from './seed.ts';
import { createService, type Service } from './service.ts';

let app: ReturnType<typeof createApp>;
let service: Service;

beforeEach(() => {
  const db = openDatabase(':memory:');
  migrate(db);
  service = createService(db);
  service.seed({ ...readSeed(EXAMPLE_SEED), transactions: [] });
  app = createApp({ service });
});

async function call(method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const pushed = (externalId: string, over: Partial<ImportTransaction> = {}): ImportTransaction => ({
  externalId,
  account: 'EE123',
  occurredAt: '2026-10-20T14:30:00+03:00',
  counterparty: 'Green Basket',
  amount: -1250,
  ...over,
});

const transactions = async () => (await call('GET', '/transactions')).body as Transaction[];
const tree = async () => (await call('GET', '/categories')).body as CategoryTree;

describe('access', () => {
  it('accepts writes only as JSON', async () => {
    const res = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name: 'Cash' }),
    });
    expect(res.status).toBe(415);
  });

  it('answers unknown routes and bad JSON with errors', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
    const res = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(res.status).toBe(400);
  });
});

describe('import', () => {
  it('adds new transactions and creates their accounts', async () => {
    const res = await call('POST', '/transactions/import', [pushed('a'), pushed('b', { description: '  ' })]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      added: 2,
      skipped: [],
      ignoredConflicts: [],
      newAccounts: [{ name: 'EE123', importKey: 'EE123' }],
    });
    const rows = await transactions();
    expect(rows[0]).toMatchObject({ occurredAt: '2026-10-20T11:30:00Z', categoryId: null, amount: -1250 });
    expect(rows[1].description).toBeNull();
  });

  it('skips transaction ids it already has and keeps the edits made to them', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    await call('PATCH', `/transactions/${row.id}`, { amount: -999, counterparty: 'Edited' });
    const again = await call('POST', '/transactions/import', [pushed('a'), pushed('b')]);
    expect(again.body).toMatchObject({ added: 1, skipped: ['a'] });
    expect((await transactions()).find((t) => t.id === row.id)).toMatchObject({ amount: -999, counterparty: 'Edited' });
  });

  it('reports a skipped id whose amount differs as an ignored conflict, comparing with all its split rows together', async () => {
    await call('POST', '/transactions/import', [pushed('a'), pushed('b')]);
    const row = (await transactions()).find((t) => t.externalId === 'a')!;
    await call('PATCH', `/transactions/${row.id}`, { amount: -1000 });
    const split = { ...row, id: undefined, updatedAt: undefined, amount: -250, description: 'Bags' };
    await call('POST', '/transactions', split);
    const again = await call('POST', '/transactions/import', [pushed('a'), pushed('b', { amount: -1300 })]);
    const b = (await transactions()).find((t) => t.externalId === 'b')!;
    expect(again.body).toMatchObject({ added: 0, skipped: ['a', 'b'] });
    expect(again.body.ignoredConflicts).toEqual([
      {
        externalId: 'b',
        savedAmount: -1250,
        sentAmount: -1300,
        saved: [{ id: b.id, occurredAt: b.occurredAt, counterparty: 'Green Basket', amount: -1250, description: null }],
      },
    ]);
    expect(b.amount).toBe(-1250);

    // a split lists every part
    await call('PATCH', `/transactions/${row.id}`, { amount: -900 });
    const [conflict] = (await call('POST', '/transactions/import', [pushed('a')])).body.ignoredConflicts;
    expect(conflict).toMatchObject({ savedAmount: -1150, sentAmount: -1250 });
    expect(conflict.saved.map((t: Transaction) => [t.amount, t.description])).toEqual([
      [-900, null],
      [-250, 'Bags'],
    ]);
  });

  it('brings a transaction back only when every row with its id is deleted', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    const split = await call('POST', '/transactions', { ...row, id: undefined, updatedAt: undefined, amount: null });
    expect(split.status).toBe(201);
    await call('DELETE', `/transactions/${row.id}`);
    expect((await call('POST', '/transactions/import', [pushed('a')])).body.added).toBe(0);
    await call('DELETE', `/transactions/${split.body.id}`);
    expect((await call('POST', '/transactions/import', [pushed('a')])).body.added).toBe(1);
  });

  it('rejects the whole batch when any row is invalid, naming every problem', async () => {
    const res = await call('POST', '/transactions/import', [
      pushed('a'),
      pushed('b', { occurredAt: '2026-10-20T14:30' }),
      pushed('c', { amount: -12.5 }),
      { ...pushed('d'), category: 'Food' },
    ]);
    expect(res.status).toBe(422);
    expect(res.body.issues.map((i: { path: unknown[] }) => i.path)).toEqual([[1, 'occurredAt'], [2, 'amount'], [3]]);
    expect(await transactions()).toHaveLength(0);
  });

  it('rejects a batch that repeats a transaction id', async () => {
    const res = await call('POST', '/transactions/import', [pushed('a'), pushed('b'), pushed('a')]);
    expect(res.status).toBe(422);
    expect(res.body.issues).toEqual([{ path: [2, 'externalId'], message: 'repeats row 0' }]);
  });

  it('takes 1 to 1000 transactions per request', async () => {
    expect((await call('POST', '/transactions/import', [])).status).toBe(422);
    const many = Array.from({ length: 1001 }, (_, i) => pushed(`t${i}`));
    expect((await call('POST', '/transactions/import', many)).status).toBe(422);
    expect((await call('POST', '/transactions/import', many.slice(0, 1000))).body.added).toBe(1000);
  });

  it('names a new account after its key, numbered when the name is taken', async () => {
    await call('POST', '/accounts', { name: 'Ärikonto' });
    const res = await call('POST', '/transactions/import', [pushed('a', { account: 'ärikonto' })]);
    expect(res.body.newAccounts.map((a: Account) => a.name)).toEqual(['ärikonto 2']);
  });

  it('rejects control characters, but keeps line breaks in descriptions', async () => {
    expect(
      (await call('POST', '/transactions/import', [pushed('a', { counterparty: '\u0000Green Basket' })])).status,
    ).toBe(422);
    const ok = await call('POST', '/transactions/import', [pushed('b', { description: 'Milk\nBread' })]);
    expect(ok.body.added).toBe(1);
    expect((await call('POST', '/accounts', { name: 'Cash\u0007' })).status).toBe(422);
  });

  it('rejects impossible dates and amounts', async () => {
    for (const bad of [
      { occurredAt: '2026-02-30T10:00:00Z' },
      { occurredAt: '2026-10-20T24:30:00Z' },
      { amount: 10 ** 12 },
      { counterparty: '' },
    ]) {
      expect((await call('POST', '/transactions/import', [pushed('a', bad)])).status).toBe(422);
    }
  });
});

describe('transactions', () => {
  const blank = {
    externalId: null,
    accountId: null,
    occurredAt: null,
    counterparty: null,
    amount: null,
    categoryId: null,
    description: null,
  };

  it('creates, edits, deletes and restores a row', async () => {
    const created = await call('POST', '/transactions', { ...blank, counterparty: ' Green Basket ', amount: -500 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ counterparty: 'Green Basket', amount: -500 });
    const id = created.body.id;
    expect((await call('PATCH', `/transactions/${id}`, { description: 'Milk' })).body.description).toBe('Milk');
    expect((await call('DELETE', `/transactions/${id}`)).status).toBe(204);
    expect((await call('DELETE', `/transactions/${id}`)).status).toBe(404);
    const row = { ...created.body, description: 'Milk' };
    expect((await call('PUT', `/transactions/${id}`, row)).status).toBe(200);
    expect(await transactions()).toEqual([row]);
  });

  it('restores only a row that is gone, never over a live one', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    expect((await call('PUT', `/transactions/${row.id}`, { ...row, externalId: 'fake' })).status).toBe(409);
    const future = { ...row, id: crypto.randomUUID(), externalId: null, updatedAt: '2999-01-01T00:00:00Z' };
    expect((await call('PUT', `/transactions/${future.id}`, future)).status).toBe(422);
    expect(await transactions()).toEqual([row]);
  });

  it('refuses to undo a delete once the bank transaction was imported again', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    const old = { ...row, addedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    await call('DELETE', `/transactions/${row.id}`);
    await call('POST', '/transactions/import', [pushed('a')]);
    expect((await call('PUT', `/transactions/${old.id}`, old)).status).toBe(409);
    expect(await transactions()).toHaveLength(1);
  });

  it('undoes the delete of a split while its original is still there', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    const split = (await call('POST', '/transactions', { ...row, id: undefined, updatedAt: undefined, amount: null }))
      .body as Transaction;
    await call('DELETE', `/transactions/${split.id}`);
    expect((await call('PUT', `/transactions/${split.id}`, split)).status).toBe(200);
  });

  it('only lets a split carry an existing transaction id', async () => {
    const res = await call('POST', '/transactions', { ...blank, externalId: 'made-up' });
    expect(res.status).toBe(422);
    expect(res.body.issues[0].path).toEqual(['externalId']);
  });

  it('never changes the transaction id or the import time', async () => {
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    expect((await call('PATCH', `/transactions/${row.id}`, { externalId: 'b' })).status).toBe(422);
    expect((await call('PATCH', `/transactions/${row.id}`, { addedAt: row.addedAt })).status).toBe(422);
    expect((await call('PATCH', `/transactions/${row.id}`, {})).status).toBe(422);
  });

  it('refuses unknown accounts and categories, and a future import time', async () => {
    const id = crypto.randomUUID();
    expect((await call('POST', '/transactions', { ...blank, accountId: id })).status).toBe(422);
    expect((await call('POST', '/transactions', { ...blank, categoryId: id })).status).toBe(422);
    expect((await call('POST', '/transactions', { ...blank, addedAt: '2999-01-01T00:00:00Z' })).status).toBe(422);
    expect((await call('PATCH', `/transactions/${id}`, { amount: 1 })).status).toBe(404);
    expect((await call('PATCH', '/transactions/not-an-id', { amount: 1 })).status).toBe(404);
  });
});

describe('accounts', () => {
  it('creates and renames, with unique names', async () => {
    const cash = (await call('POST', '/accounts', { name: ' Cash ' })).body as Account;
    expect(cash).toMatchObject({ name: 'Cash', importKey: null });
    expect((await call('POST', '/accounts', { name: 'cash' })).status).toBe(409);
    await call('POST', '/accounts', { name: 'Wallet' });
    expect((await call('PATCH', `/accounts/${cash.id}`, { name: 'WALLET' })).status).toBe(409);
    expect((await call('PATCH', `/accounts/${cash.id}`, { name: 'Purse' })).body.name).toBe('Purse');
  });

  it('deletes only an account without transactions', async () => {
    await call('POST', '/transactions/import', [pushed('a', { account: 'Bank' })]);
    const [bank] = (await call('GET', '/accounts')).body as Account[];
    expect((await call('DELETE', `/accounts/${bank.id}`)).status).toBe(409);
    const cash = (await call('POST', '/accounts', { name: 'Cash' })).body as Account;
    expect((await call('DELETE', `/accounts/${cash.id}`)).status).toBe(204);
  });
});

describe('categories', () => {
  it("starts with the seed file's tree", async () => {
    expect((await tree()).categories.map((c) => c.name)).toContain('Groceries');
  });

  it('seeds transactions into their accounts and categories, added when they happened; a later import skips their bank ids', async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const seeded = createService(db);
    seeded.seed(readSeed(EXAMPLE_SEED));
    const rows = seeded.listTransactions();
    expect(rows).toHaveLength(4);
    expect(rows.filter((t) => t.categoryId)).toHaveLength(3);
    expect(rows.filter((t) => t.addedAt !== t.occurredAt)).toEqual([]);
    expect(
      seeded
        .listAccounts()
        .map((a) => a.name)
        .sort(),
    ).toEqual(['Cash', 'Northmere Bank']);
    const again = seeded.importTransactions([
      { ...pushed('lhv-2026-0001'), occurredAt: '2026-09-28T06:12:00Z' as Timestamp },
    ]);
    expect(again).toMatchObject({ added: 0, skipped: ['lhv-2026-0001'] });
  });

  it('keeps an emptied tree empty', async () => {
    expect((await call('PUT', '/categories', { groups: [], categories: [], moveTo: {} })).status).toBe(204);
    expect(await tree()).toEqual({ groups: [], categories: [] });
  });

  it('saves the whole tree and moves transactions of deleted categories', async () => {
    const t = await tree();
    const groceries = t.categories.find((c) => c.name === 'Groceries')!;
    const eatingOut = t.categories.find((c) => c.name === 'Eating out')!;
    await call('POST', '/transactions/import', [pushed('a')]);
    const [row] = await transactions();
    await call('PATCH', `/transactions/${row.id}`, { categoryId: groceries.id });
    await call('PATCH', '/preferences', { hiddenCategoryIds: [groceries.id] });
    const res = await call('PUT', '/categories', {
      groups: t.groups,
      categories: t.categories
        .filter((c) => c.id !== groceries.id)
        .map((c) => (c.id === eatingOut.id ? { ...c, name: 'Restaurants' } : c)),
      moveTo: { [groceries.id]: eatingOut.id },
    });
    expect(res.status).toBe(204);
    expect((await transactions())[0].categoryId).toBe(eatingOut.id);
    expect((await tree()).categories.find((c) => c.id === eatingOut.id)?.name).toBe('Restaurants');
    expect((await call('GET', '/preferences')).body.hiddenCategoryIds).toEqual([]);
  });

  it('rejects a tree with repeated names or missing groups', async () => {
    const t = await tree();
    const [a, b] = t.categories;
    const renamed = t.categories.map((c) => (c.id === b.id ? { ...c, name: a.name.toUpperCase() } : c));
    expect((await call('PUT', '/categories', { ...t, categories: renamed, moveTo: {} })).status).toBe(422);
    expect((await call('PUT', '/categories', { groups: [], categories: t.categories, moveTo: {} })).status).toBe(422);
    expect((await tree()).categories).toHaveLength(t.categories.length);
  });

  it('rejects moving transactions to a deleted category, or from one that is kept', async () => {
    const t = await tree();
    const [first, second] = t.categories;
    const res = await call('PUT', '/categories', {
      ...t,
      categories: t.categories.slice(1),
      moveTo: { [second.id]: first.id },
    });
    expect(res.status).toBe(422);
  });
});

describe('preferences', () => {
  it('stores changes and refuses unknown categories', async () => {
    expect((await call('PATCH', '/preferences', { overviewPeriod: 'all' })).status).toBe(204);
    expect((await call('GET', '/preferences')).body).toMatchObject({
      overviewPeriod: 'all',
      transactionSort: 'addedAt',
    });
    expect((await call('PATCH', '/preferences', { hiddenCategoryIds: [crypto.randomUUID()] })).status).toBe(422);
    expect((await call('PATCH', '/preferences', { theme: 'dark' })).status).toBe(422);
  });

  it('falls back to the default for one stored setting that no longer fits, keeping the others', async () => {
    await call('PATCH', '/preferences', { overviewPeriod: 'all' });
    const t = await tree();
    await call('PATCH', '/preferences', { hiddenCategoryIds: [t.categories[0].id] });
    await call('PUT', '/categories', { ...t, moveTo: {} });
    expect((await call('GET', '/preferences')).body).toMatchObject({ overviewPeriod: 'all' });
  });
});
