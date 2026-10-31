import { describe, expect, it } from 'vitest';
import { buildPivot } from '../../model/pivot';
import { categories, groups, tx } from '../../model/testData';
import type { Category, Timestamp } from '../../model/types';
import { panelContent } from './panelContent';

const pivot = buildPivot({
  transactions: [
    tx({ amount: -1000, occurredAt: '2026-09-10T10:00:00Z' as Timestamp }),
    tx({ amount: -500, occurredAt: '2026-10-10T10:00:00Z' as Timestamp }),
    tx({ amount: 300000, categoryId: 'cat-salary' as Category['id'], occurredAt: '2026-10-01T10:00:00Z' as Timestamp }),
  ],
  groups,
  categories,
  period: 'all',
  hidden: new Set(),
  showHidden: false,
  collapsed: new Set(),
});
const key = (label: string) => pivot.rows.find((r) => r.label === label)!.key;
const content = (...cells: [string, string][]) =>
  panelContent(new Set(cells.map(([label, col]) => `${key(label)}|${col}`)), pivot, 'Sep 2026 – Oct 2026');

describe('panelContent', () => {
  it('describes one cell by its row and month', () => {
    const c = content(['Groceries', '2026-10']);
    expect(c).toMatchObject({ title: 'Groceries', subtitle: 'October 2026 (to date)', showYear: false });
    expect(c?.items.map((t) => t.amount)).toEqual([-500]);
  });

  it('lists each transaction once when cells overlap', () => {
    const c = content(['Groceries', '2026-10'], ['Food', '2026-10'], ['Groceries', 'total'], ['Salary', '2026-10']);
    expect(c).toMatchObject({ title: '4 cells selected', showCategory: true, showYear: true });
    expect(c?.items.map((t) => t.amount)).toEqual([300000, -1000, -500]);
  });

  it('is null when no cell is selected', () => {
    expect(panelContent(new Set(), pivot, '')).toBe(null);
  });
});
