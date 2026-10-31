import { describe, expect, it } from 'vitest';
import { nearbySuffixCategory, suffixes } from './nearbySuffix';
import { suggestCategories } from './suggest';
import { tx } from './testData';
import type { CategoryId } from './types';

const cat = (id: string) => id as CategoryId;
const day = (d: number) => `2026-08-${String(d).padStart(2, '0')}T12:00:00Z` as never;

describe('nearby recipient endings', () => {
  it('lists the comma-separated endings, longest first', () => {
    expect(suffixes('Crest Of Edinburgh,  Edinburgh, GB')).toEqual(['edinburgh, gb', 'gb']);
    expect(suffixes('Landlord')).toEqual([]);
  });

  it('suggests the category of a place visited the same week', () => {
    const row = tx({ counterparty: 'Scottish Experience, Edinburgh, GB', occurredAt: day(10), categoryId: null });
    const crest = tx({ counterparty: 'Crest Of Edinburgh, Edinburgh, GB', occurredAt: day(12), categoryId: cat('uk') });
    expect(suggestCategories(row, [crest])).toEqual([{ categoryId: 'uk', confidence: 0.4, level: 'med' }]);
  });

  it('falls back to a shorter ending, and ignores rows more than a week away', () => {
    const row = tx({ counterparty: 'Castle Cafe, Edinburgh, GB', occurredAt: day(10), categoryId: null });
    const london = tx({ counterparty: 'Tube, London, GB', occurredAt: day(16), categoryId: cat('uk') });
    const later = tx({ counterparty: 'Old Pub, Edinburgh, GB', occurredAt: day(18), categoryId: cat('food') });
    expect(nearbySuffixCategory(row, [london, later])).toEqual({ categoryId: 'uk', score: 1, total: 1 });
  });

  it('says nothing when the nearby rows with that ending have mixed categories', () => {
    const home = ['groceries', 'fuel', 'groceries', 'cafe', 'health'].map((c, i) =>
      tx({ counterparty: `Shop ${i}, Tallinn, EE`, occurredAt: day(8 + i), categoryId: cat(c) }),
    );
    const row = tx({ counterparty: 'Rimi, Tallinn, EE', occurredAt: day(10), categoryId: null });
    expect(suggestCategories(row, home)).toEqual([]);
  });

  it('only steps in when there is no stronger hint', () => {
    const row = tx({ counterparty: 'Crest Of Edinburgh, Edinburgh, GB', occurredAt: day(10), categoryId: null });
    const same = tx({
      counterparty: 'Crest Of Edinburgh, Edinburgh, GB',
      occurredAt: day(1),
      categoryId: cat('hotel'),
    });
    const near = tx({ counterparty: 'Tour, Edinburgh, GB', occurredAt: day(11), categoryId: cat('uk') });
    expect(suggestCategories(row, [same, near])[0].categoryId).toBe('hotel');
  });
});
