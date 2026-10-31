import type { MouseEvent, ReactNode } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import type { Lookup } from '../../model/lookup';
import { isBlank } from '../../model/validity';
import { type Col, displayText } from './columns';
import s from './transactions.module.css';
import type { VisibleRow } from './visibleRows';

interface Props {
  row: VisibleRow;
  column: Col;
  /** The cell's id, referenced by the grid's aria-activedescendant. */
  id: string;
  active: boolean;
  lookup: Lookup;
  onMouseDown: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  /** Shows a filter button on hover that lists only rows with this cell's value. */
  onQuickFilter?: () => void;
  /** The editor, while this cell is being edited; it replaces the text. */
  children?: ReactNode;
}

/** One cell of the grid: the value as text, or the editor while it is being edited. */
export function GridCell({
  row,
  column,
  id,
  active,
  lookup,
  onMouseDown,
  onDoubleClick,
  onQuickFilter,
  children,
}: Props) {
  const key = column.key;
  // required fields left empty are marked red (description is optional)
  const missing = !row.draft && key !== 'description' && isBlank(row.transaction[key]);
  let text = displayText(row.transaction, key, lookup);
  // the new-transaction row hints at what to type
  const placeholder = row.draft && !text && (key === 'occurredAt' || key === 'counterparty');
  if (placeholder) text = key === 'occurredAt' ? 'now' : 'New transaction…';
  const positive = key === 'amount' && row.transaction.amount != null && row.transaction.amount > 0;
  const editing = Boolean(children);

  return (
    <div
      className={cx(
        s.cell,
        column.num && s.num,
        (column.num || key === 'occurredAt') && 'mono',
        active && s.active,
        editing && s.editing,
        missing && s.missing,
        positive && 'pos',
      )}
      id={id}
      role="gridcell"
      aria-selected={active}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {editing ? children : <span className={cx(s.txt, placeholder && s.ph)}>{text}</span>}
      {!editing && onQuickFilter && text && (
        <button
          type="button"
          className={s.quickfilter}
          tabIndex={-1}
          aria-label={`Show only rows with “${text}”`}
          title={`Show only rows with “${text}”`}
          // the cell must not take the click as a selection
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onQuickFilter}
        >
          <Icon name="filter" size={13} />
        </button>
      )}
    </div>
  );
}
