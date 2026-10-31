import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { migrate, openDatabase } from '../../server/db';
import { EXAMPLE_SEED, readSeed } from '../../server/seed';
import { createService } from '../../server/service';
import { createHttpApi } from '../api/httpApi';
import type { NewTransaction } from '../model/types';
import {
  createTransaction,
  load,
  refresh,
  reload,
  removeTransactions,
  splitTransaction,
  undo,
  useStore,
} from './store';

/** The real server, in-process, with an in-memory database. */
function connect() {
  const db = openDatabase(':memory:');
  migrate(db);
  const service = createService(db);
  service.seed({ ...readSeed(EXAMPLE_SEED), transactions: [] });
  const app = createApp({ service });
  return createHttpApi(async (url, init) => app.request(url, init));
}

const row = (counterparty: string): NewTransaction => ({
  externalId: null,
  accountId: null,
  occurredAt: null,
  counterparty,
  amount: null,
  categoryId: null,
  description: null,
});

describe('store', () => {
  it('keeps saving after a failed write', async () => {
    const api = connect();
    await load(api);
    const first = await createTransaction(row('A'));
    // a write that fails inside the queue
    const original = api.transactions.remove;
    api.transactions.remove = () => Promise.reject(new Error('disk full'));
    removeTransactions(new Set([first.id]));
    api.transactions.remove = original;
    const second = await createTransaction(row('B'));
    expect((await api.transactions.list()).map((t) => t.id)).toContain(second.id);
  });

  it('deletes several rows as one step', async () => {
    const api = connect();
    await load(api);
    const a = await createTransaction(row('A'));
    const b = await createTransaction(row('B'));
    removeTransactions(new Set([a.id, b.id]));
    expect(useStore.getState().transactions).toEqual([]);
    expect((await undo())?.label).toBe('delete 2 rows');
    expect(
      useStore
        .getState()
        .transactions.map((t) => t.counterparty)
        .sort(),
    ).toEqual(['A', 'B']);
    await reload();
    expect(useStore.getState().transactions.length).toBe(2);
  });

  it('undo waits for a new row that is still being saved', async () => {
    await load(connect());
    const pending = createTransaction(row('C'));
    const step = await undo();
    await pending;
    expect(step?.label).toBe('new row');
    expect(useStore.getState().transactions.some((t) => t.counterparty === 'C')).toBe(false);
  });

  it('refreshing picks up rows imported elsewhere and says how many', async () => {
    const api = connect();
    await load(api);
    const pending = createTransaction(row('Typed here'));
    await api.transactions.import(
      ['a', 'b'].map((externalId) => ({
        externalId,
        account: 'Bank',
        occurredAt: '2026-10-20T10:00:00Z',
        counterparty: 'Green Basket',
        amount: -900,
      })),
    );
    await refresh();
    await pending;
    const s = useStore.getState();
    expect(s.transactions.map((t) => t.counterparty).sort()).toEqual(['Green Basket', 'Green Basket', 'Typed here']);
    expect(s.toast?.text).toBe('2 new transactions');
  });

  it('splits into a row with the same bank id and import time, without amount or category', async () => {
    const api = connect();
    await load(api);
    await api.transactions.import([
      {
        externalId: 'a',
        account: 'Bank',
        occurredAt: '2026-10-20T10:00:00Z',
        counterparty: 'Green Basket',
        amount: -900,
      },
    ]);
    await load(api);
    const [original] = useStore.getState().transactions;
    const part = await splitTransaction(original.id);
    expect(part).toMatchObject({
      externalId: 'a',
      addedAt: original.addedAt,
      counterparty: 'Green Basket',
      amount: null,
    });
    expect(part.id).not.toBe(original.id);
  });
});
