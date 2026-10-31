import { type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import s from './EditorTextField.module.css';

interface TextFieldProps {
  value: string;
  label: string;
  className: string;
  selectAll: boolean;
  error: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onMouseDown?: () => void;
  /** Set for suggest columns: the id of the highlighted option ('' for none). */
  activeOption?: string;
}

/** The editor's text field; takes focus when it mounts. */
export function EditorTextField(props: TextFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const selectAll = useRef(props.selectAll);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (selectAll.current) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <>
      <input
        ref={ref}
        className={props.className}
        type="text"
        aria-label={props.label}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={props.onKeyDown}
        onBlur={props.onBlur}
        onMouseDown={props.onMouseDown}
        autoComplete="off"
        spellCheck={false}
        {...(props.activeOption != null
          ? {
              role: 'combobox',
              'aria-expanded': true,
              'aria-autocomplete': 'list' as const,
              'aria-controls': 'suggest-list',
              'aria-activedescendant': props.activeOption || undefined,
            }
          : {})}
      />
      {props.error && (
        <div className={s.errorTip} role="alert">
          {props.error}
        </div>
      )}
    </>
  );
}
