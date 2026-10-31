import { describe, expect, it } from 'vitest';
import { amountCloseness, hint, suggestCategories } from './suggest';
import { tx } from './testData';
import type { AccountId, CategoryId } from './types';

const cat = (id: string) => id as CategoryId;
const bank = 'acc-bank' as AccountId;
const card = 'acc-card' as AccountId;

describe('category suggestions', () => {
  it('counts the same amount fully, a near one partly, and money in vs out not at all', () => {
    expect(amountCloseness(-65000, -65000)).toBe(1);
    expect(amountCloseness(-1000, -900)).toBeCloseTo(0.5);
    expect(amountCloseness(-1000, -700)).toBe(0);
    expect(amountCloseness(-1000, 1000)).toBe(0);
  });

  it('ranks hints: account + recipient + amount, account + recipient, recipient, first word', () => {
    const row = tx({ accountId: bank, counterparty: 'Landlord', amount: -65000 });
    expect(hint(row, tx({ accountId: bank, counterparty: ' landlord ', amount: -65000 }))).toEqual({
      kind: 'sameAccountAndRecipient',
      weight: 2,
    });
    expect(hint(row, tx({ accountId: bank, counterparty: 'Landlord', amount: -10000 }))).toEqual({
      kind: 'sameAccountAndRecipient',
      weight: 1,
    });
    expect(hint(row, tx({ accountId: card, counterparty: 'Landlord' }))?.kind).toBe('sameRecipient');
    const shop = tx({ counterparty: 'Green Basket Market' });
    expect(hint(shop, tx({ counterparty: 'GREEN BASKET 0423' }))?.kind).toBe('sameFirstWord');
    expect(hint(shop, tx({ counterparty: 'Evergreen' }))).toBeNull();
    // short or numeric first words say nothing
    expect(hint(tx({ counterparty: 'AS Rimi' }), tx({ counterparty: 'AS Other' }))).toBeNull();
  });

  it('suggests rent for the monthly rent row with high confidence', () => {
    const rents = Array.from({ length: 6 }, () =>
      tx({ accountId: bank, counterparty: 'Landlord', amount: -65000, categoryId: cat('rent') }),
    );
    const deposit = tx({ accountId: bank, counterparty: 'Landlord', amount: -130000, categoryId: cat('deposit') });
    const [top, second] = suggestCategories(
      tx({ accountId: bank, counterparty: 'Landlord', amount: -65000, categoryId: null }),
      [...rents, deposit],
    );
    expect(top).toMatchObject({ categoryId: 'rent', level: 'high' });
    expect(second).toBeUndefined(); // the deposit's share is under the minimum
  });

  it('never lets many weak hints outvote a strong one', () => {
    const exact = tx({ accountId: bank, counterparty: 'Green Basket Market', amount: -2000, categoryId: cat('gifts') });
    const sameWord = Array.from({ length: 30 }, () =>
      tx({ counterparty: 'Green Basket Express', categoryId: cat('groceries') }),
    );
    const [top] = suggestCategories(
      tx({ accountId: bank, counterparty: 'Green Basket Market', amount: -2000, categoryId: null }),
      [exact, ...sameWord],
    );
    expect(top.categoryId).toBe('gifts');
  });

  it('keeps first-word hints at medium at most, and suggests nothing without a recipient', () => {
    const sameWord = Array.from({ length: 30 }, () =>
      tx({ counterparty: 'Green Basket Express', categoryId: cat('groceries') }),
    );
    const [top] = suggestCategories(tx({ counterparty: 'Green Basket Market', categoryId: null }), sameWord);
    expect(top).toMatchObject({ categoryId: 'groceries', confidence: 0.6, level: 'med' });
    expect(suggestCategories(tx({ counterparty: null, categoryId: null }), sameWord)).toEqual([]);
  });
});
