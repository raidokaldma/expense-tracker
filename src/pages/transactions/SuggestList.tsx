import { useLayoutEffect, useRef } from 'react';
import { cx } from '../../components/cx';
import { keepInView } from '../../components/scroll';
import dropdown from './dropdown.module.css';
import { NOTHING_HIGHLIGHTED, type Option } from './editState';
import s from './SuggestList.module.css';

const LEVEL_LABEL = { high: 'High', med: 'Medium', low: 'Low' };

export function SuggestList(props: {
  options: Option[];
  highlighted: number;
  opensUp: boolean;
  label: string;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // keeps the highlighted option inside the dropdown's scroll area
  useLayoutEffect(() => {
    const pop = ref.current;
    if (pop && props.highlighted === NOTHING_HIGHLIGHTED) pop.scrollTop = 0;
    else keepInView(pop, pop?.querySelector('[aria-selected="true"]'), 4);
  }, [props.highlighted]);
  if (!props.options.length) return null;
  return (
    <div
      ref={ref}
      className={cx(dropdown.dropdown, props.opensUp && dropdown.opensUp)}
      id="suggest-list"
      role="listbox"
      aria-label={`${props.label} suggestions`}
    >
      {props.options.map((o, i) => {
        const suggested = o.confidence != null;
        const prevSuggested = i > 0 && props.options[i - 1].confidence != null;
        const header =
          suggested && i === 0 ? 'Suggested for this row' : !suggested && prevSuggested ? 'All categories' : '';
        const percent = suggested ? `${Math.round(o.confidence! * 100)}%` : '';
        return (
          <div key={`${suggested ? 'sug:' : ''}${o.isNew ? 'new:' : ''}${o.value}`}>
            {header && (
              <div className={s.optionHeader} role="presentation">
                {header}
              </div>
            )}
            <div
              className={cx(
                s.option,
                i === props.highlighted && s.highlighted,
                o.isNew && s.new,
                suggested && s.suggested,
              )}
              id={`opt-${i}`}
              role="option"
              aria-selected={i === props.highlighted}
              aria-label={suggested ? `${o.label}, suggested, ${LEVEL_LABEL[o.level!]} confidence ${percent}` : o.label}
              onMouseDown={(e) => {
                e.preventDefault();
                props.onPick(i);
              }}
            >
              <span className={s.optionLabel}>{o.label}</span>
              {suggested ? (
                <span className={cx(s.confidence, s[o.level!])} title={`${LEVEL_LABEL[o.level!]} confidence`}>
                  {percent}
                </span>
              ) : (
                <span className={s.hint}>{o.hint}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
