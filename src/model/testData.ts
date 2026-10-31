import type { Account, Category, CategoryGroup, Transaction } from './types';

let n = 0;
export const id = <T extends string>() => `id-${++n}` as T;

export function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: id(),
    externalId: null,
    accountId: 'acc-1' as Account['id'],
    occurredAt: '2026-10-10T10:00:00Z' as Transaction['addedAt'],
    counterparty: 'Green Basket',
    amount: -1000,
    categoryId: 'cat-food' as Category['id'],
    description: null,
    addedAt: '2026-10-10T10:00:00Z' as Transaction['addedAt'],
    updatedAt: '2026-10-10T10:00:00Z' as Transaction['addedAt'],
    ...over,
  };
}

export const accounts: Account[] = [{ id: 'acc-1' as Account['id'], name: 'Main account', importKey: 'Main account' }];

export const groups: CategoryGroup[] = [
  { id: 'g-inc' as CategoryGroup['id'], name: 'Earnings', kind: 'income', order: 0 },
  { id: 'g-food' as CategoryGroup['id'], name: 'Food', kind: 'expense', order: 0 },
  { id: 'g-tr' as CategoryGroup['id'], name: 'Transfers', kind: 'transfer', order: 0 },
];

export const categories: Category[] = [
  { id: 'cat-salary' as Category['id'], groupId: groups[0].id, name: 'Salary', order: 0 },
  { id: 'cat-food' as Category['id'], groupId: groups[1].id, name: 'Groceries', order: 0 },
  { id: 'cat-tr' as Category['id'], groupId: groups[2].id, name: 'Transfer', order: 0 },
];
