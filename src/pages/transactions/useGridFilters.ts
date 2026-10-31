import { useState } from 'react';
import type { TransactionId } from '../../../shared/types';
import { COLS, type ColKey, type Filters } from './columns';

/** The column filters and "needs attention" toggle; rows edited while filtered stay visible until they change. */
export function useGridFilters() {
  const [filters, setFilters] = useState<Filters>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [pinned, setPinned] = useState<ReadonlySet<TransactionId>>(new Set());

  const pin = (id: TransactionId) => setPinned((p) => (p.has(id) ? p : new Set(p).add(id)));
  const unpinAll = () => setPinned(new Set());

  return {
    filters,
    onlyMissing,
    pinned,
    pin,
    anyFilter: onlyMissing || COLS.some((x) => (filters[x.key] || '').trim()),

    setFilter(key: ColKey, value: string) {
      setFilters((f) => ({ ...f, [key]: value }));
      unpinAll();
    },

    clearFilter: (key: ColKey) => setFilters((f) => ({ ...f, [key]: '' })),

    toggleOnlyMissing() {
      setOnlyMissing((on) => !on);
      unpinAll();
    },

    clearAll({ keepOnlyMissing = false } = {}) {
      setFilters({});
      if (!keepOnlyMissing) setOnlyMissing(false);
      unpinAll();
    },
  };
}
