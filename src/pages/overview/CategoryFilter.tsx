import { useEffect, useRef } from 'react';
import { cx } from '../../components/cx';
import { Icon } from '../../components/icons';
import type { Category, CategoryGroup, CategoryId } from '../../model/types';
import s from './overview.module.css';

interface Props {
  open: boolean;
  onOpen: () => void;
  /** Closed on purpose: Esc or the button. */
  onCancel: () => void;
  /** Focus left the list. */
  onDismiss: () => void;
  /** Groups with their categories, as listed in Settings. */
  tree: { group: CategoryGroup; categories: Category[] }[];
  hidden: ReadonlySet<CategoryId>;
  /** Hides the categories, or shows them again when all of them are hidden. */
  onToggle: (ids: CategoryId[]) => void;
  onShowAll: () => void;
}

/** "Categories" and the checklist under it that chooses which categories Overview shows (F). */
export function CategoryFilter({ open, onOpen, onCancel, onDismiss, tree, hidden, onToggle, onShowAll }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // only categories in the list count; hidden ids can name categories left out of it
  const hiddenCount = tree.flatMap((x) => x.categories).filter((c) => hidden.has(c.id)).length;
  const panelRef = useRef<HTMLDivElement>(null);

  // the checklist takes focus when it opens, and closes when focus leaves it
  useEffect(() => {
    if (open) panelRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div
      className={s.catfilter}
      ref={rootRef}
      onBlur={(e) => {
        if (!open || (e.relatedTarget && rootRef.current?.contains(e.relatedTarget as Node))) return;
        onDismiss();
      }}
    >
      <button
        type="button"
        className={cx(s.tbtn, open && s.on)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={open ? onCancel : onOpen}
        title="Choose categories (F)"
      >
        <Icon name="filter" />
        Categories
        {hiddenCount > 0 && <span className={s.fbadge}>{hiddenCount} hidden</span>}
      </button>
      {open && (
        <div
          className={s.fpanel}
          role="dialog"
          aria-label="Show or hide categories"
          tabIndex={-1}
          ref={panelRef}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        >
          <div className={s.fhead}>
            <span>Show in Overview</span>
            <button type="button" className={s.tbtn} disabled={!hiddenCount} onClick={onShowAll}>
              Select all
            </button>
          </div>
          <div className={s.flist}>
            {tree.map(({ group, categories }) => {
              const shown = categories.filter((c) => !hidden.has(c.id)).length;
              return (
                <div key={group.id}>
                  <label className={s.fgrp}>
                    <input
                      type="checkbox"
                      checked={shown === categories.length}
                      ref={(el) => {
                        if (el) el.indeterminate = shown > 0 && shown < categories.length;
                      }}
                      onChange={() => onToggle(categories.map((c) => c.id))}
                    />
                    <span>{group.name}</span>
                    <span className={s.fcount}>
                      {shown}/{categories.length}
                    </span>
                  </label>
                  {categories.map((c) => (
                    <label key={c.id} className={s.fcat}>
                      <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => onToggle([c.id])} />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
