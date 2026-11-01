import { type ReactNode, useState } from 'react';
import type { Transaction } from '../../../shared/types';
import { cx } from '../../components/cx';
import { CategoryPicker } from './CategoryPicker';
import s from './TransactionItem.module.css';

/** A list row that opens on tap to change the category, so a stray tap while scrolling changes nothing. */
export function TransactionItem({ transaction, children }: { transaction: Transaction; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cx(open && s.open)}>
      <button type="button" className={s.summary} aria-expanded={open} onClick={() => setOpen(!open)}>
        {children}
      </button>
      {open && <CategoryPicker transaction={transaction} />}
    </li>
  );
}
