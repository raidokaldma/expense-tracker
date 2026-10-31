import { MOD_LABEL, SHIFT_LABEL } from '../../keys/keys';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import s from './ActiveRowBar.module.css';
import type { AmountSummary } from './amountSummary';
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
    <div className={s.rowBar} role="group" aria-label="Active row">
      <span className={s.rowBarInfo}>{info}</span>
      <span className={s.spacer} />
      {/* the buttons keep focus in the grid */}
      <button
        type="button"
        className="btn sm"
        disabled={row.draft}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSplit}
      >
        Split{' '}
        <span className="kbd">
          {MOD_LABEL}
          {SHIFT_LABEL}S
        </span>
      </button>
      <button
        type="button"
        className="btn sm danger"
        disabled={row.draft && !selection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDelete}
      >
        {selection ? `Delete ${plural(selection.count, 'row')}` : 'Delete'} <span className="kbd">{MOD_LABEL}⌫</span>
      </button>
    </div>
  );
}
