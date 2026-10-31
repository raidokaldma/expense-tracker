import { type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/AppShell';
import { cx } from '../../components/cx';
import { FindDialog } from '../../components/FindDialog';
import { Icon } from '../../components/icons';
import {
  type Cell,
  cellFromId,
  cellId,
  nextSelection,
  type SelectHow,
  type Selection,
  selectedIds,
} from '../../components/selection';
import { useDragSelect } from '../../components/useDragSelect';
import { colMove, isMac, isMod, RepeatGuard, rowMove } from '../../keys/keys';
import { useWindowKeyDown } from '../../keys/useWindowKeyDown';
import { sortedTree } from '../../model/lookup';
import { buildPivot } from '../../model/pivot';
import { plural } from '../../model/plural';
import { monthKey } from '../../model/time';
import type { CategoryGroupId, CategoryId, OverviewPeriod, TransactionId } from '../../model/types';
import { isValid } from '../../model/validity';
import { setPreferences, useStore } from '../../store/store';
import { CategoryFilter } from './CategoryFilter';
import s from './overview.module.css';
import { PivotTable } from './PivotTable';
import { panelContent } from './panelContent';
import { TransactionsPanel } from './TransactionsPanel';

const PERIODS: [OverviewPeriod, string][] = [
  ['last3', 'Last 3 months'],
  ['last12', 'Last 12 months'],
  ['all', 'All'],
];

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
  const [cursor, setCursor] = useState<Cell | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  /** The transaction picked in Find: the side panel starts on it while its cell is active. */
  const [found, setFound] = useState<{ id: TransactionId; cell: Cell } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRef(new RepeatGuard()).current;

  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  // opening balances are never part of the overview, so they cannot be shown or hidden either
  const filterTree = useMemo(
    () => sortedTree(groups, categories).filter((x) => x.group.kind !== 'opening'),
    [groups, categories],
  );
  const hiddenCount = filterTree.flatMap((x) => x.categories).filter((c) => hidden.has(c.id)).length;
  const pivot = useMemo(
    () => buildPivot({ transactions, groups, categories, period, hidden, showHidden, collapsed }),
    [transactions, groups, categories, period, hidden, showHidden, collapsed],
  );
  const { months } = pivot;
  const cols = useMemo(() => [...months.map((m) => m.key), 'total'], [months]);
  const navRows = pivot.rows.filter((r) => r.kind !== 'section');
  const keys = navRows.map((r) => r.key);

  // a cell on a row that disappeared (collapsed, hidden) resolves to its group, else to the first row
  function resolveCell(cell: Cell | null): Cell | null {
    if (!keys.length) return null;
    let key = cell?.key ?? keys[0];
    if (!keys.includes(key) && key.startsWith('c:')) {
      const group = lookup.groupOf(key.slice(2) as CategoryId);
      if (group) key = `g:${group.id}`;
    }
    if (!keys.includes(key)) key = keys[0];
    return { key, col: cell && cols.includes(cell.col) ? cell.col : cols[0] };
  }

  const active = resolveCell(cursor);
  const activeRow = active ? keys.indexOf(active.key) : -1;
  const activeCol = active ? cols.indexOf(active.col) : -1;
  const range = months.length ? `${months[months.length - 1].mid} – ${months[0].mid}` : 'No data yet';
  const selected = active ? selectedIds(selection, active, keys, cols) : new Set<string>();
  const selectedKey = [...selected].join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedKey stands for selected
  const content = useMemo(() => panelContent(selected, pivot, range), [selectedKey, pivot, range]);

  // ---------- focus & scrolling ----------
  const focusTable = useCallback(() => tableRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    focusTable();
  }, [focusTable]);

  // keeps the active cell in view, clear of the sticky month titles, Net row and category column
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after these values have been drawn
  useLayoutEffect(() => {
    const area = scrollRef.current;
    const cell = area?.querySelector(`.${s.pc}.${s.active}`);
    if (!area || !cell) return;
    const box = area.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const header = area.querySelector<HTMLElement>(`.${s.phdr}`);
    const labelWidth = header?.querySelector<HTMLElement>(`.${s.plabel}`)?.offsetWidth ?? 0;
    if (r.left < box.left + labelWidth) area.scrollLeft -= box.left + labelWidth - r.left;
    else if (r.right > box.left + area.clientWidth) area.scrollLeft += r.right - (box.left + area.clientWidth);
    // the Net row is always in view, being the footer
    if (cell.closest(`.${s.net}`)) return;
    const top = box.top + (header?.offsetHeight ?? 0);
    const bottom = box.top + area.clientHeight - (area.querySelector<HTMLElement>(`.${s.net}`)?.offsetHeight ?? 0);
    if (r.top < top) area.scrollTop -= top - r.top;
    else if (r.bottom > bottom) area.scrollTop += r.bottom - bottom;
  }, [activeRow, activeCol, period, collapsed]);

  // ---------- actions ----------
  const openTransaction = (id: TransactionId) => navigate(`/transactions?focus=${id}`);

  /** Makes `cell` the active one; the selection starts over, extends to it or adds / removes it. */
  const moveTo = (cell: Cell, how: SelectHow) => {
    if (active) setSelection(nextSelection(selection, active, cell, how, keys, cols));
    setCursor(cell);
  };

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
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  /** Hides the categories, or shows them again when all of them are hidden. */
  const toggleHidden = (ids: CategoryId[]) => {
    const allHidden = ids.every((id) => hidden.has(id));
    setHidden(allHidden ? hiddenIds.filter((id) => !ids.includes(id)) : [...new Set([...hiddenIds, ...ids])]);
  };

  /** X or the eye button: hides the category or group, or shows it again. */
  const hideRow = (index: number) => {
    const row = navRows[index];
    if (!row || (row.kind !== 'parent' && row.kind !== 'child')) return;
    const ids =
      row.kind === 'parent'
        ? categories.filter((c) => c.groupId === row.groupId).map((c) => c.id)
        : [row.key.slice(2) as CategoryId];
    const willHide = !ids.every((id) => hidden.has(id));
    const gone = new Set([row.key, ...ids.map((id) => `c:${id}`)]);
    // a cursor on a row that goes moves on to the next row that stays
    if (willHide && !showHidden && active && gone.has(active.key)) {
      const stays = (key: string) => !gone.has(key);
      const next = keys.slice(index + 1).find(stays) ?? keys.slice(0, index).reverse().find(stays);
      if (next) moveTo({ key: next, col: active.col }, 'only');
    }
    toggleHidden(ids);
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
    const cell = { key: `c:${t.categoryId}`, col: monthKey(t.occurredAt!) };
    setCursor(cell);
    setSelection(null);
    setFound({ id, cell });
    requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
  };

  const cyclePeriod = () => {
    const i = PERIODS.findIndex(([p]) => p === period);
    setPreferences({ overviewPeriod: PERIODS[(i + 1) % PERIODS.length][0] });
  };

  // ---------- keys ----------
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
  useWindowKeyDown(
    (e) => {
      if (!isMod(e) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setFilterOpen(false);
      setFindOpen(true);
    },
    { capture: true },
  );

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
          <div className={s.group}>
            <span className={s.ctlbl} id="period-label">
              Period
            </span>
            <div className={s.seg} role="group" aria-labelledby="period-label">
              {PERIODS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cx(period === id && s.on)}
                  aria-pressed={period === id}
                  onClick={() => {
                    setPreferences({ overviewPeriod: id });
                    focusTable();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="kbd" title="Press P to switch period">
              P
            </span>
          </div>
          <div className={s.tools}>
            <button
              type="button"
              className={s.tbtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFindOpen(true)}
              aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
            >
              <Icon name="search" />
              Find <span className="kbd">{isMac ? '⌘K' : 'Ctrl+K'}</span>
            </button>
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
              onToggle={toggleHidden}
              onShowAll={() => setHidden([])}
            />
            <button
              type="button"
              className={cx(s.tbtn, showHidden && s.on)}
              aria-pressed={showHidden}
              disabled={!hiddenCount}
              onClick={() => {
                setShowHidden((shown) => !shown);
                focusTable();
              }}
            >
              <span className={s.sw} aria-hidden="true" />
              Show hidden
              <span className="kbd">H</span>
            </button>
            <button type="button" className={s.tbtn} onClick={() => setAllCollapsed(false)} aria-keyshortcuts="E">
              Expand all <span className="kbd">E</span>
            </button>
            <button type="button" className={s.tbtn} onClick={() => setAllCollapsed(true)} aria-keyshortcuts="C">
              Collapse all <span className="kbd">C</span>
            </button>
          </div>
        </div>

        <div className={s.body}>
          <div className={s.pwrap} ref={scrollRef}>
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
