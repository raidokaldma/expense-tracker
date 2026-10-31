import { useStore } from '../store/store';
import { cx } from './cx';

/** The latest toast (see showToast), at the bottom of every page; it never takes the focus. */
export function Toaster() {
  const toast = useStore((s) => s.toast);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toast && (
        <div key={toast.seq} className={cx('toast', toast.warn && 'warn')}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              // the focus stays where it is, so the keyboard keeps working
              onMouseDown={(e) => e.preventDefault()}
              onClick={toast.action.run}
            >
              {toast.action.label}
              {toast.action.shortcut && <span className="kbd">{toast.action.shortcut}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
