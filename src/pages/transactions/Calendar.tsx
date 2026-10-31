import {
  daysInMonth,
  firstWeekdayOfMonth,
  type LocalParts,
  localDateKey,
  MONTH_NAMES,
  nowLocal,
  pad2,
} from '../../../shared/time';
import { cx } from '../../components/cx';
import s from './Calendar.module.css';
import dropdown from './dropdown.module.css';

/** Month calendar under the date editor; the day picked is saved straight away. */
export function Calendar(props: {
  value: LocalParts;
  opensUp: boolean;
  typing: boolean;
  onPick: (y: number, mo: number, d: number) => void;
}) {
  const { y, mo, d } = props.value;
  const today = localDateKey(nowLocal());
  const blanksBefore = firstWeekdayOfMonth(y, mo);
  const days = Array.from({ length: daysInMonth(y, mo) }, (_, i) => i + 1);
  return (
    <div
      className={cx(dropdown.dropdown, s.calendar, props.opensUp && dropdown.opensUp)}
      role="group"
      aria-label="Date picker"
    >
      <div className={s.calendarHeader}>
        <span>
          {MONTH_NAMES[mo - 1]} {y}
        </span>
        <span className="mono">
          {pad2(props.value.h)}:{pad2(props.value.mi)}
        </span>
      </div>
      <div className={cx(s.calendarGrid, s.weekdays)} aria-hidden="true">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className={s.calendarGrid}>
        {blanksBefore > 0 && <span style={{ gridColumn: `span ${blanksBefore}` }} />}
        {days.map((day) => (
          <button
            key={day}
            type="button"
            tabIndex={-1}
            className={cx(s.day, day === d && s.picked, `${y}-${pad2(mo)}-${pad2(day)}` === today && s.today)}
            onMouseDown={(e) => {
              e.preventDefault();
              props.onPick(y, mo, day);
            }}
          >
            {day}
          </button>
        ))}
      </div>
      {props.typing ? (
        <div className={s.dropdownHelp}>↓ back to the calendar</div>
      ) : (
        <div className={s.dropdownHelp}>
          PgUp/PgDn month · <span className="mono">t</span> today · <span className="mono">y</span> yesterday · or start
          typing, e.g. <span className="mono">20.10 14:30</span>
        </div>
      )}
    </div>
  );
}
