import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Transaction, TransactionId } from '../../shared/types';
import { isMod, rowMove } from '../keys/keys';
import { useRepeatGuard } from '../keys/useRepeatGuard';
import type { Lookup } from '../model/lookup';
import { searchTransactions } from '../model/search';
import s from './FindDialog.module.css';
import { FindResult } from './FindResult';
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
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const guard = useRepeatGuard();
  const pointer = useRef('');
  const results = useMemo(() => searchTransactions(rows, query, lookup), [rows, query, lookup]);
  const highlighted = Math.min(active, Math.max(0, results.length - 1));

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  // keeps the highlighted result inside the list
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after the highlight has moved
  useLayoutEffect(() => {
    keepInView(listRef.current, listRef.current?.querySelector('[aria-selected="true"]'), 4);
  }, [highlighted]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) onPick(results[highlighted].id);
      return;
    }
    if (isMod(e) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      return;
    }
    // same moves as the grid; plain Home / End stay with the text box
    const next = rowMove(e, highlighted, results.length);
    if (next == null) return;
    e.preventDefault();
    if (guard.blocks(e)) return;
    setActive(next);
    guard.moved();
  };

  return (
    <div className={s.backdrop} onMouseDown={onClose}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Find a transaction"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.input}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Recipient, category, account, description, amount or date"
            aria-label="Find a transaction"
            role="combobox"
            aria-expanded="true"
            aria-controls="jlist"
            aria-activedescendant={results[highlighted] ? `j-${results[highlighted].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            onKeyDown={onKey}
            onBlur={() => setTimeout(() => document.activeElement !== inputRef.current && onClose(), 0)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className={s.results} id="jlist" role="listbox" aria-label="Matching transactions" ref={listRef}>
          {results.map((t, index) => (
            <FindResult
              key={t.id}
              transaction={t}
              lookup={lookup}
              highlighted={index === highlighted}
              onPick={() => onPick(t.id)}
              onMouseMove={(e) => {
                // only real pointer movement highlights; the list scrolling under a still pointer does not
                const position = `${e.clientX},${e.clientY}`;
                if (position === pointer.current) return;
                pointer.current = position;
                if (index !== highlighted) setActive(index);
              }}
            />
          ))}
          {results.length === 0 && <p className={s.noResults}>No matching transactions.</p>}
        </div>
        <div className={s.help}>
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
