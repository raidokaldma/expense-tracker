import type { KeyboardEvent, RefObject } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { cellId, type SelectHow, selectHow } from '../../components/selection';
import { formatAmount } from '../../model/money';
import type { Pivot } from '../../model/pivot';
import { plural } from '../../model/plural';
import type { CategoryGroupId } from '../../model/types';
import s from './overview.module.css';

interface Props {
  pivot: Pivot;
  /** Column keys: the months, newest first, then "total". */
  cols: string[];
  /** Navigation keys of the rows the cursor can be on (every row but the section titles). */
  keys: string[];
  /** The active cell, or -1 / -1 when there is none. */
  activeRow: number;
  activeCol: number;
  /** Ids of the selected cells; shaded when more than the active cell is selected. */
  selected: ReadonlySet<string>;
  tableRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onSelect: (rowKey: string, col: string, how: SelectHow) => void;
  onToggleGroup: (id: CategoryGroupId) => void;
  /** The eye button on a category or group: hides it, or shows it again. */
  onToggleHidden: (rowKey: string) => void;
}

/** The months × categories table: sections, groups (collapsible) and their categories, with totals. */
export function PivotTable({
  pivot,
  cols,
  keys,
  activeRow,
  activeCol,
  selected,
  tableRef,
  onKeyDown,
  onSelect,
  onToggleGroup,
  onToggleHidden,
}: Props) {
  const { months } = pivot;
  const gridCols = `minmax(210px, 1.6fr) repeat(${months.length}, minmax(88px, 1fr)) minmax(104px, 1fr)`;
  return (
    <div
      className={s.pgrid}
      style={{ minWidth: 210 + 88 * months.length + 104 }}
      role="treegrid"
      aria-label="Totals by category and month"
      aria-activedescendant={activeRow >= 0 ? `p-${activeRow}-${activeCol}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      ref={tableRef}
    >
      <div className={cx(s.prow, s.phdr)} style={{ gridTemplateColumns: gridCols }} role="row">
        <div className={s.plabel} role="columnheader">
          Category
        </div>
        {months.map((m) => (
          <div key={m.key} className={s.pc} role="columnheader" title={m.long}>
            {m.short}
          </div>
        ))}
        <div className={cx(s.pc, s.tcol)} role="columnheader">
          Total
        </div>
      </div>
      {pivot.rows.map((row) => {
        if (row.kind === 'section')
          return (
            <div
              key={`section-${row.label}`}
              className={cx(s.prow, s.psec)}
              style={{ gridTemplateColumns: gridCols }}
              role="row"
            >
              <div className={s.psectitle} role="rowheader">
                {row.label}
              </div>
            </div>
          );
        const rowIndex = keys.indexOf(row.key);
        return (
          <div
            key={row.key}
            className={cx(s.prow, s[row.kind], row.hidden && s.hid, rowIndex === activeRow && s.cur)}
            style={{ gridTemplateColumns: gridCols }}
            role="row"
            aria-level={row.kind === 'child' ? 2 : 1}
            aria-expanded={row.kind === 'parent' ? row.open : undefined}
          >
            <div className={s.plabel} role="rowheader">
              {row.kind === 'parent' && (
                <button
                  type="button"
                  className={cx(s.caret, !row.open && s.closed)}
                  tabIndex={-1}
                  aria-label={`${row.open ? 'Collapse' : 'Expand'} ${row.label}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (row.groupId) onToggleGroup(row.groupId);
                  }}
                >
                  <Icon name="caret" weight={2.2} />
                </button>
              )}
              <span className={s.lname}>
                <span className={s.ltext}>{row.label}</span>
                {row.kind === 'parent' && (
                  <span className={s.lcount} title={plural(row.categoryCount ?? 0, 'category', 'categories')}>
                    {row.categoryCount ?? 0}
                  </span>
                )}
              </span>
              {(row.kind === 'parent' || row.kind === 'child') && (
                // shown on hover, and always while hidden
                <button
                  type="button"
                  className={cx(s.eye, row.hidden && s.on)}
                  tabIndex={-1}
                  aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
                  title={`${row.hidden ? 'Show' : 'Hide'} (X)`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => onToggleHidden(row.key)}
                >
                  <Icon name={row.hidden ? 'hidden' : 'eye'} size={13} />
                </button>
              )}
            </div>
            {row.values.map((value, col) => {
              const active = rowIndex === activeRow && col === activeCol;
              // a dash means no transactions; transactions that cancel out show 0,00
              const empty = row.counts[col] === 0;
              const id = cellId({ key: row.key, col: cols[col] });
              const inSelection = selected.has(id);
              return (
                <div
                  key={cols[col]}
                  id={`p-${rowIndex}-${col}`}
                  className={cx(
                    s.pc,
                    'mono',
                    cols[col] === 'total' && s.tcol,
                    empty && s.zero,
                    value > 0 && s.pos,
                    active && s.active,
                    inSelection && (selected.size > 1 || !active) && s.sel,
                  )}
                  role="gridcell"
                  aria-selected={inSelection}
                  data-cell={id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (e.button === 0) onSelect(row.key, cols[col], selectHow(e));
                  }}
                >
                  {empty ? '–' : formatAmount(value)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
