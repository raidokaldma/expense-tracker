import { type KeyboardEvent, useRef, useState } from 'react';
import { cx } from '../../components/cx';
import { RepeatGuard, rowMove } from '../../keys/keys';
import s from './settings.module.css';

export interface PickerOption {
  value: string;
  label: string;
  hint: string;
}

interface Props {
  title: string;
  options: PickerOption[];
  /** The option highlighted when the list opens. */
  initial: number;
  onPick: (option: PickerOption) => void;
  /** Esc */
  onCancel: () => void;
  /** Focus left the list. */
  onDismiss: () => void;
}

/** A list that opens under a row and takes the keys: ↑ ↓ to choose, Enter to pick, Esc to close. */
export function OptionPicker({ title, options, initial, onPick, onCancel, onDismiss }: Props) {
  const [highlighted, setHighlighted] = useState(initial);
  const repeatGuard = useRef(new RepeatGuard()).current;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const next = rowMove(e, highlighted, options.length, true);
    if (next != null) {
      e.preventDefault();
      setHighlighted(next);
      repeatGuard.moved();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlighted]) onPick(options[highlighted]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className={s.picker}
      role="listbox"
      aria-label={title}
      aria-activedescendant={`o-${highlighted}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDismiss();
      }}
      ref={(el) => el?.focus({ preventScroll: true })}
    >
      <div className={s.ptitle}>{title}</div>
      {options.map((option, i) => (
        <div
          key={option.value}
          className={cx(s.opt, i === highlighted && s.hi)}
          id={`o-${i}`}
          role="option"
          aria-selected={i === highlighted}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(option);
          }}
        >
          <span>{option.label}</span>
          <span className={s.hint}>{option.hint}</span>
        </div>
      ))}
    </div>
  );
}
