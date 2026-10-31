import type { KeyboardEvent } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { COLS, type ColKey, type Filters } from './columns';
import type { SortBy } from './rowOrder';
import s from './transactions.module.css';

interface Props {
  filters: Filters;
  sortBy: SortBy;
  filterRef: (key: ColKey, el: HTMLInputElement | null) => void;
  onToggleSort: () => void;
  onFilterChange: (key: ColKey, value: string) => void;
  /** Esc clears the filter, Enter / ↓ goes to the first row; both return to the grid in this column. */
  onFilterLeave: (col: number, clear: boolean) => void;
}

/** The column titles and the row of column filters (the grid keeps them in view). */
export function GridHeader({ filters, sortBy, filterRef, onToggleSort, onFilterChange, onFilterLeave }: Props) {
  const onFilterKey = (e: KeyboardEvent<HTMLInputElement>, col: number) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      onFilterLeave(col, e.key === 'Escape');
    }
  };

  return (
    <>
      <div className={cx(s.row, s.hdr)} role="row">
        <div className={cx(s.cell, s.idx)} role="columnheader">
          <span className={s.hlabel}>#</span>
        </div>
        {COLS.map((column) => (
          <div
            key={column.key}
            className={cx(s.cell, column.num && s.num, (filters[column.key] || '').trim() && s.filtered)}
            role="columnheader"
            aria-sort={column.key === 'occurredAt' && sortBy === 'occurredAt' ? 'descending' : 'none'}
          >
            {column.key === 'occurredAt' ? (
              <button
                type="button"
                className={s.sortbtn}
                onClick={onToggleSort}
                title="Toggle order: import date / transaction date"
              >
                <span className={s.hlabel}>{column.label}</span>
                <span className={s.sortby}>↓ {sortBy === 'addedAt' ? 'import' : 'date'}</span>
              </button>
            ) : (
              <span className={s.hlabel}>{column.label}</span>
            )}
          </div>
        ))}
      </div>
      <div className={cx(s.row, s.frow)} role="row">
        <div className={cx(s.cell, s.idx)} role="gridcell">
          <Icon name="filter" />
        </div>
        {COLS.map((column, col) => (
          <div key={column.key} className={cx(s.cell, s.fcell)} role="gridcell">
            <input
              className={cx(s.filter, filters[column.key] && s.filled)}
              type="text"
              aria-label={`Filter ${column.label}`}
              placeholder={column.placeholder}
              value={filters[column.key] || ''}
              onChange={(e) => onFilterChange(column.key, e.target.value)}
              onKeyDown={(e) => onFilterKey(e, col)}
              ref={(el) => filterRef(column.key, el)}
              autoComplete="off"
              spellCheck={false}
            />
            {filters[column.key] && (
              <button
                type="button"
                className={s.clearfilter}
                tabIndex={-1}
                aria-label={`Clear the ${column.label} filter`}
                title="Clear filter (Esc)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onFilterLeave(col, true)}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
