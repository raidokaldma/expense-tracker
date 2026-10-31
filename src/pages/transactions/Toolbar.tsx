import type { Transaction } from '../../../shared/types';
import { cx } from '../../components/cx';
import { FindButton } from '../../components/FindButton';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import { missingFields, REQUIRED_FIELDS, REQUIRED_LABELS } from '../../model/validity';
import s from './Toolbar.module.css';

interface Props {
  total: number;
  shown: number;
  /** The shown rows' amounts added up, while a filter is on. */
  shownSum: number | null;
  /** Rows missing a required field. */
  invalid: Transaction[];
  /** The "needs attention" filter is on. */
  onlyMissing: boolean;
  /** Rows needing attention that other filters keep out of the list. */
  hiddenInvalid: number;
  anyFilter: boolean;
  onFind: () => void;
  onToggleMissing: () => void;
  /** Clears the other filters, keeping "needs attention". */
  onShowHidden: () => void;
  onClearFilters: () => void;
}

/** Counts, Find, the "needs attention" filter and Clear filters, above the grid. */
export function Toolbar(props: Props) {
  const count = props.invalid.length;
  return (
    <div className={s.top}>
      <div>
        <p className="subtitle">
          {plural(props.total, 'transaction')} · {props.shown} shown
          {props.shownSum != null && <> · sum {formatAmount(props.shownSum)}</>}
        </p>
        {props.hiddenInvalid > 0 && (
          <div className={s.hiddenNote} role="status">
            <span>
              {props.hiddenInvalid === 1
                ? '1 row needing attention is hidden by filters'
                : `${props.hiddenInvalid} rows needing attention are hidden by filters`}
            </span>
            <span aria-hidden="true"> · </span>
            <button type="button" onClick={props.onShowHidden}>
              Show them
            </button>
          </div>
        )}
      </div>
      <div className={s.actions}>
        <FindButton className="btn" onClick={props.onFind} />
        {(count > 0 || props.onlyMissing) && (
          <button
            type="button"
            className={cx('btn', count ? s.warn : s.done, props.onlyMissing && s.on)}
            aria-pressed={props.onlyMissing}
            title={missingSummary(props.invalid)}
            onClick={props.onToggleMissing}
          >
            {count === 0 ? 'Show all rows' : count === 1 ? '1 row needs attention' : `${count} rows need attention`}
          </button>
        )}
        {props.anyFilter && (
          <button type="button" className="btn" onClick={props.onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

/** "3 category · 1 amount missing" */
function missingSummary(invalid: Transaction[]) {
  if (!invalid.length) return 'All rows complete';
  const parts = REQUIRED_FIELDS.map((field) => {
    const n = invalid.filter((t) => missingFields(t).includes(field)).length;
    return n ? `${n} ${REQUIRED_LABELS[field]}` : '';
  }).filter(Boolean);
  return `${parts.join(' · ')} missing`;
}
