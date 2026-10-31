import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NewTransaction } from '../../../shared/types';
import { FindDialog } from '../../components/FindDialog';
import { PageHeader } from '../../components/PageHeader';
import { selectHow } from '../../components/selection';
import { useDragSelect } from '../../components/useDragSelect';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import { useModShortcut } from '../../keys/useWindowKeyDown';
import { useStore } from '../../store/store';
import { showToast } from '../../store/toast';
import { AccountCards } from './AccountCards';
import { ActiveRowBar } from './ActiveRowBar';
import { amountSummary } from './amountSummary';
import { CellEditor } from './CellEditor';
import { ClipboardProxy, startClipboardKey } from './ClipboardProxy';
import { CATEGORY_COL, COLS, type ColKey, DRAFT_ID, displayText, editText, pastedText } from './columns';
import { GridCell } from './GridCell';
import { GridHeader } from './GridHeader';
import { type GridCommand, gridCommand, gridMove } from './gridKeys';
import { Toolbar } from './Toolbar';
import { TransactionsGrid } from './TransactionsGrid';
import s from './TransactionsPage.module.css';
import { useCellEditor } from './useCellEditor';
import { useCellSaving } from './useCellSaving';
import { useGridCursor } from './useGridCursor';
import { useGridFilters } from './useGridFilters';
import { useInvalidRows } from './useInvalidRows';
import { useJumpToTransaction } from './useJumpToTransaction';
import { useRowActions } from './useRowActions';
import { useRowOrder } from './useRowOrder';
import { useRowSelection } from './useRowSelection';
import { type VisibleRow, visibleRows } from './visibleRows';

/** Columns whose cells offer a filter button on hover. */
const QUICK_FILTER_COLUMNS: ColKey[] = ['counterparty', 'categoryId'];

export function TransactionsPage() {
  const transactions = useStore((st) => st.transactions);
  const lookup = useStore((st) => st.lookup);
  const sortBy = useStore((st) => st.preferences.transactionSort);

  const { order, toggleSort, placeSplit } = useRowOrder(transactions, sortBy);
  const filtering = useGridFilters();
  const { filters, onlyMissing, pinned, pin } = filtering;
  const [findOpen, setFindOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clipboardBoxRef = useRef<HTMLTextAreaElement>(null);
  const filterInputs = useRef<Partial<Record<ColKey, HTMLInputElement | null>>>({});
  const repeatGuard = useRepeatGuard();

  const [draft, setDraft] = useState<Partial<NewTransaction>>({});
  const visible = useMemo(
    () => visibleRows({ transactions, order, filters, onlyMissing, pinned, draft, lookup }),
    [transactions, order, filters, onlyMissing, pinned, draft, lookup],
  );
  const { cursor, setCursor, rowIndex, activeRow, column, moveTo, moveAfterSave, moveOnceShown, clearEditRequest } =
    useGridCursor(visible);
  const { isCreatingDraft, saveCell, saveText, clearCell } = useCellSaving({
    lookup,
    draft,
    setDraft,
    pin,
    moveAfterSave,
    moveOnceShown,
  });

  const { selectedRows, selectedSummary, selectTo } = useRowSelection(visible, activeRow.transaction.id);
  const { invalid, hiddenInvalid } = useInvalidRows(transactions, visible, onlyMissing);

  // dragging from a row selects the rows passed over, as Shift+click would
  const dragSelect = useDragSelect(
    scrollRef,
    (el) => (el.dataset.row == null ? null : Number(el.dataset.row)),
    (row) => {
      if (editor.isEditing) return;
      selectTo(row, 'extend');
      moveTo(row, cursor.col);
    },
  );

  const focusGrid = useCallback(() => gridRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    focusGrid();
  }, [focusGrid]);

  const editor = useCellEditor({
    activeRow,
    col: cursor.col,
    lookup,
    scrollRef,
    focusGrid,
    editRequested: !!cursor.edit,
    clearEditRequest,
    isCreatingDraft,
    saveCell,
  });

  const { fillDown, deleteRows, splitRow, undoOrRedo } = useRowActions({
    visible,
    rowIndex,
    col: cursor.col,
    selectedRows,
    lookup,
    setCursor,
    pin,
    placeSplit,
    saveText,
  });

  const clipboardKey = (e: KeyboardEvent) =>
    startClipboardKey(
      e,
      clipboardBoxRef.current,
      activeRow.draft ? '' : editText(activeRow.transaction, column.key, lookup),
      focusGrid,
    );

  function paste(clipboardText: string) {
    const text = pastedText(clipboardText, column.key);
    void saveText(activeRow, cursor.col, text).then((result) => {
      // a pasted value shows in the cell; only a failure needs a message
      if (result === 'saved') return;
      const shown = text.length > 30 ? `${text.slice(0, 30)}…` : text;
      showToast(`Can’t paste “${shown}” into ${column.label}`, { warn: true });
    });
  }

  // an open editor is saved first (and stays open if its value is invalid)
  const openFind = async () => {
    if (await editor.commit('none')) setFindOpen(true);
  };
  useModShortcut('k', () => void openFind());

  function runCommand(command: GridCommand) {
    if (typeof command === 'object') return editor.start(command.typed);
    switch (command) {
      case 'edit':
        return editor.start();
      case 'clear':
        return clearCell(activeRow, cursor.col);
      case 'deleteRow':
        return deleteRows();
      case 'splitRow':
        void splitRow();
        return;
      case 'undo':
      case 'redo':
        void undoOrRedo(command);
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
    if ((e.target !== gridRef.current && !fromClipboardBox) || editor.isEditing) return;
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

  async function selectCell(row: number, col: number, e: MouseEvent | null, { editNow = false } = {}) {
    if (editor.isEditing && row === rowIndex && col === cursor.col) return;
    if (e && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      if (e.button === 0 && e.detail === 1) dragSelect(row);
    }
    const id = visible[row].transaction.id;
    // an invalid value keeps the editor where it is
    if (!(await editor.commit('none'))) return;
    selectTo(row, e ? selectHow(e) : 'only');
    setCursor({ id, col, at: row, edit: editNow });
    focusGrid();
  }

  const { flashId, jumpTo } = useJumpToTransaction((id) => {
    // clear filters so the row is guaranteed to be visible
    filtering.clearAll();
    editor.discard();
    setCursor({ id, col: 0, at: 0, center: true });
  });

  function setFilter(key: ColKey, value: string) {
    filtering.setFilter(key, value);
    setCursor((c) => ({ ...c, id: DRAFT_ID, at: 0 }));
  }

  /** The filter button on a recipient or category cell: only rows with the same value, staying on this row. */
  function quickFilter(row: VisibleRow, col: number) {
    const key = COLS[col].key;
    filtering.setFilter(key, displayText(row.transaction, key, lookup));
    setCursor({ id: row.transaction.id, col, at: 0 });
    focusGrid();
  }

  /** Esc in a filter clears it and returns to the same row; Enter / ↓ start from the top. */
  function leaveFilter(col: number, clear: boolean) {
    if (clear) {
      filtering.clearFilter(COLS[col].key);
      setCursor((c) => ({ ...c, col }));
    } else setCursor({ id: DRAFT_ID, col, at: 0 });
    focusGrid();
  }

  function toggleOnlyMissing() {
    filtering.toggleOnlyMissing();
    setCursor({ id: DRAFT_ID, col: CATEGORY_COL, at: 0 });
    focusGrid();
  }

  function clearFilters(options?: { keepOnlyMissing: boolean }) {
    filtering.clearAll(options);
    focusGrid();
  }

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
        onMouseDown={(e) => void selectCell(index, col, e)}
        onDoubleClick={() => void selectCell(index, col, null, { editNow: true })}
        onQuickFilter={
          !row.draft && QUICK_FILTER_COLUMNS.includes(cellColumn.key) ? () => quickFilter(row, col) : undefined
        }
      >
        {active && editor.editorProps && <CellEditor {...editor.editorProps} />}
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
          shownSum={filtering.anyFilter ? amountSummary(visible).sum : null}
          invalid={invalid}
          onlyMissing={onlyMissing}
          hiddenInvalid={hiddenInvalid}
          anyFilter={filtering.anyFilter}
          onFind={() => void openFind()}
          onToggleMissing={toggleOnlyMissing}
          onShowHidden={() => clearFilters({ keepOnlyMissing: true })}
          onClearFilters={() => clearFilters()}
        />

        {transactions.length === 0 && (
          <div className={s.empty}>
            <span>No transactions yet. They arrive from the bank import.</span>
          </div>
        )}

        <AccountCards
          selected={(filters.accountId || '').trim()}
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
            clearCell(activeRow, cursor.col);
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
