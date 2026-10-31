import type { CategoryId, Transaction } from './types';

/** How far apart (either way) rows count as nearby: a trip, a week of visiting. */
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** The share of nearby rows that must agree on a category, so a mix ("…, Tallinn, EE" at home) says nothing. */
const MAJORITY = 0.6;

/**
 * The recipient's comma-separated endings, longest first: "Crest Of Edinburgh, Edinburgh, GB" gives
 * "edinburgh, gb" and "gb". None when there is no comma.
 */
export function suffixes(name: string | null) {
  const parts = (name ?? '')
    .toLowerCase()
    .split(',')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return parts.slice(1).map((_, i) => parts.slice(i + 1).join(', '));
}

/**
 * The category most rows within a week of `row` have when their recipient ends the same way, usually a place
 * ("…, Edinburgh, GB"). The longest ending that any nearby row shares decides; when its rows don't mostly agree,
 * there is no suggestion. `score` is the agreeing rows, `total` all nearby rows with that ending.
 */
export function nearbySuffixCategory(row: Transaction, rows: Transaction[]) {
  const at = row.occurredAt ? Date.parse(row.occurredAt) : Number.NaN;
  if (Number.isNaN(at)) return null;
  const nearby = rows.filter(
    (t) => t.categoryId && t.id !== row.id && t.occurredAt && Math.abs(Date.parse(t.occurredAt) - at) <= WINDOW_MS,
  );

  for (const suffix of suffixes(row.counterparty)) {
    const counts = new Map<CategoryId, number>();
    for (const t of nearby) {
      if (suffixes(t.counterparty).includes(suffix)) counts.set(t.categoryId!, (counts.get(t.categoryId!) ?? 0) + 1);
    }
    if (!counts.size) continue;
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const [categoryId, score] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return score / total >= MAJORITY ? { categoryId, score, total } : null;
  }
  return null;
}
