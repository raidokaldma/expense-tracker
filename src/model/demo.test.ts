import { describe, expect, it } from 'vitest';
import { demoData } from './demo';
import type { Category, CategoryGroupId, CategoryId } from './types';

const names = ['Salary', 'Other income', 'Rent', 'Utilities', 'Phone & internet', 'Groceries', 'Eating out'];
const categories = [...names, 'Transport', 'Fuel', 'Shopping', 'Entertainment', 'Subscriptions', 'Gifts', 'Health']
  .concat(['Travel', 'Transfer'])
  .map((name, order): Category => ({ id: `c${order}` as CategoryId, groupId: 'g' as CategoryGroupId, name, order }));

describe('demo data', () => {
  const { accounts, transactions } = demoData({ groups: [], categories });
  const total = (name: string) => {
    const id = accounts.find((a) => a.name === name)!.id;
    return transactions.filter((t) => t.accountId === id).reduce((sum, t) => sum + t.amount!, 0);
  };

  it('has 8,725 rows in two banks, cash and a credit card', () => {
    expect(transactions).toHaveLength(8725);
    expect(accounts.map((a) => a.name).sort()).toEqual(['Ambervale Bank', 'Cash', 'Credit card', 'Northmere Bank']);
  });

  it('ends with believable balances', () => {
    for (const name of ['Ambervale Bank', 'Cash', 'Northmere Bank']) {
      expect(total(name)).toBeGreaterThanOrEqual(0);
      expect(total(name)).toBeLessThanOrEqual(10_000_00);
    }
    expect(total('Credit card')).toBeLessThanOrEqual(0);
    expect(total('Credit card')).toBeGreaterThanOrEqual(-10_000_00);
  });
});
