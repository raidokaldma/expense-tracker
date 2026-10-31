import { useState } from 'react';
import { newCategoryGroupId, newCategoryId } from '../../../shared/ids';
import type { CategoryGroupId, CategoryKind } from '../../../shared/types';
import { addCategory, addGroup, type EditableGroup, nameError, renameItem } from './categoryTree';
import type { TreeLine } from './useTreeSelection';

/** Renaming a group or category in place. */
interface Rename {
  id: string;
  text: string;
  error: string;
}

/** The add row under a group (new category) or under a section (new group). */
export type Adding =
  | { type: 'category'; groupId: CategoryGroupId; text: string; error: string }
  | { type: 'group'; kind: CategoryKind; text: string; error: string };

export function addingCategory(groupId: CategoryGroupId): Adding {
  return { type: 'category', groupId, text: '', error: '' };
}

export function addingGroup(kind: CategoryKind): Adding {
  return { type: 'group', kind, text: '', error: '' };
}

interface Options {
  tree: EditableGroup[];
  lines: TreeLine[];
  change: (tree: EditableGroup[]) => void;
  select: (id: string) => void;
  focusList: () => void;
}

/** The name fields of the tree: renaming a line, and adding a group or category. */
export function useNameEditing({ tree, lines, change, select, focusList }: Options) {
  const [rename, setRename] = useState<Rename | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);

  function close() {
    setRename(null);
    setAdding(null);
  }

  function cancel() {
    close();
    focusList();
  }

  function commitAdd() {
    if (!adding) return;
    const name = adding.text.trim();
    if (!name) return cancel();
    const error = nameError(tree, adding.text, null);
    if (error) return setAdding({ ...adding, error });
    if (adding.type === 'category') {
      const id = newCategoryId();
      change(addCategory(tree, adding.groupId, { id, name }));
      select(id);
      // stay in the input to add the next category quickly
      setAdding({ ...adding, text: '' });
    } else {
      const id = newCategoryGroupId();
      change(addGroup(tree, { id, name, kind: adding.kind, categories: [] }));
      select(id);
      // a new group goes straight on to its first category
      setAdding(addingCategory(id));
    }
  }

  return {
    rename,
    adding,
    close,
    cancel,
    commitAdd,

    startRename(id: string) {
      const line = lines.find((l) => l.id === id);
      if (!line) return;
      select(id);
      setAdding(null);
      setRename({ id, text: line.type === 'group' ? line.group.name : line.category.name, error: '' });
    },

    commitRename({ cancelOnError }: { cancelOnError: boolean }) {
      if (!rename) return;
      const error = nameError(tree, rename.text, rename.id);
      if (error) return setRename(cancelOnError ? null : { ...rename, error });
      setRename(null);
      change(renameItem(tree, rename.id, rename.text.trim()));
      focusList();
    },

    startAdding(next: Adding) {
      setRename(null);
      setAdding(next);
    },

    setRenameText: (text: string) => setRename((r) => r && { ...r, text, error: '' }),
    setAddingText: (text: string) => setAdding((a) => a && { ...a, text, error: '' }),

    /** Leaving the add field keeps a valid name and drops anything else. */
    blurAdding() {
      if (!adding) return;
      if (!adding.text.trim() || nameError(tree, adding.text, null)) setAdding(null);
      else commitAdd();
    },
  };
}
