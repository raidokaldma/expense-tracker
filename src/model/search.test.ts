import { describe, expect, it } from 'vitest';
import type { Timestamp } from '../../shared/types';
import { makeLookup } from './lookup';
import { searchTransactions } from './search';
import { accounts, categories, groups, tx } from './testData';

const lookup = makeLookup(accounts, groups, categories);
const rows = [
  tx({ counterparty: 'Green Basket Market', amount: -3562 }),
  tx({ counterparty: 'Supper Courier', amount: -2740, occurredAt: '2026-10-15T09:00:00Z' as Timestamp }),
  tx({ counterparty: 'Employer', amount: 285000, description: 'salary' }),
];

describe('searchTransactions', () => {
  it('needs every word to match', () => {
    expect(searchTransactions(rows, 'basket main', lookup).map((r) => r.counterparty)).toEqual(['Green Basket Market']);
    expect(searchTransactions(rows, 'rimi wolt', lookup)).toEqual([]);
  });

  it('matches amounts with a comma or dot, and compares with > and <', () => {
    expect(searchTransactions(rows, '35,62', lookup)).toHaveLength(1);
    expect(searchTransactions(rows, '>1000', lookup).map((r) => r.counterparty)).toEqual(['Employer']);
    expect(searchTransactions(rows, '<-30', lookup).map((r) => r.counterparty)).toEqual(['Green Basket Market']);
    expect(searchTransactions(rows, '>=2850', lookup).map((r) => r.counterparty)).toEqual(['Employer']);
  });

  it("matches the bank's transaction id", () => {
    const split = [
      tx({ counterparty: 'A', externalId: 'bank-123' }),
      tx({ counterparty: 'B', externalId: 'bank-123' }),
    ];
    expect(searchTransactions([...rows, ...split], 'bank-123', lookup)).toHaveLength(2);
  });

  it('matches dates in Tallinn format', () => {
    expect(searchTransactions(rows, '15.10', lookup).map((r) => r.counterparty)).toEqual(['Supper Courier']);
  });

  it('ranks recipient matches first, or goes by transaction date when asked for the newest', () => {
    const market = [
      tx({ counterparty: 'Market', occurredAt: '2026-10-01T09:00:00Z' as Timestamp }),
      tx({ counterparty: 'Corner', description: 'market', occurredAt: '2026-10-20T09:00:00Z' as Timestamp }),
    ];
    const names = (order?: 'newest') => searchTransactions(market, 'market', lookup, order).map((r) => r.counterparty);
    expect(names()).toEqual(['Market', 'Corner']);
    expect(names('newest')).toEqual(['Corner', 'Market']);
  });
});
