import { cx } from '../../components/cx';
import { Icon, type IconName } from '../../components/icons';
import s from './IconButton.module.css';

/** A row action; the keyboard shortcut in the title does the same, so it stays out of the tab order. */
export function IconButton(props: {
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
      className={cx(s.iconButton, props.danger && s.danger)}
      tabIndex={-1}
      aria-label={props.label}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size={15} />
    </button>
  );
}
