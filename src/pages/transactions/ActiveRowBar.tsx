import { isMac } from '../../keys/keys';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import type { AmountSummary } from './amountSummary';
import s from './transactions.module.css';
import type { VisibleRow } from './visibleRows';

interface Props {
  row: VisibleRow;
  /** The selected rows, when more than one cell is selected. */
  selection: AmountSummary | null;
  onSplit: () => void;
  onDelete: () => void;
}

/** The active row (or the selected rows' sum) in words, with the bank's id, and the row's Split and Delete buttons. */
export function ActiveRowBar({ row, selection, onSplit, onDelete }: Props) {
  const { transaction } = row;
  const amount = transaction.amount == null ? 'no amount' : formatAmount(transaction.amount);
  const info = selection
    ? `${plural(selection.count, 'row')} selected · ${formatAmount(selection.sum)}`
    : row.draft
      ? 'New row'
      : [
          `Row ${row.number}`,
          transaction.counterparty || 'no recipient',
          amount,
          transaction.externalId && `ID ${transaction.externalId}`,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <div className={s.rowbar} role="group" aria-label="Active row">
      <span className={s.rbinfo}>{info}</span>
      <span className={s.grow} />
      {/* the buttons keep focus in the grid */}
      <button
        type="button"
        className="btn sm"
        disabled={row.draft}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSplit}
      >
        Split <span className="kbd">{isMac ? '⌘⇧S' : 'Ctrl+Shift+S'}</span>
      </button>
      <button
        type="button"
        className="btn sm danger"
        disabled={row.draft && !selection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDelete}
      >
        {selection ? `Delete ${plural(selection.count, 'row')}` : 'Delete'}{' '}
        <span className="kbd">{isMac ? '⌘⌫' : 'Ctrl+⌫'}</span>
      </button>
    </div>
  );
}
