import { type ComponentProps, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { NewTransaction } from '../../../shared/types';
import type { Lookup } from '../../model/lookup';
import type { CellEditor } from './CellEditor';
import { COLS, type ColKey, editText, parseCell } from './columns';
import { type EditState, initialEdit } from './editState';
import type { Move } from './gridKeys';
import grid from './TransactionsGrid.module.css';
import { useSuggestions } from './useSuggestions';
import type { VisibleRow } from './visibleRows';

/** Dropdowns open upward when the active cell is this close to the grid's bottom edge… */
const DROPDOWN_HEIGHT = 300;
/** …and there is at least this much room above it. */
const ROOM_ABOVE = 340;

interface Options {
  activeRow: VisibleRow;
  col: number;
  lookup: Lookup;
  scrollRef: RefObject<HTMLDivElement | null>;
  focusGrid: () => void;
  /** The cursor asks for the editor to open once it is in place (Tab, split, double-click). */
  editRequested: boolean;
  clearEditRequest: () => void;
  isCreatingDraft: () => boolean;
  saveCell: (row: VisibleRow, col: number, value: NewTransaction[ColKey], move: Move) => Promise<void>;
}

/** The editor in the active cell: opening it, saving or cancelling it, and its suggestions. */
export function useCellEditor(params: Options) {
  const { activeRow, lookup } = params;
  const column = COLS[params.col];
  const suggestionsFor = useSuggestions();
  const [edit, setEdit] = useState<EditState | null>(null);
  // saving moves focus back to the grid, which blurs the editor; the blur must not save a second time
  const closing = useRef(false);

  const optionsFor = (state: EditState) =>
    column.kind === 'suggest' ? suggestionsFor(column.key, state.text, state.touched, activeRow.transaction) : [];

  function opensUp() {
    const area = params.scrollRef.current;
    const cell = area?.querySelector(`.${grid.active}`);
    if (!area || !cell) return false;
    const box = area.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    return r.bottom > box.top + area.clientHeight - DROPDOWN_HEIGHT && r.top - box.top > ROOM_ABOVE;
  }

  /** Opens the editor on the active cell, on its value or on a typed character (see initialEdit). */
  function start(typed?: string) {
    if (activeRow.draft && params.isCreatingDraft()) return;
    const row = activeRow.transaction;
    const cellText = editText(row, column.key, lookup, { draft: activeRow.draft });
    const options = column.kind === 'suggest' && typed == null ? suggestionsFor(column.key, cellText, false, row) : [];
    setEdit(initialEdit({ column, row, cellText, typed, options, opensUp: opensUp() }));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per request; start reads the current render
  useLayoutEffect(() => {
    if (!params.editRequested) return;
    params.clearEditRequest();
    start();
  }, [params.editRequested]);

  useLayoutEffect(() => {
    if (!edit) closing.current = false;
  }, [edit]);

  function close() {
    closing.current = true;
    setEdit(null);
  }

  /** Saves the open editor. Returns false (and keeps the editor open with an error) when the value is invalid. */
  async function commit(move: Move, picked?: string): Promise<boolean> {
    if (!edit) return true;
    const highlighted = picked == null ? optionsFor(edit)[edit.highlighted] : undefined;
    const text = picked ?? highlighted?.value ?? edit.text;
    const parsed = parseCell(column.key, text, activeRow.transaction, lookup);
    if (!parsed.ok) {
      setEdit({ ...edit, text, error: parsed.error });
      return false;
    }
    close();
    if (move !== 'none') params.focusGrid();
    await params.saveCell(activeRow, params.col, parsed.value, move);
    return true;
  }

  const editorProps = (state: EditState): ComponentProps<typeof CellEditor> => ({
    column,
    row: activeRow.transaction,
    edit: state,
    options: optionsFor(state),
    onChange: setEdit,
    onCommit: (move, picked) => void commit(move, picked),
    onCancel: () => {
      close();
      params.focusGrid();
    },
    onBlur: () => {
      if (!closing.current) void commit('none');
    },
  });

  return {
    isEditing: edit != null,
    start,
    commit,
    discard: () => setEdit(null),
    editorProps: edit && editorProps(edit),
  };
}
