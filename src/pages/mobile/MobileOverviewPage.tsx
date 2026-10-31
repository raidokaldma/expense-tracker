import { useMemo } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { cellId } from '../../components/selection';
import { formatAmount } from '../../model/money';
import { buildPivot, type PivotRowKind } from '../../model/pivot';
import { plural } from '../../model/plural';
import { pad2, toLocal } from '../../model/time';
import type { CategoryGroupId, CategoryId } from '../../model/types';
import { setPreferences, useStore } from '../../store/store';
import { panelContent } from '../overview/panelContent';
import { MobileHeader } from './MobileHeader';
import s from './mobile.module.css';
import { setMobileView, useMobileView } from './mobileView';

const NONE = new Set<CategoryGroupId>();

/**
 * One month of the Overview table: groups expand on tap, a category shows its transactions below it. Edit shows hidden
 * categories, dimmed, and an eye on each row to hide or show it.
 */
export function MobileOverviewPage() {
  const transactions = useStore((st) => st.transactions);
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);
  const lookup = useStore((st) => st.lookup);
  const hiddenIds = useStore((st) => st.preferences.hiddenCategoryIds);

  const monthKey = useMobileView((v) => v.monthKey);
  const open = useMobileView((v) => v.openGroups);
  const openCategory = useMobileView((v) => v.openCategory);
  const editing = useMobileView((v) => v.editing);

  const pivot = useMemo(
    () =>
      buildPivot({
        transactions,
        groups,
        categories,
        period: 'all',
        hidden: new Set(hiddenIds),
        showHidden: editing,
        collapsed: NONE,
      }),
    [transactions, groups, categories, hiddenIds, editing],
  );
  // opening balances are never part of the overview, so they don't count as hidden either
  const hiddenCount = hiddenIds.filter(
    (id) => lookup.categories.has(id) && lookup.groupOf(id)?.kind !== 'opening',
  ).length;
  // newest first
  const { months } = pivot;
  const m = Math.max(
    0,
    months.findIndex((x) => x.key === monthKey),
  );
  const month = months[m];
  const items = useMemo(
    () =>
      month && openCategory
        ? (panelContent(new Set([cellId({ key: openCategory, col: month.key })]), pivot, '')?.items ?? [])
        : [],
    [pivot, month, openCategory],
  );

  const goTo = (i: number) => {
    setMobileView({ monthKey: months[i].key, openCategory: null });
  };
  /** Hides the row's categories, or shows them again when all of them are hidden. */
  const toggleHidden = (kind: PivotRowKind, key: string, groupId?: CategoryGroupId) => {
    const ids =
      kind === 'parent'
        ? categories.filter((c) => c.groupId === groupId).map((c) => c.id)
        : [key.slice(2) as CategoryId];
    const allHidden = ids.every((id) => hiddenIds.includes(id));
    setPreferences({
      hiddenCategoryIds: allHidden ? hiddenIds.filter((id) => !ids.includes(id)) : [...new Set([...hiddenIds, ...ids])],
    });
  };
  const toggleGroup = (key: string) =>
    setMobileView(({ openGroups: current }) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { openGroups: next };
    });

  if (!month)
    return (
      <>
        <MobileHeader />
        <p className={s.none}>No transactions yet.</p>
      </>
    );

  const amount = (n: number, count: number) =>
    count ? <span className={cx('mono', n > 0 && 'pos')}>{formatAmount(n)}</span> : <span className="mono">–</span>;

  return (
    <>
      <MobileHeader />
      <main className={s.main}>
        <div className={s.monthbar}>
          <button
            type="button"
            aria-label="Previous month"
            disabled={m === months.length - 1}
            onClick={() => goTo(m + 1)}
          >
            <Icon name="caret" size={20} weight={2.2} />
          </button>
          <h2>{month.long}</h2>
          <button type="button" aria-label="Next month" disabled={m === 0} onClick={() => goTo(m - 1)}>
            <Icon name="caret" size={20} weight={2.2} />
          </button>
        </div>
        <div className={s.hiddenbar}>
          <span>{hiddenCount > 0 && `${plural(hiddenCount, 'category', 'categories')} hidden`}</span>
          <button type="button" aria-pressed={editing} onClick={() => setMobileView({ editing: !editing })}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className={cx(s.table, editing && s.editing)}>
          {pivot.rows.map((row) => {
            const value = row.values[m];
            const count = row.counts[m];
            if (row.kind === 'section')
              return (
                <div key={row.label} className={s.sec}>
                  {row.label}
                </div>
              );
            if (row.kind === 'total' || row.kind === 'net')
              return (
                <div key={row.key} className={cx(s.row, s[row.kind])}>
                  <span>{row.label}</span>
                  {amount(value, count)}
                </div>
              );
            if (!count) return null;
            const eye = editing && (
              <button
                type="button"
                className={cx(s.eye, row.hidden && s.on)}
                aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
                onClick={() => toggleHidden(row.kind, row.key, row.groupId)}
              >
                <Icon name={row.hidden ? 'hidden' : 'eye'} size={18} />
              </button>
            );
            if (row.kind === 'parent') {
              const isOpen = open.has(row.key);
              return (
                <div key={row.key} className={cx(s.split, s.parent, row.hidden && s.hid)}>
                  <button type="button" className={s.row} onClick={() => toggleGroup(row.key)}>
                    <span className={s.label}>
                      <span className={cx(s.caret, !isOpen && s.closed)}>
                        <Icon name="caret" weight={2.2} />
                      </span>
                      {row.label}
                    </span>
                    {amount(value, count)}
                  </button>
                  {eye}
                </div>
              );
            }
            if (!open.has(`g:${row.groupId}`)) return null;
            const showing = openCategory === row.key;
            return (
              <div key={row.key}>
                <div className={cx(s.split, s.child, showing && s.on, row.hidden && s.hid)}>
                  <button
                    type="button"
                    className={s.row}
                    aria-expanded={showing}
                    onClick={() => setMobileView({ openCategory: showing ? null : row.key })}
                  >
                    <span>{row.label}</span>
                    {amount(value, count)}
                  </button>
                  {eye}
                </div>
                {showing && (
                  <ul className={s.cat}>
                    {items.map((t) => (
                      <li key={t.id}>
                        <div className={s.line}>
                          <span className={s.name}>{t.counterparty}</span>
                          <span className={cx('mono', t.amount! > 0 && 'pos')}>{formatAmount(t.amount!)}</span>
                        </div>
                        {t.description && <div className={s.desc}>{t.description}</div>}
                        <div className={s.meta}>
                          {shortDate(t.occurredAt!)} · {lookup.accountName(t.accountId)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

/** "20.10 14:30" */
function shortDate(ts: Parameters<typeof toLocal>[0]) {
  const p = toLocal(ts);
  return `${pad2(p.d)}.${pad2(p.mo)} ${pad2(p.h)}:${pad2(p.mi)}`;
}
