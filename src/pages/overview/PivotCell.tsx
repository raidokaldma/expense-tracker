import { cx } from '../../components/cx';
import { type SelectHow, selectHow } from '../../components/selection';
import { formatAmount } from '../../model/money';
import pivot from './PivotTable.module.css';

interface Props {
  id: string;
  /** The cell's id in the selection (see cellId). */
  cell: string;
  value: number;
  /** How many transactions the value sums: a dash means none, transactions that cancel out show 0,00. */
  count: number;
  isTotal: boolean;
  active: boolean;
  inSelection: boolean;
  /** Shaded as part of a selection of more than the active cell. */
  shaded: boolean;
  onSelect: (how: SelectHow) => void;
}

export function PivotCell({ id, cell, value, count, isTotal, active, inSelection, shaded, onSelect }: Props) {
  return (
    <div
      id={id}
      className={cx(
        pivot.pivotCell,
        'mono',
        isTotal && pivot.totalColumn,
        count === 0 && pivot.zero,
        value > 0 && pivot.pos,
        active && pivot.active,
        shaded && pivot.selected,
      )}
      role="gridcell"
      aria-selected={inSelection}
      data-cell={cell}
      onMouseDown={(e) => {
        e.preventDefault();
        if (e.button === 0) onSelect(selectHow(e));
      }}
    >
      {count === 0 ? '–' : formatAmount(value)}
    </div>
  );
}
