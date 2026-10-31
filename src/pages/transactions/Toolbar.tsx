import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import { isMac } from '../../keys/keys';
import { formatAmount } from '../../model/money';
import { plural } from '../../model/plural';
import type { Transaction } from '../../model/types';
import { missingFields, REQUIRED_FIELDS, REQUIRED_LABELS } from '../../model/validity';
import s from './transactions.module.css';

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
export function Toolbar(p: Props) {
  const count = p.invalid.length;
  return (
    <div className={s.top}>
      <div>
        <p className="subtitle">
          {plural(p.total, 'transaction')} · {p.shown} shown
          {p.shownSum != null && <> · sum {formatAmount(p.shownSum)}</>}
        </p>
        {p.hiddenInvalid > 0 && (
          <div className={s.hidnote} role="status">
            <span>
              {p.hiddenInvalid === 1
                ? '1 row needing attention is hidden by filters'
                : `${p.hiddenInvalid} rows needing attention are hidden by filters`}
            </span>
            <span aria-hidden="true"> · </span>
            <button type="button" onClick={p.onShowHidden}>
              Show them
            </button>
          </div>
        )}
      </div>
      <div className={s.actions}>
        <button
          type="button"
          className="btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={p.onFind}
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        >
          <Icon name="search" />
          Find <span className="kbd">{isMac ? '⌘K' : 'Ctrl+K'}</span>
        </button>
        {(count > 0 || p.onlyMissing) && (
          <button
            type="button"
            className={cx('btn', count ? s.warn : s.done, p.onlyMissing && s.on)}
            aria-pressed={p.onlyMissing}
            title={missingSummary(p.invalid)}
            onClick={p.onToggleMissing}
          >
            {count === 0 ? 'Show all rows' : count === 1 ? '1 row needs attention' : `${count} rows need attention`}
          </button>
        )}
        {p.anyFilter && (
          <button type="button" className="btn" onClick={p.onClearFilters}>
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
