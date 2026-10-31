import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import type { PivotRow } from '../../model/pivot';
import s from './EyeButton.module.css';

export function EyeButton({ row, onClick }: { row: PivotRow; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cx(s.eye, row.hidden && s.visible)}
      aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
      onClick={onClick}
    >
      <Icon name={row.hidden ? 'hidden' : 'eye'} size={18} />
    </button>
  );
}
