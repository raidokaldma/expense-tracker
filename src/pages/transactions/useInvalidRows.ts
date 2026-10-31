import { useEffect, useMemo, useRef } from 'react';
import type { Transaction } from '../../../shared/types';
import { isValid } from '../../model/validity';
import { showToast } from '../../store/toast';
import type { VisibleRow } from './visibleRows';

/** Rows needing attention, and how many of them the filters keep out of the list. */
export function useInvalidRows(transactions: Transaction[], visible: VisibleRow[], onlyMissing: boolean) {
  const invalid = useMemo(() => transactions.filter((t) => !isValid(t)), [transactions]);

  const countBefore = useRef(invalid.length);
  useEffect(() => {
    if (countBefore.current > 0 && invalid.length === 0) showToast('All rows fixed');
    countBefore.current = invalid.length;
  }, [invalid.length]);

  const hiddenInvalid = onlyMissing
    ? invalid.length - visible.filter((v) => !v.draft && !isValid(v.transaction)).length
    : 0;
  return { invalid, hiddenInvalid };
}
