import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isMod, RepeatGuard, rowMove } from '../keys/keys';
import type { Lookup } from '../model/lookup';
import { formatAmount } from '../model/money';
import { searchTransactions } from '../model/search';
import { formatTimestamp } from '../model/time';
import type { Transaction, TransactionId } from '../model/types';
import { cx } from './cx';
import s from './findDialog.module.css';
import { Icon } from './icons';
import { keepInView } from './scroll';

interface Props {
  rows: Transaction[];
  lookup: Lookup;
  onPick: (id: TransactionId) => void;
  onClose: () => void;
}

/** ⌘K quick jump: type any value, Enter goes to the transaction. */
export function FindDialog({ rows, lookup, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const guard = useRef(new RepeatGuard()).current;
  const pointer = useRef('');
  const results = useMemo(() => searchTransactions(rows, q, lookup), [rows, q, lookup]);
  const i = Math.min(active, Math.max(0, results.length - 1));

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  // keeps the highlighted result inside the list
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after the highlight has moved
  useLayoutEffect(() => {
    keepInView(listRef.current, listRef.current?.querySelector('[aria-selected="true"]'), 4);
  }, [i]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results[i]) onPick(results[i].id);
      return;
    }
    if (isMod(e) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      return;
    }
    // same moves as the grid; plain Home / End stay with the text box
    const next = rowMove(e, i, results.length);
    if (next == null) return;
    e.preventDefault();
    if (guard.blocks(e)) return;
    setActive(next);
    guard.moved();
  };

  return (
    <div className={s.jback} onMouseDown={onClose}>
      <div
        className={s.jbox}
        role="dialog"
        aria-modal="true"
        aria-label="Find a transaction"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.jin}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Recipient, category, account, description, amount or date"
            aria-label="Find a transaction"
            role="combobox"
            aria-expanded="true"
            aria-controls="jlist"
            aria-activedescendant={results[i] ? `j-${results[i].id}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            onKeyDown={onKey}
            onBlur={() => setTimeout(() => document.activeElement !== inputRef.current && onClose(), 0)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className={s.jlist} id="jlist" role="listbox" aria-label="Matching transactions" ref={listRef}>
          {results.map((t, k) => (
            <div
              key={t.id}
              className={cx(s.jitem, k === i && s.hi)}
              id={`j-${t.id}`}
              role="option"
              aria-selected={k === i}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(t.id);
              }}
              onMouseMove={(e) => {
                // only real pointer movement highlights; the list scrolling under a still pointer does not
                const p = `${e.clientX},${e.clientY}`;
                if (p === pointer.current) return;
                pointer.current = p;
                if (k !== i) setActive(k);
              }}
            >
              <span className={s.jd}>{t.occurredAt ? formatTimestamp(t.occurredAt) : '—'}</span>
              <span className={s.jmain}>
                <span>{t.counterparty || '(no recipient)'}</span>
                <span className={s.jmeta}>
                  {[lookup.accountName(t.accountId), lookup.categoryName(t.categoryId) || 'No category', t.description]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={cx(s.jamt, t.amount != null && t.amount > 0 && 'pos')}>
                {t.amount == null ? '—' : formatAmount(t.amount)}
              </span>
            </div>
          ))}
          {results.length === 0 && <p className={s.jnone}>No matching transactions.</p>}
        </div>
        <div className={s.jhelp}>
          <span>
            <code>rimi cash</code> all words must match
          </span>
          <span>
            <code>35,62</code> amount
          </span>
          <span>
            <code>&gt;500</code> <code>&lt;-100</code> amount range
          </span>
          <span>
            <code>15.10</code> date
          </span>
        </div>
      </div>
    </div>
  );
}
