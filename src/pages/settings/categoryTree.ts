import { sameName } from '../../../shared/names';
import type {
  Category,
  CategoryChange,
  CategoryGroup,
  CategoryGroupId,
  CategoryId,
  CategoryKind,
} from '../../../shared/types';
import { CATEGORY_KINDS } from '../../../shared/types';
import { sortedTree } from '../../model/lookup';

// The Settings page edits a copy of the category tree; nothing is stored until Save.

export interface EditableCategory {
  id: CategoryId;
  name: string;
}

export interface EditableGroup {
  id: CategoryGroupId;
  name: string;
  kind: CategoryKind;
  categories: EditableCategory[];
}

/** A deleted category whose transactions go to another category on Save. */
export interface Reassignment {
  fromId: CategoryId;
  toId: CategoryId;
  count: number;
}

export const SECTION_TITLES: Record<CategoryKind, string> = {
  income: 'Income',
  expense: 'Expenses',
  transfer: 'Transfers',
  opening: 'Opening balances',
};

export function editableTree(groups: CategoryGroup[], categories: Category[]): EditableGroup[] {
  return sortedTree(groups, categories).map(({ group, categories: cats }) => ({
    id: group.id,
    name: group.name,
    kind: group.kind,
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
  }));
}

// Edits: each returns a new tree and leaves the given one as it is.

export function renameItem(tree: EditableGroup[], id: string, name: string): EditableGroup[] {
  return tree.map((g) =>
    g.id === id ? { ...g, name } : { ...g, categories: g.categories.map((c) => (c.id === id ? { ...c, name } : c)) },
  );
}

export function addCategory(tree: EditableGroup[], groupId: string, category: EditableCategory): EditableGroup[] {
  return tree.map((g) => (g.id === groupId ? { ...g, categories: [...g.categories, category] } : g));
}

/** Adds a group after the last group of its kind. */
export function addGroup(tree: EditableGroup[], group: EditableGroup): EditableGroup[] {
  const at = tree.findLastIndex((g) => g.kind === group.kind) + 1;
  return [...tree.slice(0, at), group, ...tree.slice(at)];
}

export function removeGroup(tree: EditableGroup[], id: string) {
  return tree.filter((g) => g.id !== id);
}

export function removeCategory(tree: EditableGroup[], id: string): EditableGroup[] {
  return tree.map((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== id) }));
}

/** Moves a category to the end of another group. */
export function moveCategory(tree: EditableGroup[], id: string, toGroupId: string): EditableGroup[] {
  const found = findCategory(tree, id);
  if (!found || found.group.id === toGroupId) return tree;
  return addCategory(removeCategory(tree, id), toGroupId, found.category);
}

export function setGroupKind(tree: EditableGroup[], id: string, kind: CategoryKind): EditableGroup[] {
  return tree.map((g) => (g.id === id ? { ...g, kind } : g));
}

function swap<T>(list: T[], i: number, j: number) {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Moves a group or category one place up (-1) or down (1). A category moves within its group, a group past the
 * next group of the same kind. Returns the tree unchanged at either end.
 */
export function reorder(tree: EditableGroup[], id: string, direction: -1 | 1): EditableGroup[] {
  const groupAt = tree.findIndex((g) => g.id === id);
  if (groupAt >= 0) {
    let other = groupAt + direction;
    while (tree[other] && tree[other].kind !== tree[groupAt].kind) other += direction;
    return tree[other] ? swap(tree, groupAt, other) : tree;
  }
  const found = findCategory(tree, id);
  if (!found) return tree;
  const list = found.group.categories;
  const at = list.indexOf(found.category);
  if (!list[at + direction]) return tree;
  return tree.map((g) => (g === found.group ? { ...g, categories: swap(list, at, at + direction) } : g));
}

export function findCategory(tree: EditableGroup[], id: string) {
  for (const group of tree) {
    const category = group.categories.find((c) => c.id === id);
    if (category) return { group, category };
  }
  return null;
}

/** True when the id is a group or a category in the tree. */
export function treeHas(tree: EditableGroup[], id: string | null) {
  return !!id && (tree.some((g) => g.id === id) || !!findCategory(tree, id));
}

/** Groups in display order: by kind, then as listed. */
export function groupsInOrder(tree: EditableGroup[]) {
  return CATEGORY_KINDS.flatMap((k) => tree.filter((g) => g.kind === k));
}

/** Error for a new or changed name, or '' when it is fine. Names are unique across groups and categories. */
export function nameError(tree: EditableGroup[], name: string, exceptId: string | null): string {
  if (!name.trim()) return 'Enter a name';
  for (const g of tree) {
    if (g.id !== exceptId && sameName(g.name, name)) return `“${g.name}” already exists as a group`;
    for (const c of g.categories)
      if (c.id !== exceptId && sameName(c.name, name)) return `“${c.name}” already exists as a category in ${g.name}`;
  }
  return '';
}

/** The edited tree as the Api's save request. */
export function toSaveRequest(tree: EditableGroup[], moves: Reassignment[]): CategoryChange {
  const groups: CategoryGroup[] = [];
  const categories: Category[] = [];
  for (const k of CATEGORY_KINDS)
    tree
      .filter((g) => g.kind === k)
      .forEach((g, order) => {
        groups.push({ id: g.id, name: g.name, kind: g.kind, order });
        g.categories.forEach((c, i) => {
          categories.push({ id: c.id, groupId: g.id, name: c.name, order: i });
        });
      });
  const moveTo: CategoryChange['moveTo'] = {};
  for (const m of moves) moveTo[m.fromId] = m.toId;
  return { groups, categories, moveTo };
}
