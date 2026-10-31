import type { Lookup } from './lookup';
import { amountMatches } from './money';
import { formatLocal, localDateKey, toLocal } from './time';
import type { Transaction } from './types';

export const SEARCH_LIMIT = 50;

const recentFirst = (a: Transaction, b: Transaction) =>
  (b.addedAt || b.occurredAt || '').localeCompare(a.addedAt || a.occurredAt || '');

/**
 * Find (⌘K): every word must match some value, the bank's transaction id included. Numbers also match amounts
 * (12.5, 12,50, -12.50) and dates (15.10, 2026-10-15); >100 and <-50 compare amounts. Recipient matches rank first, then the newest.
 */
export function searchTransactions(rows: Transaction[], query: string, lookup: Lookup): Transaction[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows.slice().sort(recentFirst).slice(0, SEARCH_LIMIT);
  const out: { r: Transaction; score: number }[] = [];
  for (const r of rows) {
    const amt = r.amount == null ? '' : (r.amount / 100).toFixed(2);
    const texts = [
      r.counterparty,
      lookup.categoryName(r.categoryId),
      lookup.accountName(r.accountId),
      r.description,
      r.externalId,
    ].map((x) => (x || '').toLowerCase());
    const local = r.occurredAt ? toLocal(r.occurredAt) : null;
    const dates = local ? [formatLocal(local), localDateKey(local)] : [];
    let score = 0;
    let ok = true;
    for (const w of words) {
      // >500, <=-100 compare amounts, the same way as the Amount column filter
      if (/^[<>]=?-?\d/.test(w)) {
        if (!amountMatches(r.amount, w)) {
          ok = false;
          break;
        }
        continue;
      }
      const num = w.replace(',', '.');
      if (texts[0].startsWith(w)) score += 3;
      else if (texts[0].includes(w)) score += 2;
      else if (texts.some((t) => t.includes(w))) score += 1;
      else if (amt && /^-?\d/.test(num) && (amt.includes(num) || amt.replace('-', '').startsWith(num.replace('-', ''))))
        score += 1;
      else if (dates.some((d) => d.includes(w))) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ r, score });
  }
  out.sort((a, b) => b.score - a.score || recentFirst(a.r, b.r));
  return out.slice(0, SEARCH_LIMIT).map((x) => x.r);
}
