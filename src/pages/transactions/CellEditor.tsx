import type { KeyboardEvent } from 'react';
import { formatLocal, type LocalParts, parseLocalInput, shiftDays, shiftMonths } from '../../../shared/time';
import type { Transaction } from '../../../shared/types';
import { cx } from '../../components/cx';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import { Calendar } from './Calendar';
import s from './CellEditor.module.css';
import { baseParts, type Col } from './columns';
import { EditorTextField } from './EditorTextField';
import { type EditState, NOTHING_HIGHLIGHTED, type Option, stepHighlight } from './editState';
import type { Move } from './gridKeys';
import { SuggestList } from './SuggestList';

interface Props {
  column: Col;
  row: Transaction;
  edit: EditState;
  /** Suggestions for suggest columns, already filtered by the text. */
  options: Option[];
  onChange: (edit: EditState) => void;
  /** Saves the editor text, or `text` when given (a picked suggestion or day). */
  onCommit: (move: Move, text?: string) => void;
  onCancel: () => void;
  onBlur: () => void;
}

const DAY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const MONTH_STEPS: Record<string, number> = { PageUp: -1, PageDown: 1 };

/** The editor inside the active cell: a text field, plus suggestions or a calendar depending on the column. */
export function CellEditor({ column, row, edit, options, onChange, onCommit, onCancel, onBlur }: Props) {
  const guard = useRepeatGuard();
  const isDate = column.kind === 'date';
  const shownDate = isDate ? (parseLocalInput(edit.text, baseParts(row)) ?? baseParts(row)) : null;

  const setDate = (p: LocalParts | null) => {
    if (p) onChange({ ...edit, text: formatLocal(p), error: '', touched: true, typingDate: false });
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    const k = e.key;
    if (guard.blocks(e)) {
      e.preventDefault();
      return;
    }
    if (column.kind === 'suggest' && (k === 'ArrowDown' || k === 'ArrowUp')) {
      e.preventDefault();
      if (!options.length) return;
      onChange({ ...edit, highlighted: stepHighlight(edit.highlighted, k === 'ArrowDown' ? 1 : -1, options.length) });
      guard.moved();
      return;
    }
    if (shownDate && !edit.typingDate) {
      // the calendar has the keys: arrows / PgUp / PgDn move the date, t / y / n jump to today / yesterday / now
      if (k in DAY_STEPS || k in MONTH_STEPS) {
        e.preventDefault();
        setDate(k in DAY_STEPS ? shiftDays(shownDate, DAY_STEPS[k]) : shiftMonths(shownDate, MONTH_STEPS[k]));
        guard.moved();
        return;
      }
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (/^[tyn]$/i.test(k) && plain) {
        e.preventDefault();
        setDate(parseLocalInput(k, shownDate));
        return;
      }
      // any other character, or Backspace / Delete, hands the keys to the text field and starts a new date
      if (k === 'Backspace' || k === 'Delete' || (k.length === 1 && plain)) {
        e.preventDefault();
        onChange({ ...edit, text: k.length === 1 ? k : '', typingDate: true, error: '', touched: true });
        return;
      }
    } else if (isDate && k === 'ArrowDown') {
      // ↓ from the text field gives the keys back to the calendar, keeping a typed date when it parses
      e.preventDefault();
      const p = parseLocalInput(edit.text, baseParts(row));
      onChange({ ...edit, typingDate: false, error: '', text: p ? formatLocal(p) : edit.text });
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'up' : 'down');
    } else if (k === 'Tab') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'left-edit' : 'right-edit');
    } else if (k === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <>
      <EditorTextField
        className={cx(
          s.editorInput,
          column.num && cx(s.numeric, 'mono'),
          isDate && cx('mono', !edit.typingDate && s.calendarMode),
          edit.error && s.invalid,
        )}
        label={isDate ? `${column.label}, format dd.mm.yyyy hh:mm` : column.label}
        value={edit.text}
        selectAll={edit.selectAll}
        error={edit.error}
        onChange={(text) =>
          onChange({
            ...edit,
            text,
            touched: true,
            highlighted: text.trim() ? 0 : NOTHING_HIGHLIGHTED,
            error: '',
            typingDate: true,
          })
        }
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onMouseDown={isDate && !edit.typingDate ? () => onChange({ ...edit, typingDate: true }) : undefined}
        activeOption={
          column.kind === 'suggest'
            ? edit.highlighted === NOTHING_HIGHLIGHTED
              ? ''
              : `opt-${edit.highlighted}`
            : undefined
        }
      />
      {column.kind === 'suggest' && (
        <SuggestList
          options={options}
          highlighted={edit.highlighted}
          opensUp={edit.opensUp}
          label={column.label}
          onPick={(i) => onCommit('down', options[i].value)}
        />
      )}
      {shownDate && (
        <Calendar
          value={shownDate}
          opensUp={edit.opensUp}
          typing={edit.typingDate}
          onPick={(y, mo, d) => onCommit('down', formatLocal({ ...shownDate, y, mo, d }))}
        />
      )}
    </>
  );
}
