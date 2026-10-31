import { describe, expect, it, vi } from 'vitest';
import { buildPivot, periodMonths } from './pivot';
import { categories, groups, tx } from './testData';
import type { Category, Timestamp } from './types';

const run = (transactions: ReturnType<typeof tx>[]) =>
  buildPivot({
    transactions,
    groups,
    categories,
    period: 'all',
    hidden: new Set(),
    showHidden: false,
    collapsed: new Set(),
  });

describe('buildPivot', () => {
  it('shows transfers in their own block but leaves them out of Net; invalid rows are left out', () => {
    const p = run([
      tx({ amount: -1000 }),
      tx({ amount: -500, categoryId: null }),
      tx({ amount: -700, categoryId: 'cat-tr' as Category['id'] }),
      tx({ amount: 300000, categoryId: 'cat-salary' as Category['id'] }),
    ]);
    expect(p.rows.map((r) => r.label)).toEqual([
      'Income',
      'Earnings',
      'Salary',
      'Total income',
      'Expenses',
      'Food',
      'Groceries',
      'Total expenses',
      'Transfers',
      'Transfers',
      'Transfer',
      'Total transfers',
      'Net',
    ]);
    expect(p.rows.find((r) => r.key === 't:transfer')?.values.at(-1)).toBe(-700);
    expect(p.rows.find((r) => r.key === 'net')?.values.at(-1)).toBe(300000 - 1000);
  });

  it('leaves opening balances out of every row, the months and the transactions', () => {
    const opening = {
      id: 'g-open' as Category['groupId'],
      name: 'Opening balances',
      kind: 'opening',
      order: 0,
    } as const;
    const start = { id: 'cat-open' as Category['id'], groupId: opening.id, name: 'Opening balance', order: 0 };
    const balance = tx({ amount: 464255, categoryId: start.id, occurredAt: '2022-12-31T21:59:00Z' as Timestamp });
    const p = buildPivot({
      transactions: [tx(), balance],
      groups: [...groups, opening],
      categories: [...categories, start],
      period: 'all',
      hidden: new Set(),
      showHidden: false,
      collapsed: new Set(),
    });
    expect(p.rows.map((r) => r.label)).toEqual(['Expenses', 'Food', 'Groceries', 'Total expenses', 'Net']);
    expect(p.months.at(-1)?.key).toBe('2026-10');
    expect(p.transactions).not.toContain(balance);
  });

  it('leaves out a block whose categories are all hidden', () => {
    const p = buildPivot({
      transactions: [tx(), tx({ amount: 300000, categoryId: 'cat-salary' as Category['id'] })],
      groups,
      categories,
      period: 'all',
      hidden: new Set(['cat-salary' as Category['id']]),
      showHidden: false,
      collapsed: new Set(),
    });
    expect(p.rows.map((r) => r.label)).toEqual(['Expenses', 'Food', 'Groceries', 'Total expenses', 'Net']);
  });

  it('leaves out categories, groups and blocks without transactions in the period', () => {
    const p = run([tx()]);
    expect(p.rows.map((r) => r.label)).toEqual(['Expenses', 'Food', 'Groceries', 'Total expenses', 'Net']);
  });

  it('keeps a category whose transactions cancel out, telling a sum of 0 from no transactions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    const p = run([
      tx({ amount: -1000, occurredAt: '2026-10-05T10:00:00Z' as Timestamp }),
      tx({ amount: 1000, occurredAt: '2026-10-06T10:00:00Z' as Timestamp }),
      tx({ amount: -500, occurredAt: '2026-08-05T10:00:00Z' as Timestamp }),
    ]);
    const groceries = p.rows.find((r) => r.label === 'Groceries');
    expect(p.months.map((m) => m.key)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(groceries?.values).toEqual([0, 0, -500, -500]);
    expect(groceries?.counts).toEqual([2, 0, 1, 3]);
    vi.useRealTimers();
  });

  it('counts calendar months, empty ones included', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    expect(periodMonths('last3', ['2026-01', '2026-05', '2026-10'])).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(periodMonths('all', ['2026-07'])).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(periodMonths('all', [])).toEqual([]);
    vi.useRealTimers();
  });

  it('runs months newest first, bucketed in Tallinn time', () => {
    const p = run([
      tx({ occurredAt: '2026-09-30T22:30:00Z' as Timestamp }),
      tx({ occurredAt: '2026-09-15T10:00:00Z' as Timestamp }),
    ]);
    expect(p.months.map((m) => m.key).slice(-2)).toEqual(['2026-10', '2026-09']);
  });
});
