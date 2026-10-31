import { type RefObject, useEffect, useMemo, useState } from 'react';
import { keepInWindow } from '../../components/scroll';
import { type EditableCategory, type EditableGroup, groupsInOrder } from './categoryTree';

/** A line of the tree: a group or one of its categories. */
export type TreeLine =
  | { type: 'group'; id: string; group: EditableGroup }
  | { type: 'category'; id: string; group: EditableGroup; category: EditableCategory };

/** The tree's lines in display order and the selected one, kept in view as it changes. */
export function useTreeSelection(tree: EditableGroup[], listRef: RefObject<HTMLDivElement | null>) {
  const [selectedId, setSelectedId] = useState<string | null>(tree[0]?.id ?? null);

  const lines: TreeLine[] = useMemo(
    () =>
      groupsInOrder(tree).flatMap((group) => [
        { type: 'group' as const, id: group.id, group },
        ...group.categories.map((category) => ({ type: 'category' as const, id: category.id, group, category })),
      ]),
    [tree],
  );
  const index = Math.max(
    0,
    lines.findIndex((line) => line.id === selectedId),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after the selection has been drawn
  useEffect(() => {
    keepInWindow(listRef.current?.querySelector('[role="treeitem"][aria-selected="true"]'));
  }, [selectedId]);

  return {
    lines,
    selectedId,
    select: setSelectedId,
    index,
    selected: lines[index] as TreeLine | undefined,

    /** The line that takes the selection when `id` goes away: the next one, else the one before. */
    neighbourOf(id: string) {
      const i = lines.findIndex((line) => line.id === id);
      return (lines[i + 1] ?? lines[i - 1])?.id ?? null;
    },
  };
}
