import type { MouseEvent } from 'react';
import type { CategoryGroupId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import type { PivotRow } from '../../model/pivot';
import { plural } from '../../model/plural';
import s from './PivotRowLabel.module.css';
import pivot from './PivotTable.module.css';

interface Props {
  row: PivotRow;
  onToggleGroup: (id: CategoryGroupId) => void;
  onToggleHidden: () => void;
}

function keepFocus(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** A row's first cell: the group's caret and category count, the name, and the eye that hides or shows it. */
export function PivotRowLabel({ row, onToggleGroup, onToggleHidden }: Props) {
  const isGroup = row.kind === 'parent';
  return (
    <div className={pivot.pivotLabel} role="rowheader">
      {isGroup && (
        <button
          type="button"
          className={cx(s.caret, !row.open && s.closed)}
          tabIndex={-1}
          aria-label={`${row.open ? 'Collapse' : 'Expand'} ${row.label}`}
          onMouseDown={(e) => {
            keepFocus(e);
            if (row.groupId) onToggleGroup(row.groupId);
          }}
        >
          <Icon name="caret" weight={2.2} />
        </button>
      )}
      <span className={s.labelName}>
        <span className={pivot.labelText}>{row.label}</span>
        {isGroup && (
          <span className={s.labelCount} title={plural(row.categoryCount ?? 0, 'category', 'categories')}>
            {row.categoryCount ?? 0}
          </span>
        )}
      </span>
      {(isGroup || row.kind === 'child') && (
        // shown on hover, and always while hidden
        <button
          type="button"
          className={cx(pivot.eye, row.hidden && pivot.visible)}
          tabIndex={-1}
          aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
          title={`${row.hidden ? 'Show' : 'Hide'} (X)`}
          onMouseDown={keepFocus}
          onClick={onToggleHidden}
        >
          <Icon name={row.hidden ? 'hidden' : 'eye'} size={13} />
        </button>
      )}
    </div>
  );
}
