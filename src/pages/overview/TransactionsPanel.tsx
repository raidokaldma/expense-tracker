import { type KeyboardEvent, type RefObject, useLayoutEffect, useState } from 'react';
import { formatShort } from '../../../shared/time';
import type { Transaction, TransactionId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { keepInView } from '../../components/scroll';
import { listMove } from '../../keys/keys';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import type { Lookup } from '../../model/lookup';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import type { PanelContent } from './panelContent';
import s from './TransactionsPanel.module.css';

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
  const repeatGuard = useRepeatGuard();

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
    keepInView(listRef.current, listRef.current?.querySelector(`.${s.panelItem}.${s.current}`));
  }, [index, inList]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const next = listMove(e, index, items.length);
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
      <aside className={s.drillPanel} aria-label="Transactions in the selected cell">
        <div className={s.panelEmpty}>
          <Icon name="table" size={22} weight={1.8} />
          <div className={s.panelTitle}>{emptyText}</div>
        </div>
      </aside>
    );

  return (
    <aside className={s.drillPanel} aria-label="Transactions in the selected cell">
      <div className={s.panelHeader}>
        <div className={s.panelTitle}>{content.title}</div>
        <div className={s.panelSubtitle}>{content.subtitle}</div>
      </div>
      <div
        className={s.panelList}
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
              className={cx(s.panelItem, active && s.current)}
              role="option"
              aria-selected={active}
              onClick={() => onOpen(t)}
            >
              <span className={cx('mono', s.itemDate)}>
                {formatShort(t.occurredAt!, { withYear: content.showYear })}
              </span>
              <span className={s.itemPayee}>
                <span>{t.counterparty}</span>
                {t.description && <span className={s.itemDescription}>{t.description}</span>}
                <span className={s.itemMeta}>
                  {lookup.accountName(t.accountId)}
                  {content.showCategory ? ` · ${lookup.categoryName(t.categoryId)}` : ''}
                </span>
              </span>
              <span className={cx('mono', t.amount! > 0 && 'pos')}>{formatAmount(t.amount!)}</span>
            </div>
          );
        })}
        {items.length === 0 && <p className={s.panelNoItems}>No transactions in this cell.</p>}
      </div>
      <div className={s.panelFooter}>
        <span>{plural(items.length, 'transaction')}</span>
        <span className="mono">{formatAmount(total)}</span>
      </div>
    </aside>
  );
}
