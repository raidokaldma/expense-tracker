import { useMemo } from 'react';
import type { CategoryGroupId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { cellId } from '../../components/selection';
import { countHidden, rowCategoryIds, toggleHidden } from '../../model/hiddenCategories';
import { buildPivot, groupRowKey, type PivotRow } from '../../model/pivot';
import { plural } from '../../model/plural';
import { toggled } from '../../model/sets';
import { setPreferences } from '../../store/settings';
import { useStore } from '../../store/store';
import { panelContent } from '../overview/panelContent';
import { CategoryTransactions } from './CategoryTransactions';
import { EyeButton } from './EyeButton';
import { MobileAmount } from './MobileAmount';
import { MobileHeader } from './MobileHeader';
import s from './MobileOverviewPage.module.css';
import { MonthBar } from './MonthBar';
import mobile from './mobile.module.css';
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
  const openGroups = useMobileView((v) => v.openGroups);
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
  const hiddenCount = countHidden(hiddenIds, lookup);
  // newest first
  const { months } = pivot;
  const monthIndex = Math.max(
    0,
    months.findIndex((x) => x.key === monthKey),
  );
  const month = months[monthIndex];
  const items = useMemo(
    () =>
      month && openCategory
        ? (panelContent(new Set([cellId({ key: openCategory, col: month.key })]), pivot, '')?.items ?? [])
        : [],
    [pivot, month, openCategory],
  );

  const goTo = (index: number) => () => setMobileView({ monthKey: months[index].key, openCategory: null });
  const toggleRowHidden = (row: PivotRow) =>
    setPreferences({ hiddenCategoryIds: toggleHidden(hiddenIds, rowCategoryIds(row, categories)) });
  const toggleGroup = (key: string) =>
    setMobileView(({ openGroups: current }) => ({ openGroups: toggled(current, key) }));

  if (!month)
    return (
      <>
        <MobileHeader />
        <p className={mobile.none}>No transactions yet.</p>
      </>
    );

  function renderRow(row: PivotRow) {
    const value = row.values[monthIndex];
    const count = row.counts[monthIndex];
    if (row.kind === 'section')
      return (
        <div key={row.label} className={s.section}>
          {row.label}
        </div>
      );
    if (row.kind === 'total' || row.kind === 'net')
      return (
        <div key={row.key} className={cx(s.row, s[row.kind])}>
          <span>{row.label}</span>
          <MobileAmount value={value} count={count} />
        </div>
      );
    if (!count) return null;
    const eye = editing && <EyeButton row={row} onClick={() => toggleRowHidden(row)} />;
    if (row.kind === 'parent') {
      const isOpen = openGroups.has(row.key);
      return (
        <div key={row.key} className={cx(s.split, s.parent, row.hidden && s.dimmed)}>
          <button type="button" className={s.row} onClick={() => toggleGroup(row.key)}>
            <span className={s.label}>
              <span className={cx(s.caret, !isOpen && s.closed)}>
                <Icon name="caret" weight={2.2} />
              </span>
              {row.label}
            </span>
            <MobileAmount value={value} count={count} />
          </button>
          {eye}
        </div>
      );
    }
    if (row.groupId && !openGroups.has(groupRowKey(row.groupId))) return null;
    const showing = openCategory === row.key;
    return (
      <div key={row.key}>
        <div className={cx(s.split, s.child, showing && s.open, row.hidden && s.dimmed)}>
          <button
            type="button"
            className={s.row}
            aria-expanded={showing}
            onClick={() => setMobileView({ openCategory: showing ? null : row.key })}
          >
            <span>{row.label}</span>
            <MobileAmount value={value} count={count} />
          </button>
          {eye}
        </div>
        {showing && <CategoryTransactions items={items} lookup={lookup} />}
      </div>
    );
  }

  return (
    <>
      <MobileHeader />
      <main className={mobile.main}>
        <MonthBar
          title={month.long}
          onPrevious={monthIndex < months.length - 1 ? goTo(monthIndex + 1) : null}
          onNext={monthIndex > 0 ? goTo(monthIndex - 1) : null}
        />
        <div className={s.hiddenbar}>
          <span>{hiddenCount > 0 && `${plural(hiddenCount, 'category', 'categories')} hidden`}</span>
          <button type="button" aria-pressed={editing} onClick={() => setMobileView({ editing: !editing })}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className={cx(s.table, editing && s.editing)}>{pivot.rows.map(renderRow)}</div>
      </main>
    </>
  );
}
