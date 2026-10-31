import { useEffect, useMemo, useRef, useState } from 'react';
import type { Transaction, TransactionId } from '../../model/types';
import { setPreferences } from '../../store/store';
import { insertAfter, type SortBy, sortIds, withMissing } from './rowOrder';

/**
 * The grid's display order, a stored list of ids: editing a row never moves it; only toggling the sort re-orders.
 * New rows and imports go on top; a split goes below its original (and any earlier splits of it).
 */
export function useRowOrder(transactions: Transaction[], sortBy: SortBy) {
  const [order, setOrder] = useState<TransactionId[]>(() => sortIds(transactions, sortBy));
  const splitsOf = useRef(new Map<TransactionId, TransactionId[]>());

  const fullOrder = useMemo(() => withMissing(order, transactions, sortBy), [order, transactions, sortBy]);
  // keep the stored order complete, so later splits find their neighbours
  useEffect(() => {
    if (fullOrder !== order) setOrder(fullOrder);
  }, [fullOrder, order]);

  const toggleSort = () => {
    const by = sortBy === 'addedAt' ? 'occurredAt' : 'addedAt';
    setPreferences({ transactionSort: by });
    setOrder(sortIds(transactions, by));
  };

  const placeSplit = (sourceId: TransactionId, splitId: TransactionId) => {
    const earlier = splitsOf.current.get(sourceId) ?? [];
    splitsOf.current.set(sourceId, [...earlier, splitId]);
    setOrder((current) => insertAfter(current, earlier.at(-1) ?? sourceId, splitId));
  };

  return { order: fullOrder, toggleSort, placeSplit };
}
