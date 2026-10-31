import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { monthKey } from '../../../shared/time';
import type { CategoryGroupId, CategoryId, TransactionId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { FindButton } from '../../components/FindButton';
import { FindDialog } from '../../components/FindDialog';
import { PageHeader } from '../../components/PageHeader';
import { type Cell, cellFromId, cellId, type SelectHow } from '../../components/selection';
import { useDragSelect } from '../../components/useDragSelect';
import { colMove, rowMove } from '../../keys/keys';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import { useModShortcut, useWindowKeyDown } from '../../keys/useWindowKeyDown';
import { countHidden, rowCategoryIds, toggleHidden } from '../../model/hiddenCategories';
import { sortedTree } from '../../model/lookup';
import { buildPivot, categoryRowKey } from '../../model/pivot';
import { plural } from '../../model/plural';
import { toggled } from '../../model/sets';
import { isValid } from '../../model/validity';
import { setPreferences } from '../../store/settings';
import { useStore } from '../../store/store';
import { CategoryFilter } from './CategoryFilter';
import s from './OverviewPage.module.css';
import { nextPeriod, PeriodPicker } from './PeriodPicker';
import { PivotTable } from './PivotTable';
import { panelContent } from './panelContent';
import { TransactionsPanel } from './TransactionsPanel';
import toolButton from './toolButton.module.css';
import { useKeepPivotCellInView } from './useKeepPivotCellInView';
import { usePivotCursor } from './usePivotCursor';

export function OverviewPage() {
  const navigate = useNavigate();
  const transactions = useStore((st) => st.transactions);
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);
  const lookup = useStore((st) => st.lookup);
  const period = useStore((st) => st.preferences.overviewPeriod);
  const hiddenIds = useStore((st) => st.preferences.hiddenCategoryIds);

  const [showHidden, setShowHidden] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<CategoryGroupId>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  /** The transaction picked in Find: the side panel starts on it while its cell is active. */
  const [found, setFound] = useState<{ id: TransactionId; cell: Cell } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRepeatGuard();

  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  // opening balances are never part of the overview, so they cannot be shown or hidden either
  const filterTree = useMemo(
    () => sortedTree(groups, categories).filter((x) => x.group.kind !== 'opening'),
    [groups, categories],
  );
  const hiddenCount = countHidden(hiddenIds, lookup);
  const pivot = useMemo(
    () => buildPivot({ transactions, groups, categories, period, hidden, showHidden, collapsed }),
    [transactions, groups, categories, period, hidden, showHidden, collapsed],
  );
  const { months } = pivot;
  const cols = useMemo(() => [...months.map((m) => m.key), 'total'], [months]);
  const navRows = pivot.rows.filter((r) => r.kind !== 'section');
  const keys = navRows.map((r) => r.key);

  const { active, activeRow, activeCol, selected, moveTo, jumpTo } = usePivotCursor(keys, cols, lookup);
  const range = months.length ? `${months[months.length - 1].mid} – ${months[0].mid}` : 'No data yet';
  const selectedKey = [...selected].join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedKey stands for selected
  const content = useMemo(() => panelContent(selected, pivot, range), [selectedKey, pivot, range]);

  const focusTable = useCallback(() => tableRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    focusTable();
  }, [focusTable]);

  useKeepPivotCellInView(scrollRef, { activeRow, activeCol, period, collapsed });

  const openTransaction = (id: TransactionId) => navigate(`/transactions?focus=${id}`);

  const select = (cell: Cell, how: SelectHow) => {
    moveTo(cell, how);
    focusTable();
  };

  // dragging from a cell selects the cells passed over, as Shift+click would
  const dragSelect = useDragSelect(
    scrollRef,
    (el) => el.dataset.cell ?? null,
    (id) => moveTo(cellFromId(id), 'extend'),
  );

  const toggleGroup = (id: CategoryGroupId) => {
    setCollapsed((current) => toggled(current, id));
    focusTable();
  };

  const setAllCollapsed = (closed: boolean) => {
    setCollapsed(closed ? new Set(groups.map((g) => g.id)) : new Set());
    focusTable();
  };

  const setHidden = (ids: CategoryId[]) => {
    setPreferences({ hiddenCategoryIds: ids });
    if (!ids.length) setShowHidden(false);
  };
  const toggleCategoriesHidden = (ids: CategoryId[]) => setHidden(toggleHidden(hiddenIds, ids));

  /** X or the eye button: hides the category or group, or shows it again. */
  const hideRow = (index: number) => {
    const row = navRows[index];
    if (!row || (row.kind !== 'parent' && row.kind !== 'child')) return;
    const ids = rowCategoryIds(row, categories);
    const willHide = !ids.every((id) => hidden.has(id));
    const gone = new Set([row.key, ...ids.map(categoryRowKey)]);
    // a cursor on a row that goes moves on to the next row that stays
    if (willHide && !showHidden && active && gone.has(active.key)) {
      const stays = (key: string) => !gone.has(key);
      const next = keys.slice(index + 1).find(stays) ?? keys.slice(0, index).reverse().find(stays);
      if (next) moveTo({ key: next, col: active.col }, 'only');
    }
    toggleCategoriesHidden(ids);
  };

  /**
   * Find on this page: selects the transaction's category and month and highlights it in the side panel, showing
   * all months, a hidden category or a collapsed group when needed. One the table can't show (not complete yet, or
   * an opening balance) opens on the Transactions page.
   */
  const showFound = (id: TransactionId) => {
    setFindOpen(false);
    const t = transactions.find((x) => x.id === id);
    if (!t || !isValid(t) || lookup.groupOf(t.categoryId)?.kind === 'opening') return openTransaction(id);
    // the table counts it, so only the period leaves it out
    if (!pivot.transactions.some((x) => x.id === id)) setPreferences({ overviewPeriod: 'all' });
    if (hidden.has(t.categoryId!)) setShowHidden(true);
    const group = lookup.groupOf(t.categoryId);
    if (group && collapsed.has(group.id)) toggleGroup(group.id);
    const cell = { key: categoryRowKey(t.categoryId!), col: monthKey(t.occurredAt!) };
    jumpTo(cell);
    setFound({ id, cell });
    requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
  };

  const cyclePeriod = () => setPreferences({ overviewPeriod: nextPeriod(period) });

  function onTableKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const row = rowMove(e, activeRow, keys.length);
    const col = row == null ? colMove(e, activeCol, cols.length) : null;
    if (row != null || col != null) {
      e.preventDefault();
      // ⌘Home / ⌘End go to the first / last cell
      const toCol = row != null && e.key === 'Home' ? 0 : row != null && e.key === 'End' ? cols.length - 1 : col;
      moveTo({ key: keys[row ?? activeRow], col: cols[toCol ?? activeCol] }, e.shiftKey ? 'extend' : 'only');
      repeatGuard.moved();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
    } else if (e.key === ' ') {
      e.preventDefault();
      const groupId = navRows[activeRow]?.groupId;
      if (groupId) toggleGroup(groupId);
    } else if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      hideRow(activeRow);
    }
  }

  // P, H, F, E and C work wherever focus is on the page, except while typing
  useWindowKeyDown((e) => {
    const target = e.target as HTMLElement;
    const typing =
      target.isContentEditable ||
      target.tagName === 'TEXTAREA' ||
      (target.tagName === 'INPUT' && target.getAttribute('type') !== 'checkbox');
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing) return;
    const key = e.key.toLowerCase();
    if (!['p', 'h', 'f', 'e', 'c'].includes(key)) return;
    e.preventDefault();
    // P and H can change the active cell; the list then starts over, so the keys go back to the table first
    if (listRef.current?.contains(document.activeElement)) focusTable();
    if (key === 'p') cyclePeriod();
    else if (key === 'h') {
      if (hiddenCount) setShowHidden((shown) => !shown);
    } else if (key === 'e') setAllCollapsed(false);
    else if (key === 'c') setAllCollapsed(true);
    else setFilterOpen(true);
  });

  // ⌘K finds a transaction from anywhere on the page, as on Transactions
  useModShortcut('k', () => {
    setFilterOpen(false);
    setFindOpen(true);
  });

  const subtitle =
    range + (hiddenCount && !showHidden ? ` · ${plural(hiddenCount, 'category', 'categories')} hidden` : '');
  const startId = found && selectedKey === cellId(found.cell) ? found.id : undefined;
  const emptyText = !keys.length
    ? pivot.transactions.length
      ? 'All categories with transactions are hidden'
      : 'No transactions in this period'
    : 'No cells selected';

  return (
    <div className={s.root}>
      <PageHeader title="Overview" />
      <main className={cx('page', s.main)}>
        <p className="subtitle">{subtitle}</p>

        <div className={s.controls}>
          <PeriodPicker
            period={period}
            onPick={(overviewPeriod) => {
              setPreferences({ overviewPeriod });
              focusTable();
            }}
          />
          <div className={s.tools}>
            <FindButton className={toolButton.toolButton} onClick={() => setFindOpen(true)} />
            <CategoryFilter
              open={filterOpen}
              onOpen={() => setFilterOpen(true)}
              onCancel={() => {
                setFilterOpen(false);
                focusTable();
              }}
              onDismiss={() => setFilterOpen(false)}
              tree={filterTree}
              hidden={hidden}
              onToggle={toggleCategoriesHidden}
              onShowAll={() => setHidden([])}
            />
            <button
              type="button"
              className={cx(toolButton.toolButton, showHidden && toolButton.on)}
              aria-pressed={showHidden}
              disabled={!hiddenCount}
              onClick={() => {
                setShowHidden((shown) => !shown);
                focusTable();
              }}
            >
              <span className={toolButton.switch} aria-hidden="true" />
              Show hidden
              <span className="kbd">H</span>
            </button>
            <button
              type="button"
              className={toolButton.toolButton}
              onClick={() => setAllCollapsed(false)}
              aria-keyshortcuts="E"
            >
              Expand all <span className="kbd">E</span>
            </button>
            <button
              type="button"
              className={toolButton.toolButton}
              onClick={() => setAllCollapsed(true)}
              aria-keyshortcuts="C"
            >
              Collapse all <span className="kbd">C</span>
            </button>
          </div>
        </div>

        <div className={s.body}>
          <div className={s.pivotScroll} ref={scrollRef}>
            <PivotTable
              pivot={pivot}
              cols={cols}
              keys={keys}
              activeRow={activeRow}
              activeCol={activeCol}
              selected={selected}
              tableRef={tableRef}
              onKeyDown={onTableKey}
              onSelect={(key, col, how) => {
                select({ key, col }, how);
                dragSelect(cellId({ key, col }));
              }}
              onToggleGroup={toggleGroup}
              onToggleHidden={(key) => {
                hideRow(keys.indexOf(key));
                focusTable();
              }}
            />
          </div>
          <TransactionsPanel
            // a new selection starts the list's cursor on top
            key={`${selectedKey}|${startId ?? ''}`}
            startId={startId}
            content={content}
            emptyText={emptyText}
            lookup={lookup}
            listRef={listRef}
            onOpen={(t) => openTransaction(t.id)}
            onLeave={focusTable}
          />
        </div>
      </main>
      {findOpen && (
        <FindDialog
          rows={transactions}
          lookup={lookup}
          onClose={() => {
            setFindOpen(false);
            focusTable();
          }}
          onPick={showFound}
        />
      )}
    </div>
  );
}
