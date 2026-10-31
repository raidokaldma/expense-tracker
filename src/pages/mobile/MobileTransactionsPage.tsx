import { useMemo } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { formatAmount } from '../../model/money';
import { SEARCH_LIMIT, searchTransactions } from '../../model/search';
import { formatTimestamp } from '../../model/time';
import { useStore } from '../../store/store';
import { MobileHeader } from './MobileHeader';
import s from './mobile.module.css';
import { setMobileView, useMobileView } from './mobileView';

/** Read-only search over all transactions, with the same matching as Find (⌘K). */
export function MobileTransactionsPage() {
  const transactions = useStore((st) => st.transactions);
  const lookup = useStore((st) => st.lookup);
  const q = useMobileView((v) => v.query);
  const results = useMemo(() => searchTransactions(transactions, q, lookup), [transactions, q, lookup]);

  return (
    <>
      <MobileHeader />
      <main className={s.main}>
        <label className={s.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Recipient, category, amount, date…"
            aria-label="Find a transaction"
            value={q}
            onChange={(e) => setMobileView({ query: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <ul className={s.list}>
          {results.map((t) => (
            <li key={t.id} className={s.item}>
              <div className={s.line}>
                <span className={s.name}>{t.counterparty || '(no recipient)'}</span>
                <span className={cx('mono', t.amount != null && t.amount > 0 && 'pos')}>
                  {t.amount == null ? '—' : formatAmount(t.amount)}
                </span>
              </div>
              {t.description && <div className={s.desc}>{t.description}</div>}
              <div className={s.meta}>
                {[
                  t.occurredAt && formatTimestamp(t.occurredAt),
                  lookup.categoryName(t.categoryId) || 'No category',
                  lookup.accountName(t.accountId),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </li>
          ))}
        </ul>
        {results.length === 0 && <p className={s.none}>No matching transactions.</p>}
        {results.length === SEARCH_LIMIT && <p className={s.none}>First {SEARCH_LIMIT} shown</p>}
      </main>
    </>
  );
}
