import type { VisibleRow } from './visibleRows';

export interface AmountSummary {
  count: number;
  sum: number;
}

/** How many rows there are and what their amounts add up to; the new-transaction row is left out. */
export function amountSummary(rows: VisibleRow[]): AmountSummary {
  const saved = rows.filter((r) => !r.draft);
  return { count: saved.length, sum: saved.reduce((sum, r) => sum + (r.transaction.amount ?? 0), 0) };
}
