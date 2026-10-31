import { cx } from '../../components/cx';
import { Icon, type IconName } from '../../components/icons';
import s from './settings.module.css';

/** A row action; the keyboard shortcut in the title does the same, so it stays out of the tab order. */
export function IconButton(p: {
  icon: IconName;
  label: string;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(s.ib, p.danger && s.danger)}
      tabIndex={-1}
      aria-label={p.label}
      title={p.title}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      <Icon name={p.icon} size={15} />
    </button>
  );
}
