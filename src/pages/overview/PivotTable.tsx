import type { KeyboardEvent, RefObject } from 'react';
import type { CategoryGroupId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { cellId, type SelectHow } from '../../components/selection';
import type { Pivot } from '../../model/pivot';
import { PivotCell } from './PivotCell';
import { PivotRowLabel } from './PivotRowLabel';
import s from './PivotTable.module.css';

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
      className={s.pivotGrid}
      style={{ minWidth: 210 + 88 * months.length + 104 }}
      role="treegrid"
      aria-label="Totals by category and month"
      aria-activedescendant={activeRow >= 0 ? `p-${activeRow}-${activeCol}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      ref={tableRef}
    >
      <div className={cx(s.pivotRow, s.pivotHeader)} style={{ gridTemplateColumns: gridCols }} role="row">
        <div className={s.pivotLabel} role="columnheader">
          Category
        </div>
        {months.map((m) => (
          <div key={m.key} className={s.pivotCell} role="columnheader" title={m.long}>
            {m.short}
          </div>
        ))}
        <div className={cx(s.pivotCell, s.totalColumn)} role="columnheader">
          Total
        </div>
      </div>
      {pivot.rows.map((row) => {
        if (row.kind === 'section')
          return (
            <div
              key={`section-${row.label}`}
              className={cx(s.pivotRow, s.pivotSection)}
              style={{ gridTemplateColumns: gridCols }}
              role="row"
            >
              <div className={s.pivotSectionTitle} role="rowheader">
                {row.label}
              </div>
            </div>
          );
        const rowIndex = keys.indexOf(row.key);
        return (
          <div
            key={row.key}
            className={cx(s.pivotRow, s[row.kind], row.hidden && s.dimmed, rowIndex === activeRow && s.currentRow)}
            style={{ gridTemplateColumns: gridCols }}
            role="row"
            aria-level={row.kind === 'child' ? 2 : 1}
            aria-expanded={row.kind === 'parent' ? row.open : undefined}
          >
            <PivotRowLabel row={row} onToggleGroup={onToggleGroup} onToggleHidden={() => onToggleHidden(row.key)} />
            {row.values.map((value, col) => {
              const active = rowIndex === activeRow && col === activeCol;
              const cell = cellId({ key: row.key, col: cols[col] });
              const inSelection = selected.has(cell);
              return (
                <PivotCell
                  key={cols[col]}
                  id={`p-${rowIndex}-${col}`}
                  cell={cell}
                  value={value}
                  count={row.counts[col]}
                  isTotal={cols[col] === 'total'}
                  active={active}
                  inSelection={inSelection}
                  shaded={inSelection && (selected.size > 1 || !active)}
                  onSelect={(how) => onSelect(row.key, cols[col], how)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
