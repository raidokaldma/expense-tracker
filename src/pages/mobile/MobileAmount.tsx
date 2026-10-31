import { cx } from '../../components/cx';
import { formatAmount } from '../../model/money';

/** A sum, or a dash when no transactions make it up. */
export function MobileAmount({ value, count }: { value: number; count: number }) {
  if (!count) return <span className="mono">–</span>;
  return <span className={cx('mono', value > 0 && 'pos')}>{formatAmount(value)}</span>;
}
