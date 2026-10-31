import { useToast } from '../store/toast';
import { cx } from './cx';
import s from './Toaster.module.css';

/** The latest toast (see showToast), at the bottom of every page; it never takes the focus. */
export function Toaster() {
  const toast = useToast((st) => st.toast);
  return (
    <div className={s.toaster} role="status" aria-live="polite">
      {toast && (
        <div key={toast.seq} className={cx(s.toast, toast.warn && s.warn)}>
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
