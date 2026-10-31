import { formatShort } from '../../../shared/time';
import type { Transaction } from '../../../shared/types';
import { cx } from '../../components/cx';
import type { Lookup } from '../../model/lookup';
import { formatAmount } from '../../model/money';
import mobile from './mobile.module.css';

/** The transactions of the opened category in the shown month. */
export function CategoryTransactions({ items, lookup }: { items: Transaction[]; lookup: Lookup }) {
  return (
    <ul className={mobile.categoryTransactions}>
      {items.map((t) => (
        <li key={t.id}>
          <div className={mobile.line}>
            <span className={mobile.name}>{t.counterparty}</span>
            <span className={cx('mono', t.amount! > 0 && 'pos')}>{formatAmount(t.amount!)}</span>
          </div>
          {t.description && <div className={mobile.desc}>{t.description}</div>}
          <div className={mobile.meta}>
            {formatShort(t.occurredAt!)} · {lookup.accountName(t.accountId)}
          </div>
        </li>
      ))}
    </ul>
  );
}
