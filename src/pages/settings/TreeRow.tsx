import type { MouseEvent, ReactNode } from 'react';
import { cx } from '../../components/cx';
import type { ChangeTag } from './categoryChanges';
import list from './list.module.css';

interface Props {
  id: string;
  level: 1 | 2;
  selected: boolean;
  tag: ChangeTag;
  /** The name, or the field renaming it. */
  name: ReactNode;
  actions: ReactNode;
  /** After the actions, such as the group's type. */
  extra?: ReactNode;
  /** Under the row: an error, a picker, a group's categories. */
  children?: ReactNode;
  onMouseDown: (e: MouseEvent) => void;
  onDoubleClick: () => void;
}

/** A group (level 1) or category (level 2) line of the Settings tree. */
export function TreeRow({
  id,
  level,
  selected,
  tag,
  name,
  actions,
  extra,
  children,
  onMouseDown,
  onDoubleClick,
}: Props) {
  return (
    <div>
      <div
        className={cx(level === 1 ? list.groupRow : list.categoryRow, selected && list.selected)}
        id={`r-${id}`}
        role="treeitem"
        aria-level={level}
        aria-expanded={level === 1 ? 'true' : undefined}
        aria-selected={selected}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      >
        {name}
        {tag && <span className={list.tag}>{tag}</span>}
        <span className={list.spacer} />
        <span className={list.rowActions}>{actions}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}
