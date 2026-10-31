import { formatLocal, parseLocalInput } from '../../../shared/time';
import type { Transaction } from '../../../shared/types';
import { baseParts, type Col } from './columns';

export interface Option {
  value: string;
  label: string;
  hint?: string;
  /** Suggested for this row by the confidence model. */
  confidence?: number;
  level?: 'high' | 'med' | 'low';
  /** Free text that is not in the list yet ("Use “x”"). */
  isNew?: boolean;
}

export const NOTHING_HIGHLIGHTED = -1;

/** The suggestion ↑ (-1) or ↓ (1) highlights next; past either end it goes through nothing highlighted. */
export function stepHighlight(highlighted: number, step: -1 | 1, count: number): number {
  const next = highlighted + step;
  if (next < NOTHING_HIGHLIGHTED) return count - 1;
  if (next >= count) return NOTHING_HIGHLIGHTED;
  return next;
}

export interface EditState {
  text: string;
  /** The text was typed (so it filters the suggestions), not just copied from the cell. */
  touched: boolean;
  /** Index of the highlighted suggestion, or NOTHING_HIGHLIGHTED. */
  highlighted: number;
  error: string;
  /** Date editor: the text field has the keys (cursor visible) instead of the calendar. */
  typingDate: boolean;
  /** Dropdowns open upward when the cell sits low in the grid. */
  opensUp: boolean;
  selectAll: boolean;
}

interface OpenEditor {
  column: Col;
  row: Transaction;
  /** The cell's value as editable text. */
  cellText: string;
  /** The character that opened the editor; undefined for Enter, F2 or double-click. */
  typed?: string;
  /** Suggestions for the cell's value (suggest columns opened without typing). */
  options: Option[];
  opensUp: boolean;
}

/**
 * The editor's state as it opens. Enter starts from the cell's value, all of it selected; a typed character
 * replaces it. On a date, t / y / n open on today / yesterday / now. On a suggest column the matching option is
 * highlighted, and an empty category starts on the top suggestion, so Enter accepts it.
 */
export function initialEdit({ column, row, cellText, typed, options, opensUp }: OpenEditor): EditState {
  let text = typed ?? cellText;
  if (column.kind === 'date' && typed && /^[tyn]$/i.test(typed)) {
    const parts = parseLocalInput(typed, baseParts(row));
    if (parts) text = formatLocal(parts);
  }
  let highlighted = NOTHING_HIGHLIGHTED;
  if (column.kind === 'suggest') {
    if (typed != null) highlighted = text.trim() ? 0 : NOTHING_HIGHLIGHTED;
    else {
      highlighted = options.findIndex((o) => o.value === text);
      if (!text && options[0]?.confidence != null) highlighted = 0;
    }
  }
  return {
    text,
    touched: typed != null,
    highlighted,
    error: '',
    typingDate: typed != null && text === typed,
    opensUp,
    selectAll: typed == null,
  };
}
