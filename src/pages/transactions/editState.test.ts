import { describe, expect, it } from 'vitest';
import { tx } from '../../model/testData';
import { COLS, draftToNew } from './columns';
import { initialEdit } from './editState';

const column = (key: string) => COLS.find((c) => c.key === key)!;
const row = tx({ occurredAt: '2026-10-20T11:30:00Z' as ReturnType<typeof tx>['occurredAt'] });

describe('opening the editor', () => {
  it('starts on the cell value, all selected, or on the typed character', () => {
    const opened = initialEdit({ column: column('counterparty'), row, cellText: 'Rimi', options: [], opensUp: false });
    expect(opened).toMatchObject({ text: 'Rimi', touched: false, selectAll: true, highlighted: -1 });
    const typed = initialEdit({
      column: column('counterparty'),
      row,
      cellText: 'Rimi',
      typed: 'x',
      options: [],
      opensUp: false,
    });
    expect(typed).toMatchObject({ text: 'x', touched: true, selectAll: false });
  });

  it('opens a date on today with t, the time kept', () => {
    const opened = initialEdit({
      column: column('occurredAt'),
      row,
      cellText: '',
      typed: 't',
      options: [],
      opensUp: false,
    });
    expect(opened.text).toMatch(/^\d{2}\.\d{2}\.\d{4} 14:30$/);
    expect(opened.typingDate).toBe(false);
  });

  it('starts an empty category on the top suggestion', () => {
    const options = [{ value: 'Groceries', label: 'Groceries', confidence: 0.6 }];
    const opened = initialEdit({ column: column('categoryId'), row, cellText: '', options, opensUp: false });
    expect(opened.highlighted).toBe(0);
  });
});

describe('the draft row', () => {
  it('becomes a new transaction with the value just entered, at the current time when none was given', () => {
    const created = draftToNew({ counterparty: 'Market' }, 'amount', -900);
    expect(created).toMatchObject({ externalId: null, counterparty: 'Market', amount: -900, categoryId: null });
    expect(created.occurredAt).toMatch(/Z$/);
  });
});
