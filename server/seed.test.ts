import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_SEED, readSeed } from './seed.ts';

const seedFile = (content: unknown) => {
  const file = join(mkdtempSync(join(tmpdir(), 'seed-')), 'seed.json');
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
};

describe('seed file', () => {
  it('reads the example into a tree, ordered as written', () => {
    const { tree } = readSeed(EXAMPLE_SEED);
    const earnings = tree.groups.find((g) => g.name === 'Earnings')!;
    expect(tree.categories.filter((c) => c.groupId === earnings.id).map((c) => [c.name, c.order])).toEqual([
      ['Salary', 0],
      ['Other income', 1],
    ]);
  });

  it('reads transactions like an import, with an optional bank id and a category from the file', () => {
    const { tree, transactions } = readSeed(EXAMPLE_SEED);
    const rent = tree.categories.find((c) => c.name === 'Rent')!;
    expect(transactions[1]).toMatchObject({
      externalId: 'lhv-2026-0002',
      occurredAt: '2026-10-01T05:00:00Z',
      categoryId: rent.id,
    });
    expect(transactions[3]).toMatchObject({ externalId: null, categoryId: null });
  });

  it('refuses transactions with an unknown category or a bad field', () => {
    const groups = [{ name: 'Food', kind: 'expense', categories: ['Groceries'] }];
    const row = { account: 'Cash', occurredAt: '2026-10-01T10:00:00Z', counterparty: 'Green Basket', amount: -100 };
    expect(() => readSeed(seedFile({ groups, transactions: [{ ...row, category: 'Fuel' }] }))).toThrow(/no category/);
    expect(() => readSeed(seedFile({ groups, transactions: [{ ...row, amount: 1.5 }] }))).toThrow(/amount/);
    expect(readSeed(seedFile({ groups, transactions: [{ ...row, category: 'groceries' }] })).transactions).toHaveLength(
      1,
    );
  });

  it('lets split rows share a bank id', () => {
    const groups = [{ name: 'Food', kind: 'expense', categories: ['Groceries'] }];
    const row = { externalId: 'x', account: 'Cash', occurredAt: '2026-10-01T10:00:00Z', counterparty: 'Green Basket' };
    const split = [
      { ...row, amount: -100 },
      { ...row, amount: -50 },
    ];
    expect(readSeed(seedFile({ groups, transactions: split })).transactions).toHaveLength(2);
  });

  it('refuses a file that is broken, has unknown fields or repeats a name', () => {
    expect(() => readSeed(seedFile('{'))).toThrow(/Seed file/);
    expect(() => readSeed(seedFile({ groups: [{ name: 'A', kind: 'expense', categories: [], icon: 1 }] }))).toThrow();
    const twice = { groups: [{ name: 'Food', kind: 'expense', categories: ['food'] }] };
    expect(() => readSeed(seedFile(twice))).toThrow(/used twice/);
  });
});
