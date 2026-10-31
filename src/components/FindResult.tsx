import type { MouseEvent } from 'react';
import { formatTimestamp } from '../../shared/time';
import type { Transaction } from '../../shared/types';
import type { Lookup } from '../model/lookup';
import { formatAmount } from '../model/money';
import { cx } from './cx';
import s from './FindResult.module.css';

interface Props {
  transaction: Transaction;
  lookup: Lookup;
  highlighted: boolean;
  onPick: () => void;
  onMouseMove: (e: MouseEvent) => void;
}

export function FindResult({ transaction: t, lookup, highlighted, onPick, onMouseMove }: Props) {
  const meta = [lookup.accountName(t.accountId), lookup.categoryName(t.categoryId) || 'No category', t.description];
  return (
    <div
      className={cx(s.result, highlighted && s.highlighted)}
      id={`j-${t.id}`}
      role="option"
      aria-selected={highlighted}
      onMouseDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      onMouseMove={onMouseMove}
    >
      <span className={s.resultDate}>{t.occurredAt ? formatTimestamp(t.occurredAt) : '—'}</span>
      <span className={s.resultMain}>
        <span>{t.counterparty || '(no recipient)'}</span>
        <span className={s.resultMeta}>{meta.filter(Boolean).join(' · ')}</span>
      </span>
      <span className={cx(s.resultAmount, t.amount != null && t.amount > 0 && 'pos')}>
        {t.amount == null ? '—' : formatAmount(t.amount)}
      </span>
    </div>
  );
}
