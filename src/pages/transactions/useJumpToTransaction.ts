import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { TransactionId } from '../../model/types';
import { showToast, useStore } from '../../store/store';

/** How long a row jumped to stays highlighted. */
const FLASH_MS = 2600;

/**
 * Jumping to a transaction, from Find or from an Overview link (#/transactions?focus=<id>): `showRow` makes the
 * row visible and puts the cursor on it; the row then flashes briefly.
 */
export function useJumpToTransaction(showRow: (id: TransactionId) => void) {
  const [flashId, setFlashId] = useState<TransactionId | null>(null);
  const latestShowRow = useRef(showRow);
  latestShowRow.current = showRow;

  const jumpTo = useCallback((id: TransactionId) => {
    if (!useStore.getState().transactions.some((t) => t.id === id)) {
      showToast('That transaction no longer exists', { warn: true });
      return;
    }
    latestShowRow.current(id);
    setFlashId(id);
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), FLASH_MS);
  }, []);

  const [params, setParams] = useSearchParams();
  const focusParam = params.get('focus');
  useEffect(() => {
    if (!focusParam) return;
    jumpTo(focusParam as TransactionId);
    setParams({}, { replace: true });
  }, [focusParam, jumpTo, setParams]);

  return { flashId, jumpTo };
}
