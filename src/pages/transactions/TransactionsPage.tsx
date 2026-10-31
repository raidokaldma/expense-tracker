import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PageHeader } from '../../components/AppShell';
import { FindDialog } from '../../components/FindDialog';
import {
  type Cell,
  nextSelection,
  rowKeys,
  type SelectHow,
  type Selection,
  selectedIds,
  selectHow,
} from '../../components/selection';
import { useDragSelect } from '../../components/useDragSelect';
import { isMod, MOD_LABEL, RepeatGuard } from '../../keys/keys';
import { useWindowKeyDown } from '../../keys/useWindowKeyDown';
import { parseAmount } from '../../model/money';
import { plural } from '../../model/plural';
import type { NewTransaction, TransactionId } from '../../model/types';
import { isBlank, isValid } from '../../model/validity';
import {
  createTransaction,
  redo,
  removeTransactions,
  showToast,
  splitTransaction,
  undo,
  updateTransaction,
  useStore,
} from '../../store/store';
import { AccountCards } from './AccountCards';
import { ActiveRowBar } from './ActiveRowBar';
import { amountSummary } from './amountSummary';
import { CellEditor } from './CellEditor';
import { ClipboardProxy, startClipboardKey } from './ClipboardProxy';
import {
  AMOUNT_COL,
  CATEGORY_COL,
  COLS,
  type ColKey,
  DRAFT_ID,
  displayText,
  draftToNew,
  editText,
  type Filters,
  parseCell,
} from './columns';
import { type EditState, initialEdit } from './editState';
import { GridCell } from './GridCell';
import { GridHeader } from './GridHeader';
import { type GridCommand, gridCommand, gridMove, isEditMove, type Move, positionAfter } from './gridKeys';
import { Toolbar } from './Toolbar';
import { TransactionsGrid } from './TransactionsGrid';
import s from './transactions.module.css';
import { useJumpToTransaction } from './useJumpToTransaction';
import { useRowOrder } from './useRowOrder';
import { useSuggestions } from './useSuggestions';
import { type VisibleRow, visibleRows } from './visibleRows';

/**
 * The active cell follows its row (by id), so rows appearing or disappearing above it never move it to another
 * transaction. `at` is the last known position, used when the row itself disappears.
 */
interface Cursor {
  id: TransactionId;
  col: number;
  at: number;
  /** Scroll the row to the middle of the grid (after a jump from Find or Overview). */
  center?: boolean;
  /** Open the editor once the cursor is there (Tab, split, double-click). */
  edit?: boolean;
}

/** After a new row is saved from the draft, the cursor moves relative to it once it appears in the list. */
interface PendingMove {
  id: TransactionId;
  col: number;
  move: Move;
}

/** Columns whose cells offer a filter button on hover. */
const QUICK_FILTER_COLUMNS: ColKey[] = ['counterparty', 'categoryId'];

/** Rows are selected whole: to the selection, the grid is a single column of rows. */
const SELECTION_COLS = ['row'];
const rowCell = (id: string): Cell => ({ key: id, col: 'row' });

export function TransactionsPage() {
  const transactions = useStore((st) => st.transactions);
  const lookup = useStore((st) => st.lookup);
  const sortBy = useStore((st) => st.preferences.transactionSort);
  const suggestionsFor = useSuggestions();

  const { order, toggleSort, placeSplit } = useRowOrder(transactions, sortBy);
  const [filters, setFilters] = useState<Filters>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  // rows edited while filtered stay visible until the filters change
  const [pinned, setPinned] = useState<ReadonlySet<TransactionId>>(new Set());
  const [draft, setDraft] = useState<Partial<NewTransaction>>({});
  const [cursor, setCursor] = useState<Cursor>({ id: DRAFT_ID, col: 0, at: 0 });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  // the selection belongs to the active cell it was made at; the cursor moving any other way starts it over
  const [selection, setSelection] = useState<{ at: string; selection: Selection }>({ at: '', selection: null });

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clipboardBoxRef = useRef<HTMLTextAreaElement>(null);
  const filterInputs = useRef<Partial<Record<ColKey, HTMLInputElement | null>>>({});
  const repeatGuard = useRef(new RepeatGuard()).current;
  // Saving moves focus back to the grid, which blurs the editor; the blur must not save a second time.
  const closingEditor = useRef(false);
  // While the draft row is being saved as a new transaction, the draft cannot be edited again.
  const creatingDraft = useRef(false);

  const pin = (id: TransactionId) => setPinned((p) => (p.has(id) ? p : new Set(p).add(id)));

  // ---------- visible rows ----------
  const visible = useMemo(
    () => visibleRows({ transactions, order, filters, onlyMissing, pinned, draft, lookup }),
    [transactions, order, filters, onlyMissing, pinned, draft, lookup],
  );

  const found = visible.findIndex((v) => v.transaction.id === cursor.id);
  const rowIndex = found >= 0 ? found : Math.min(cursor.at, visible.length - 1);
  const activeRow = visible[rowIndex];
  const column = COLS[cursor.col];

  const moveTo = (row: number, col: number, extra: Partial<Cursor> = {}) =>
    setCursor({ id: visible[row].transaction.id, col, at: row, ...extra });

  // ---------- selection (whole rows) ----------
  const rowIds = useMemo(() => visible.map((v) => v.transaction.id as string), [visible]);
  const activeId = activeRow.transaction.id;
  const currentSelection = selection.at === activeId ? selection.selection : null;
  const selectedRows = useMemo(
    () => rowKeys(selectedIds(currentSelection, rowCell(activeId), rowIds, SELECTION_COLS)),
    [currentSelection, activeId, rowIds],
  );
  const selectedSummary = useMemo(
    () => amountSummary(visible.filter((v) => selectedRows.has(v.transaction.id))),
    [selectedRows, visible],
  );

  /** Changes the selection for a move from the active row to row `row`. */
  function selectTo(row: number, how: SelectHow) {
    const target = visible[row].transaction.id;
    const next = nextSelection(currentSelection, rowCell(activeId), rowCell(target), how, rowIds, SELECTION_COLS);
    setSelection({ at: target, selection: next });
  }

  // dragging from a row selects the rows passed over, as Shift+click would
  const dragSelect = useDragSelect(
    scrollRef,
    (el) => (el.dataset.row == null ? null : Number(el.dataset.row)),
    (row) => {
      if (edit) return;
      selectTo(row, 'extend');
      moveTo(row, cursor.col);
    },
  );

  // ---------- focus ----------
  const focusGrid = useCallback(() => gridRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    focusGrid();
  }, [focusGrid]);

  // ---------- editing ----------
  /** Opens the editor on the active cell, on its value or on a typed character (see initialEdit). */
  function startEdit(typed?: string) {
    if (activeRow.draft && creatingDraft.current) return;
    const row = activeRow.transaction;
    const cellText = editText(row, column.key, lookup, activeRow.draft);
    const options = column.kind === 'suggest' && typed == null ? suggestionsFor(column.key, cellText, false, row) : [];
    setEdit(initialEdit({ column, row, cellText, typed, options, opensUp: editorOpensUp() }));
  }

  /** Dropdowns open upward when the active cell sits low in the grid and there is room above. */
  function editorOpensUp() {
    const area = scrollRef.current;
    const cell = area?.querySelector(`.${s.active}`);
    if (!area || !cell) return false;
    const box = area.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    return r.bottom > box.top + area.clientHeight - 300 && r.top - box.top > 340;
  }

  // opens the editor where a move asked for it (Tab, split, double-click)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per request; startEdit reads the current render
  useLayoutEffect(() => {
    if (!cursor.edit) return;
    setCursor((c) => ({ ...c, edit: false }));
    startEdit();
  }, [cursor.edit]);

  useLayoutEffect(() => {
    if (!edit) closingEditor.current = false;
  }, [edit]);

  // a row created from the draft: once it is in the list, move relative to it
  useLayoutEffect(() => {
    if (!pendingMove) return;
    const at = visible.findIndex((v) => v.transaction.id === pendingMove.id);
    if (at < 0) return;
    const to = positionAfter({ row: at, col: pendingMove.col }, pendingMove.move, visible.length);
    setPendingMove(null);
    moveTo(to.row, to.col, { edit: isEditMove(pendingMove.move) });
  });

  /** Moves the cursor after a save in the active cell. */
  function moveAfterSave(move: Move) {
    if (move === 'none') return;
    const to = positionAfter({ row: rowIndex, col: cursor.col }, move, visible.length);
    moveTo(to.row, to.col, { edit: isEditMove(move) });
  }

  /** Saves an already parsed value; a value in the draft row creates a new transaction. */
  async function saveCell(row: VisibleRow, col: number, value: NewTransaction[ColKey], move: Move) {
    const key = COLS[col].key;
    if (!row.draft) {
      const prev = row.transaction[key];
      if (isBlank(prev) ? !isBlank(value) : prev !== value) {
        updateTransaction(row.transaction.id, { [key]: value }, `edit ${COLS[col].label.toLowerCase()}`);
        pin(row.transaction.id);
      }
      moveAfterSave(move);
      return;
    }
    if (value == null) {
      setDraft((d) => ({ ...d, [key]: undefined }));
      moveAfterSave(move);
      return;
    }
    if (creatingDraft.current) return;
    creatingDraft.current = true;
    const fields = draftToNew(draft, key, value);
    // the value stays visible in the draft row while it is being saved
    setDraft((d) => ({ ...d, [key]: value }));
    try {
      // new rows go on top of the list (see withMissing); the next draft keeps the account
      const created = await createTransaction(fields, key);
      pin(created.id);
      setDraft({ accountId: created.accountId ?? undefined });
      // Enter stays on the new row; a click elsewhere ('none') already placed the cursor
      if (move !== 'none') setPendingMove({ id: created.id, col, move: move === 'down' ? 'none' : move });
    } finally {
      creatingDraft.current = false;
    }
  }

  /** Parses and saves text into a cell (paste, fill down). Returns an error message, or '' when saved. */
  async function saveText(row: VisibleRow, col: number, text: string): Promise<string> {
    const parsed = parseCell(COLS[col].key, text, row.transaction, lookup);
    if (!parsed.ok) return parsed.error;
    await saveCell(row, col, parsed.value, 'none');
    return '';
  }

  /** Saves the open editor. Returns false (and keeps the editor open with an error) when the value is invalid. */
  async function commit(move: Move, picked?: string): Promise<boolean> {
    if (!edit) return true;
    let text = picked ?? edit.text;
    if (picked == null && column.kind === 'suggest') {
      const options = suggestionsFor(column.key, edit.text, edit.touched, activeRow.transaction);
      if (options[edit.highlighted]) text = options[edit.highlighted].value;
    }
    const parsed = parseCell(column.key, text, activeRow.transaction, lookup);
    if (!parsed.ok) {
      setEdit({ ...edit, text, error: parsed.error });
      return false;
    }
    closingEditor.current = true;
    setEdit(null);
    if (move !== 'none') focusGrid();
    await saveCell(activeRow, cursor.col, parsed.value, move);
    return true;
  }

  function cancelEdit() {
    closingEditor.current = true;
    setEdit(null);
    focusGrid();
  }

  // ---------- row actions ----------
  function clearCell() {
    if (activeRow.draft) setDraft((d) => ({ ...d, [column.key]: undefined }));
    else if (!isBlank(activeRow.transaction[column.key])) {
      updateTransaction(activeRow.transaction.id, { [column.key]: null }, `clear ${column.label.toLowerCase()}`);
      pin(activeRow.transaction.id);
    }
  }

  function fillDown() {
    const source = activeRow.draft ? visible[1] : visible[rowIndex - 1];
    if (!source || source.draft) return;
    const v = source.transaction[column.key];
    if (isBlank(v) || v === activeRow.transaction[column.key]) return;
    void saveText(activeRow, cursor.col, editText(source.transaction, column.key, lookup, false));
  }

  /** Deletes the selected rows, or the active one. */
  function deleteRows() {
    const ids = new Set([...selectedRows].filter((id) => id !== DRAFT_ID) as TransactionId[]);
    if (!ids.size) return;
    removeTransactions(ids);
    showToast(`${ids.size === 1 ? 'Row' : plural(ids.size, 'row')} deleted`, {
      action: { label: 'Undo', shortcut: `${MOD_LABEL}Z`, run: () => void history('undo') },
    });
  }

  async function splitRow() {
    if (activeRow.draft) return;
    const source = activeRow.transaction.id;
    const row = await splitTransaction(source);
    placeSplit(source, row.id);
    pin(row.id);
    setCursor({ id: row.id, col: AMOUNT_COL, at: rowIndex + 1, edit: true });
    showToast('Split — enter the amount for the new row');
  }

  async function history(direction: 'undo' | 'redo') {
    const item = direction === 'undo' ? await undo() : await redo();
    if (!item) {
      showToast(`Nothing to ${direction}`);
      return;
    }
    const e = item.entry;
    const id = e.kind === 'update' ? e.id : e.kind === 'create' ? e.row.id : e.rows[0].id;
    pin(id);
    const col = COLS.findIndex((x) => x.key === item.column);
    setCursor({ id, col: col < 0 ? cursor.col : col, at: rowIndex });
    showToast(`${direction === 'undo' ? 'Undone' : 'Redone'}: ${item.label}`);
  }

  // ---------- clipboard (see ClipboardProxy) ----------
  const clipboardKey = (e: KeyboardEvent) =>
    startClipboardKey(
      e,
      clipboardBoxRef.current,
      activeRow.draft ? '' : editText(activeRow.transaction, column.key, lookup, false),
      focusGrid,
    );

  function paste(clipboardText: string) {
    // a block copied from a spreadsheet pastes its first cell
    let text = clipboardText.split(/\r?\n/)[0].split('\t')[0].trim();
    // amounts copied from a bank page may carry a currency sign
    if (column.key === 'amount' && parseAmount(text) === undefined) text = text.replace(/\p{Sc}/gu, '');
    void saveText(activeRow, cursor.col, text).then((error) => {
      // a pasted value shows in the cell; only a failure needs a message
      if (error)
        showToast(`Can’t paste “${text.length > 30 ? `${text.slice(0, 30)}…` : text}” into ${column.label}`, {
          warn: true,
        });
    });
  }

  // ---------- keys ----------
  // ⌘K works from anywhere on the page; an open editor is saved first (and stays open if its value is invalid)
  const openFind = async () => {
    if (await commit('none')) setFindOpen(true);
  };
  useWindowKeyDown(
    (e) => {
      if (!isMod(e) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      void openFind();
    },
    { capture: true },
  );

  function runCommand(command: GridCommand) {
    if (typeof command === 'object') return startEdit(command.typed);
    switch (command) {
      case 'edit':
        return startEdit();
      case 'clear':
        return clearCell();
      case 'deleteRow':
        return deleteRows();
      case 'splitRow':
        void splitRow();
        return;
      case 'undo':
      case 'redo':
        void history(command);
        return;
      case 'fillDown':
        return fillDown();
      case 'focusFilter':
        filterInputs.current[column.key]?.focus();
        filterInputs.current[column.key]?.select();
        return;
      case 'ignore':
        return;
    }
  }

  function onGridKey(e: KeyboardEvent<HTMLElement>, fromClipboardBox = false) {
    if ((e.target !== gridRef.current && !fromClipboardBox) || edit) return;
    if (clipboardKey(e)) return;
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const to = gridMove(e, { row: rowIndex, col: cursor.col }, visible.length);
    if (to) {
      e.preventDefault();
      // Shift+Tab moves left, it does not select
      selectTo(to.row, e.shiftKey && e.key !== 'Tab' ? 'extend' : 'only');
      moveTo(to.row, to.col);
      repeatGuard.moved();
      return;
    }
    const command = gridCommand(e);
    if (command) {
      e.preventDefault();
      runCommand(command);
    }
  }

  async function selectCell(row: number, col: number, e: MouseEvent | null, editNow: boolean) {
    if (edit && row === rowIndex && col === cursor.col) return;
    if (e && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      if (e.button === 0 && e.detail === 1) dragSelect(row);
    }
    const id = visible[row].transaction.id;
    // an invalid value keeps the editor where it is
    if (!(await commit('none'))) return;
    selectTo(row, e ? selectHow(e) : 'only');
    setCursor({ id, col, at: row, edit: editNow });
    focusGrid();
  }

  // ---------- jumping to a transaction (Find, Overview) ----------
  const { flashId, jumpTo } = useJumpToTransaction((id) => {
    // clear filters so the row is guaranteed to be visible
    setFilters({});
    setOnlyMissing(false);
    setPinned(new Set());
    setEdit(null);
    setCursor({ id, col: 0, at: 0, center: true });
  });

  // ---------- filters ----------
  function setFilter(key: ColKey, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPinned(new Set());
    setCursor((c) => ({ ...c, id: DRAFT_ID, at: 0 }));
  }

  /** The filter button on a recipient or category cell: only rows with the same value, staying on this row. */
  function quickFilter(row: VisibleRow, col: number) {
    const key = COLS[col].key;
    setFilter(key, displayText(row.transaction, key, lookup));
    setCursor({ id: row.transaction.id, col, at: 0 });
    focusGrid();
  }

  /** Esc in a filter clears it and returns to the same row; Enter / ↓ start from the top. */
  function leaveFilter(col: number, clear: boolean) {
    if (clear) {
      setFilters((f) => ({ ...f, [COLS[col].key]: '' }));
      setCursor((c) => ({ ...c, col }));
    } else setCursor({ id: DRAFT_ID, col, at: 0 });
    focusGrid();
  }

  function toggleOnlyMissing() {
    setOnlyMissing((on) => !on);
    setPinned(new Set());
    setCursor({ id: DRAFT_ID, col: CATEGORY_COL, at: 0 });
    focusGrid();
  }

  function clearFilters(keepNeedsAttention: boolean) {
    setFilters({});
    if (!keepNeedsAttention) setOnlyMissing(false);
    setPinned(new Set());
    focusGrid();
  }

  const accountFilter = (filters.accountId || '').trim();

  // ---------- summaries ----------
  const invalid = useMemo(() => transactions.filter((t) => !isValid(t)), [transactions]);
  // the last row needing attention just got fixed (or deleted)
  const invalidBefore = useRef(invalid.length);
  useEffect(() => {
    if (invalidBefore.current > 0 && invalid.length === 0) showToast('All rows fixed');
    invalidBefore.current = invalid.length;
  }, [invalid.length]);
  // rows needing attention that the account or column filters keep out of the list
  const hiddenInvalid = onlyMissing
    ? invalid.length - visible.filter((v) => !v.draft && !isValid(v.transaction)).length
    : 0;
  const anyFilter = onlyMissing || COLS.some((x) => (filters[x.key] || '').trim());

  // ---------- rendering ----------
  function renderCell(row: VisibleRow, index: number, col: number) {
    const cellColumn = COLS[col];
    const active = index === rowIndex && col === cursor.col;
    return (
      <GridCell
        key={cellColumn.key}
        row={row}
        column={cellColumn}
        id={`c-${index}-${col}`}
        active={active}
        lookup={lookup}
        onMouseDown={(e) => void selectCell(index, col, e, false)}
        onDoubleClick={() => void selectCell(index, col, null, true)}
        onQuickFilter={
          !row.draft && QUICK_FILTER_COLUMNS.includes(cellColumn.key) ? () => quickFilter(row, col) : undefined
        }
      >
        {active && edit ? (
          <CellEditor
            column={cellColumn}
            row={row.transaction}
            edit={edit}
            options={
              cellColumn.kind === 'suggest'
                ? suggestionsFor(cellColumn.key, edit.text, edit.touched, row.transaction)
                : []
            }
            onChange={setEdit}
            onCommit={(move, picked) => void commit(move, picked)}
            onCancel={cancelEdit}
            onBlur={() => {
              if (!closingEditor.current) void commit('none');
            }}
          />
        ) : null}
      </GridCell>
    );
  }

  return (
    <div className={s.root}>
      <PageHeader title="Transactions" />
      <main className={s.main}>
        <Toolbar
          total={transactions.length}
          shown={visible.length - 1}
          shownSum={anyFilter ? amountSummary(visible).sum : null}
          invalid={invalid}
          onlyMissing={onlyMissing}
          hiddenInvalid={hiddenInvalid}
          anyFilter={anyFilter}
          onFind={() => void openFind()}
          onToggleMissing={toggleOnlyMissing}
          onShowHidden={() => clearFilters(true)}
          onClearFilters={() => clearFilters(false)}
        />

        {transactions.length === 0 && (
          <div className={s.empty}>
            <span>No transactions yet. They arrive from the bank import.</span>
          </div>
        )}

        <AccountCards
          selected={accountFilter}
          onPick={(name) => {
            setFilter('accountId', name);
            focusGrid();
          }}
        />

        <ActiveRowBar
          row={activeRow}
          selection={selectedRows.size > 1 ? selectedSummary : null}
          onSplit={() => void splitRow()}
          onDelete={deleteRows}
        />

        <ClipboardProxy
          boxRef={clipboardBoxRef}
          onStrayKey={(e) => {
            focusGrid();
            onGridKey(e, true);
          }}
          onCopied={() => {
            focusGrid();
            showToast(`Copied ${column.label.toLowerCase()}`);
          }}
          onCut={() => {
            clearCell();
            focusGrid();
            showToast(`Cut ${column.label.toLowerCase()}`);
          }}
          onPaste={(text) => {
            focusGrid();
            paste(text);
          }}
        />
        <TransactionsGrid
          rows={visible}
          rowIndex={rowIndex}
          col={cursor.col}
          center={cursor.center}
          selectedRows={selectedRows}
          flashId={flashId}
          scrollRef={scrollRef}
          gridRef={gridRef}
          onKeyDown={onGridKey}
          header={
            <GridHeader
              filters={filters}
              sortBy={sortBy}
              filterRef={(key, el) => {
                filterInputs.current[key] = el;
              }}
              onToggleSort={toggleSort}
              onFilterChange={setFilter}
              onFilterLeave={leaveFilter}
            />
          }
          renderCell={renderCell}
        />
      </main>
      {findOpen && (
        <FindDialog
          rows={transactions}
          lookup={lookup}
          onClose={() => {
            setFindOpen(false);
            focusGrid();
          }}
          onPick={(id) => {
            setFindOpen(false);
            focusGrid();
            jumpTo(id);
          }}
        />
      )}
    </div>
  );
}
