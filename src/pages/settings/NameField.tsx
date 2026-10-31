import { cx } from '../../components/cx';
import { isMod } from '../../keys/keys';
import s from './settings.module.css';

interface NameFieldProps {
  label: string;
  placeholder?: string;
  text: string;
  error: string;
  onText: (text: string) => void;
  /** Enter */
  onDone: () => void;
  /** Esc */
  onCancel: () => void;
  onBlur: () => void;
}

/** The text field for adding or renaming a group, category or account, in place; takes focus when it appears. */
export function NameField(p: NameFieldProps) {
  return (
    <input
      className={cx(s.ined, p.error && s.bad)}
      type="text"
      aria-label={p.label}
      placeholder={p.placeholder}
      value={p.text}
      onChange={(e) => p.onText(e.target.value)}
      onKeyDown={(e) => {
        // ⌘S is left to the page (it saves); other keys stay in the field
        if (isMod(e) && e.key.toLowerCase() === 's') return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          p.onDone();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          p.onCancel();
        }
      }}
      onBlur={p.onBlur}
      onFocus={(e) => e.target.select()}
      // biome-ignore lint/a11y/noAutofocus: adding and renaming start from the keyboard and must take focus
      autoFocus
      autoComplete="off"
      spellCheck={false}
    />
  );
}

/** The message under a row whose name is not accepted. */
export function FieldError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className={s.err} role="alert">
      {error}
    </div>
  );
}
