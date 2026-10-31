import { Icon } from '../../components/icons';
import s from './MonthBar.module.css';

interface Props {
  title: string;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}

export function MonthBar({ title, onPrevious, onNext }: Props) {
  return (
    <div className={s.monthbar}>
      <button type="button" aria-label="Previous month" disabled={!onPrevious} onClick={onPrevious ?? undefined}>
        <Icon name="caret" size={20} weight={2.2} />
      </button>
      <h2>{title}</h2>
      <button type="button" aria-label="Next month" disabled={!onNext} onClick={onNext ?? undefined}>
        <Icon name="caret" size={20} weight={2.2} />
      </button>
    </div>
  );
}
