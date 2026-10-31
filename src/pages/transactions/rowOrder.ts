import type { Transaction, TransactionId } from '../../model/types';

export type SortBy = 'addedAt' | 'occurredAt';

/** Newest first by import date or transaction date; rows without the date go last. */
export function sortIds(rows: Transaction[], by: SortBy): TransactionId[] {
  const key = (r: Transaction) => (by === 'occurredAt' ? r.occurredAt : r.addedAt || r.occurredAt) || '';
  return [...rows]
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (!ka !== !kb) return ka ? -1 : 1;
      return kb.localeCompare(ka) || b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id);
    })
    .map((r) => r.id);
}

/** The stored order plus rows it does not know yet (new rows, imports), which go on top. */
export function withMissing(order: TransactionId[], rows: Transaction[], by: SortBy): TransactionId[] {
  const known = new Set(order);
  const missing = rows.filter((t) => !known.has(t.id));
  return missing.length ? [...sortIds(missing, by), ...order] : order;
}

/** Puts `id` right after `after` (moving it if it is already listed), or on top when `after` is not listed. */
export function insertAfter(order: TransactionId[], after: TransactionId, id: TransactionId): TransactionId[] {
  const rest = order.filter((x) => x !== id);
  const i = rest.indexOf(after);
  return i < 0 ? [id, ...rest] : [...rest.slice(0, i + 1), id, ...rest.slice(i + 1)];
}
