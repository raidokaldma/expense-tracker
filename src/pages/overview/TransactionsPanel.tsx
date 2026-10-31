import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { keepInView } from '../../components/scroll';
import { RepeatGuard, rowMove } from '../../keys/keys';
import type { Lookup } from '../../model/lookup';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import { pad2, toLocal } from '../../model/time';
import type { Transaction, TransactionId } from '../../model/types';
import s from './overview.module.css';
import type { PanelContent } from './panelContent';

interface Props {
  /** The selected cells' transactions, or null when no cell is selected. */
  content: PanelContent | null;
  /** Shown instead when `content` is null. */
  emptyText: string;
  lookup: Lookup;
  listRef: RefObject<HTMLDivElement | null>;
  onOpen: (t: Transaction) => void;
  /** Esc or ← in the list: back to the table. */
  onLeave: () => void;
  /** The transaction the list's cursor starts on (one picked in Find), instead of the top one. */
  startId?: TransactionId;
}

/**
 * The transactions behind the selected cells, with their count and sum. Enter in the table moves into the list,
 * where ↑ ↓ choose and Enter opens the transaction on the Transactions page. Give it a key per selection (and
 * `startId`) so its cursor starts over.
 */
export function TransactionsPanel({ content, emptyText, lookup, listRef, onOpen, onLeave, startId }: Props) {
  const [inList, setInList] = useState(false);
  const repeatGuard = useRef(new RepeatGuard()).current;

  const items = content?.items ?? [];
  const [cursor, setCursor] = useState(() =>
    Math.max(
      0,
      items.findIndex((t) => t.id === startId),
    ),
  );
  const index = Math.min(cursor, Math.max(0, items.length - 1));
  const total = items.reduce((sum, t) => sum + t.amount!, 0);

  // keeps the active transaction inside the list's scroll area
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after these values have been drawn
  useLayoutEffect(() => {
    keepInView(listRef.current, listRef.current?.querySelector(`.${s.ditem}.${s.active}`));
  }, [index, inList]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const next = rowMove(e, index, items.length, true);
    if (next != null) {
      e.preventDefault();
      setCursor(next);
      repeatGuard.moved();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[index]) onOpen(items[index]);
    } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onLeave();
    }
  }

  if (!content)
    return (
      <aside className={s.drill} aria-label="Transactions in the selected cell">
        <div className={s.dempty}>
          <Icon name="table" size={22} weight={1.8} />
          <div className={s.dtitle}>{emptyText}</div>
        </div>
      </aside>
    );

  return (
    <aside className={s.drill} aria-label="Transactions in the selected cell">
      <div className={s.dhead}>
        <div className={s.dtitle}>{content.title}</div>
        <div className={s.dsub}>{content.subtitle}</div>
      </div>
      <div
        className={s.dlist}
        role="listbox"
        aria-label="Transactions in this cell"
        tabIndex={0}
        aria-activedescendant={inList && items[index] ? `d-${items[index].id}` : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => setInList(true)}
        onBlur={() => setInList(false)}
        ref={listRef}
      >
        {items.map((t, i) => {
          const active = inList && i === index;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the list handles Enter for the active item
            <div
              key={t.id}
              id={`d-${t.id}`}
              className={cx(s.ditem, active && s.active)}
              role="option"
              aria-selected={active}
              onClick={() => onOpen(t)}
            >
              <span className={cx('mono', s.dd)}>{shortDate(t, content.showYear)}</span>
              <span className={s.dp}>
                <span>{t.counterparty}</span>
                {t.description && <span className={s.ddesc}>{t.description}</span>}
                <span className={s.da}>
                  {lookup.accountName(t.accountId)}
                  {content.showCategory ? ` · ${lookup.categoryName(t.categoryId)}` : ''}
                </span>
              </span>
              <span className={cx('mono', t.amount! > 0 && 'pos')}>{formatAmount(t.amount!)}</span>
            </div>
          );
        })}
        {items.length === 0 && <p className={s.dnone}>No transactions in this cell.</p>}
      </div>
      <div className={s.dfoot}>
        <span>{plural(items.length, 'transaction')}</span>
        <span className="mono">{formatAmount(total)}</span>
      </div>
    </aside>
  );
}

/** "20.10 14:30", with the year ("20.10.26 14:30") when the list spans months. */
function shortDate(t: Transaction, withYear: boolean) {
  const p = toLocal(t.occurredAt!);
  const year = withYear ? `.${String(p.y).slice(2)}` : '';
  return `${pad2(p.d)}.${pad2(p.mo)}${year} ${pad2(p.h)}:${pad2(p.mi)}`;
}
