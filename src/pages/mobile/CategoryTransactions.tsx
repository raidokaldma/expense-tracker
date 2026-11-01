import { formatShort } from '../../../shared/time';
import type { Transaction } from '../../../shared/types';
import { cx } from '../../components/cx';
import type { Lookup } from '../../model/lookup';
import { formatAmount } from '../../model/money';
import { newestFirst } from '../../model/search';
import mobile from './mobile.module.css';
import { TransactionItem } from './TransactionItem';

/** The transactions of the opened category in the shown month, the newest first. */
export function CategoryTransactions({ items, lookup }: { items: Transaction[]; lookup: Lookup }) {
  return (
    <ul className={mobile.categoryTransactions}>
      {items.toSorted(newestFirst).map((t) => (
        <TransactionItem key={t.id} transaction={t}>
          <span className={mobile.line}>
            <span className={mobile.name}>{t.counterparty}</span>
            <span className={cx('mono', t.amount! > 0 && 'pos')}>{formatAmount(t.amount!)}</span>
          </span>
          {t.description && <span className={mobile.desc}>{t.description}</span>}
          <span className={mobile.meta}>
            {formatShort(t.occurredAt!)} · {lookup.accountName(t.accountId)}
          </span>
        </TransactionItem>
      ))}
    </ul>
  );
}
