import type { OverviewPeriod } from '../../../shared/types';
import { cx } from '../../components/cx';
import s from './PeriodPicker.module.css';

const PERIODS: [OverviewPeriod, string][] = [
  ['last3', 'Last 3 months'],
  ['last12', 'Last 12 months'],
  ['all', 'All'],
];

export function nextPeriod(period: OverviewPeriod): OverviewPeriod {
  const i = PERIODS.findIndex(([p]) => p === period);
  return PERIODS[(i + 1) % PERIODS.length][0];
}

export function PeriodPicker({ period, onPick }: { period: OverviewPeriod; onPick: (period: OverviewPeriod) => void }) {
  return (
    <div className={s.group}>
      <span className={s.controlLabel} id="period-label">
        Period
      </span>
      <div className={s.segmented} role="group" aria-labelledby="period-label">
        {PERIODS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cx(period === id && s.pressed)}
            aria-pressed={period === id}
            onClick={() => onPick(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="kbd" title="Press P to switch period">
        P
      </span>
    </div>
  );
}
