import { MOD_LABEL, modAria } from '../keys/keys';
import { Icon } from './icons';

export function FindButton({ className, onClick }: { className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={className}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-keyshortcuts={modAria('K')}
    >
      <Icon name="search" />
      Find <span className="kbd">{MOD_LABEL}K</span>
    </button>
  );
}
