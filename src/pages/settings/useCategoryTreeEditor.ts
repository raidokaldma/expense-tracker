import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryId } from '../../../shared/types';
import { countBy } from '../../model/countBy';
import { saveCategories } from '../../store/settings';
import { useStore } from '../../store/store';
import { describeChanges } from './categoryChanges';
import { type EditableGroup, editableTree, type Reassignment, removeCategory, toSaveRequest } from './categoryTree';

/** An edited copy of the category tree; nothing is stored until save. */
export function useCategoryTreeEditor() {
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);
  const transactions = useStore((st) => st.transactions);

  const saved = useMemo(() => editableTree(groups, categories), [groups, categories]);
  const savedCounts = useMemo(() => countBy(transactions, (t) => t.categoryId), [transactions]);

  const [tree, setTree] = useState<EditableGroup[]>(saved);
  const [moves, setMoves] = useState<Reassignment[]>([]);
  // unsaved edits survive a reload of the data; only save, discard or untouched state take the stored tree
  const edited = useRef(false);

  useEffect(() => {
    if (edited.current) return;
    setTree(saved);
    setMoves([]);
  }, [saved]);

  // the tree edits return the same tree when there is nothing to change (e.g. moving the top row up)
  function change(next: EditableGroup[], nextMoves = moves) {
    if (next === tree && nextMoves === moves) return;
    edited.current = true;
    setTree(next);
    setMoves(nextMoves);
  }

  const changes = useMemo(() => describeChanges(saved, tree, moves), [saved, tree, moves]);

  return {
    saved,
    tree,
    changes,
    change,

    /** Transactions in the category on save: its own, plus those of deleted categories headed for it. */
    countFor: (id: CategoryId) =>
      (savedCounts.get(id) || 0) + moves.filter((m) => m.toId === id).reduce((sum, m) => sum + m.count, 0),

    /** Deletes a category; its transactions go to `toId`, or become uncategorized. */
    deleteCategory(id: CategoryId, toId: CategoryId | null) {
      // transactions already headed for this category follow it to its replacement
      let nextMoves = moves.map((m) => (m.toId === id && toId ? { ...m, toId } : m)).filter((m) => m.toId !== id);
      const own = savedCounts.get(id) || 0;
      if (toId && own) nextMoves = [...nextMoves, { fromId: id, toId, count: own }];
      change(removeCategory(tree, id), nextMoves);
    },

    async save() {
      // the reloaded tree becomes the new starting point
      edited.current = false;
      await saveCategories(toSaveRequest(tree, moves));
    },

    discard() {
      edited.current = false;
      setTree(saved);
      setMoves([]);
    },
  };
}
