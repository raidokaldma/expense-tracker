import { type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { cx } from '../../components/cx';
import { keepInView } from '../../components/scroll';
import { RepeatGuard } from '../../keys/keys';
import {
  daysInMonth,
  firstWeekdayOfMonth,
  formatLocal,
  type LocalParts,
  localDateKey,
  MONTH_NAMES,
  nowLocal,
  pad2,
  parseLocalInput,
  shiftDays,
  shiftMonths,
} from '../../model/time';
import type { Transaction } from '../../model/types';
import { baseParts, type Col } from './columns';
import type { EditState, Option } from './editState';
import type { Move } from './gridKeys';
import s from './transactions.module.css';

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
  const guard = useRef(new RepeatGuard()).current;
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
      // wraps through "nothing highlighted" (-1)
      let i = edit.highlighted + (k === 'ArrowDown' ? 1 : -1);
      if (i < -1) i = options.length - 1;
      if (i >= options.length) i = -1;
      onChange({ ...edit, highlighted: i });
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
      <TextField
        className={cx(
          s.ed,
          column.num && cx(s.num, 'mono'),
          isDate && cx('mono', !edit.typingDate && s.calmode),
          edit.error && s.err,
        )}
        label={isDate ? `${column.label}, format dd.mm.yyyy hh:mm` : column.label}
        value={edit.text}
        selectAll={edit.selectAll}
        error={edit.error}
        onChange={(text) =>
          onChange({ ...edit, text, touched: true, highlighted: text.trim() ? 0 : -1, error: '', typingDate: true })
        }
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onMouseDown={isDate && !edit.typingDate ? () => onChange({ ...edit, typingDate: true }) : undefined}
        activeOption={column.kind === 'suggest' ? (edit.highlighted >= 0 ? `opt-${edit.highlighted}` : '') : undefined}
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
function TextField(p: TextFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const selectAll = useRef(p.selectAll);
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
        className={p.className}
        type="text"
        aria-label={p.label}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={p.onKeyDown}
        onBlur={p.onBlur}
        onMouseDown={p.onMouseDown}
        autoComplete="off"
        spellCheck={false}
        {...(p.activeOption != null
          ? {
              role: 'combobox',
              'aria-expanded': true,
              'aria-autocomplete': 'list' as const,
              'aria-controls': 'suggest-list',
              'aria-activedescendant': p.activeOption || undefined,
            }
          : {})}
      />
      {p.error && (
        <div className={s.errtip} role="alert">
          {p.error}
        </div>
      )}
    </>
  );
}

const LEVEL_LABEL = { high: 'High', med: 'Medium', low: 'Low' };

function SuggestList(p: {
  options: Option[];
  highlighted: number;
  opensUp: boolean;
  label: string;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // keeps the highlighted option inside the dropdown's scroll area
  useLayoutEffect(() => {
    const pop = ref.current;
    if (pop && p.highlighted < 0) pop.scrollTop = 0;
    else keepInView(pop, pop?.querySelector('[aria-selected="true"]'), 4);
  }, [p.highlighted]);
  if (!p.options.length) return null;
  return (
    <div
      ref={ref}
      className={cx(s.pop, p.opensUp && s.up)}
      id="suggest-list"
      role="listbox"
      aria-label={`${p.label} suggestions`}
    >
      {p.options.map((o, i) => {
        const suggested = o.confidence != null;
        const prevSuggested = i > 0 && p.options[i - 1].confidence != null;
        const header =
          suggested && i === 0 ? 'Suggested for this row' : !suggested && prevSuggested ? 'All categories' : '';
        const percent = suggested ? `${Math.round(o.confidence! * 100)}%` : '';
        return (
          <div key={`${suggested ? 'sug:' : ''}${o.isNew ? 'new:' : ''}${o.value}`}>
            {header && (
              <div className={s.opthead} role="presentation">
                {header}
              </div>
            )}
            <div
              className={cx(s.opt, i === p.highlighted && s.hi, o.isNew && s.new, suggested && s.sug)}
              id={`opt-${i}`}
              role="option"
              aria-selected={i === p.highlighted}
              aria-label={suggested ? `${o.label}, suggested, ${LEVEL_LABEL[o.level!]} confidence ${percent}` : o.label}
              onMouseDown={(e) => {
                e.preventDefault();
                p.onPick(i);
              }}
            >
              <span className={s.olabel}>{o.label}</span>
              {suggested ? (
                <span className={cx(s.conf, s[o.level!])} title={`${LEVEL_LABEL[o.level!]} confidence`}>
                  {percent}
                </span>
              ) : (
                <span className={s.hint}>{o.hint}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Month calendar under the date editor; the day picked is saved straight away. */
function Calendar(p: {
  value: LocalParts;
  opensUp: boolean;
  typing: boolean;
  onPick: (y: number, mo: number, d: number) => void;
}) {
  const { y, mo, d } = p.value;
  const today = localDateKey(nowLocal());
  const blanksBefore = firstWeekdayOfMonth(y, mo);
  const days = Array.from({ length: daysInMonth(y, mo) }, (_, i) => i + 1);
  return (
    <div className={cx(s.pop, s.cal, p.opensUp && s.up)} role="group" aria-label="Date picker">
      <div className={s.calhead}>
        <span>
          {MONTH_NAMES[mo - 1]} {y}
        </span>
        <span className="mono">
          {pad2(p.value.h)}:{pad2(p.value.mi)}
        </span>
      </div>
      <div className={cx(s.calgrid, s.wk)} aria-hidden="true">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className={s.calgrid}>
        {blanksBefore > 0 && <span style={{ gridColumn: `span ${blanksBefore}` }} />}
        {days.map((day) => (
          <button
            key={day}
            type="button"
            tabIndex={-1}
            className={cx(s.day, day === d && s.sel, `${y}-${pad2(mo)}-${pad2(day)}` === today && s.today)}
            onMouseDown={(e) => {
              e.preventDefault();
              p.onPick(y, mo, day);
            }}
          >
            {day}
          </button>
        ))}
      </div>
      {p.typing ? (
        <div className={s.pophelp}>↓ back to the calendar</div>
      ) : (
        <div className={s.pophelp}>
          PgUp/PgDn month · <span className="mono">t</span> today · <span className="mono">y</span> yesterday · or start
          typing, e.g. <span className="mono">20.10 14:30</span>
        </div>
      )}
    </div>
  );
}
