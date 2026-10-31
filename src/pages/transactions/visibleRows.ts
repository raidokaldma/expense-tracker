import type { Lookup } from '../../model/lookup';
import { amountMatches } from '../../model/money';
import type { NewTransaction, Transaction, TransactionId } from '../../model/types';
import { isValid } from '../../model/validity';
import { COLS, displayText, draftRow, type Filters } from './columns';

/** A line of the grid: the new-transaction row on top, then the transactions that pass the filters. */
export interface VisibleRow {
  transaction: Transaction;
  /** The new-transaction row on top. */
  draft: boolean;
  /** Row number; counts down so the bottom row is 1. */
  number: number;
}

interface VisibleRowsInput {
  transactions: Transaction[];
  /** Display order, every transaction included (see withMissing). */
  order: TransactionId[];
  filters: Filters;
  /** Only rows missing a required field. */
  onlyMissing: boolean;
  /** Rows that stay visible whatever the filters (edited while filtered). */
  pinned: ReadonlySet<TransactionId>;
  /** What has been typed into the new-transaction row. */
  draft: Partial<NewTransaction>;
  lookup: Lookup;
}

/** The grid's rows: the new-transaction row, then the transactions that pass the filters, in display order. */
export function visibleRows({ transactions, order, filters, onlyMissing, pinned, draft, lookup }: VisibleRowsInput) {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const queries = COLS.map((column) => ({ key: column.key, query: (filters[column.key] || '').trim() })).filter(
    (f) => f.query,
  );
  const matches = (t: Transaction) =>
    (!onlyMissing || !isValid(t)) &&
    queries.every(({ key, query }) =>
      key === 'amount'
        ? amountMatches(t.amount, query)
        : displayText(t, key, lookup).toLowerCase().includes(query.toLowerCase()),
    );

  const rows: VisibleRow[] = [{ transaction: draftRow(draft), draft: true, number: 0 }];
  let number = order.filter((id) => byId.has(id)).length;
  for (const id of order) {
    const transaction = byId.get(id);
    if (!transaction) continue;
    if (pinned.has(id) || matches(transaction)) rows.push({ transaction, draft: false, number });
    number--;
  }
  return rows;
}
