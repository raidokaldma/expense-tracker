import { useMemo } from 'react';
import { cx } from '../../components/cx';
import { formatAmount } from '../../model/money';
import { useStore } from '../../store/store';
import s from './transactions.module.css';

/** One card per account with its total, plus "All accounts"; clicking a card filters the grid to it. */
export function AccountCards({ selected, onPick }: { selected: string; onPick: (name: string) => void }) {
  const transactions = useStore((st) => st.transactions);
  const accounts = useStore((st) => st.accounts);

  const totals = useMemo(() => {
    const sums = new Map<string, number>();
    for (const t of transactions)
      if (t.accountId && t.amount != null) sums.set(t.accountId, (sums.get(t.accountId) || 0) + t.amount);
    return [...accounts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ account: a, total: sums.get(a.id) || 0 }));
  }, [transactions, accounts]);

  if (!accounts.length) return null;
  const allTotal = totals.reduce((sum, x) => sum + x.total, 0);
  const card = (key: string, name: string, total: number, on: boolean, filterTo: string, title: string) => (
    <button
      key={key}
      type="button"
      className={cx(s.acct, on && s.on)}
      aria-pressed={on}
      onClick={() => onPick(filterTo)}
      title={title}
    >
      <span className={s.aname}>{name}</span>
      <span className={cx(s.atotal, total > 0 && 'pos')}>{formatAmount(total)}</span>
    </button>
  );

  return (
    <div className={s.accts} role="group" aria-label="Account totals">
      {totals.map(({ account, total }) => {
        const on = selected.toLowerCase() === account.name.toLowerCase();
        // clicking the selected card again shows all accounts
        return card(account.id, account.name, total, on, on ? '' : account.name, 'Show only this account in the grid');
      })}
      {card('all', 'All accounts', allTotal, !selected, '', 'Show all accounts in the grid')}
    </div>
  );
}
