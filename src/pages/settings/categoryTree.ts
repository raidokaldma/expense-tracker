import { KIND_LABELS, KINDS, sortedTree } from '../../model/lookup';
import { sameName } from '../../model/names';
import { plural } from '../../model/plural';
import type {
  Category,
  CategoryChange,
  CategoryGroup,
  CategoryGroupId,
  CategoryId,
  CategoryKind,
} from '../../model/types';

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

// ---------- edits: each returns a new tree and leaves the given one as it is ----------

/** Gives a group or category a new name. */
export const renameItem = (tree: EditableGroup[], id: string, name: string): EditableGroup[] =>
  tree.map((g) =>
    g.id === id ? { ...g, name } : { ...g, categories: g.categories.map((c) => (c.id === id ? { ...c, name } : c)) },
  );

export const addCategory = (tree: EditableGroup[], groupId: string, category: EditableCategory): EditableGroup[] =>
  tree.map((g) => (g.id === groupId ? { ...g, categories: [...g.categories, category] } : g));

/** Adds a group after the last group of its kind. */
export function addGroup(tree: EditableGroup[], group: EditableGroup): EditableGroup[] {
  const at = tree.findLastIndex((g) => g.kind === group.kind) + 1;
  return [...tree.slice(0, at), group, ...tree.slice(at)];
}

export const removeGroup = (tree: EditableGroup[], id: string) => tree.filter((g) => g.id !== id);

export const removeCategory = (tree: EditableGroup[], id: string): EditableGroup[] =>
  tree.map((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== id) }));

/** Moves a category to the end of another group. */
export function moveCategory(tree: EditableGroup[], id: string, toGroupId: string): EditableGroup[] {
  const found = findCategory(tree, id);
  if (!found || found.group.id === toGroupId) return tree;
  return addCategory(removeCategory(tree, id), toGroupId, found.category);
}

export const setGroupKind = (tree: EditableGroup[], id: string, kind: CategoryKind): EditableGroup[] =>
  tree.map((g) => (g.id === id ? { ...g, kind } : g));

const swap = <T>(list: T[], i: number, j: number) => {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

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
export const treeHas = (tree: EditableGroup[], id: string | null) =>
  !!id && (tree.some((g) => g.id === id) || !!findCategory(tree, id));

/** Groups in display order: by kind, then as listed. */
export const groupsInOrder = (tree: EditableGroup[]) => KINDS.flatMap((k) => tree.filter((g) => g.kind === k));

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

/** The unsaved changes, in words, for the side panel. */
export function describeChanges(saved: EditableGroup[], tree: EditableGroup[], moves: Reassignment[]): string[] {
  const out: string[] = [];
  const savedGroups = new Map(saved.map((g) => [g.id, g]));
  const treeGroups = new Map(tree.map((g) => [g.id, g]));
  for (const g of tree) {
    const before = savedGroups.get(g.id);
    if (!before) out.push(`Added group “${g.name}”`);
    else {
      if (before.name !== g.name) out.push(`Renamed group “${before.name}” → “${g.name}”`);
      if (before.kind !== g.kind) out.push(`“${g.name}” now counts as ${KIND_LABELS[g.kind].toLowerCase()}`);
    }
  }
  for (const g of saved) if (!treeGroups.has(g.id)) out.push(`Deleted group “${g.name}”`);

  const byId = (t: EditableGroup[]) =>
    new Map(t.flatMap((group) => group.categories.map((category) => [category.id, { category, group }] as const)));
  const savedCats = byId(saved);
  const treeCats = byId(tree);
  for (const [id, { category, group }] of treeCats) {
    const before = savedCats.get(id);
    if (!before) out.push(`Added “${category.name}” to ${group.name}`);
    else {
      if (before.category.name !== category.name) out.push(`Renamed “${before.category.name}” → “${category.name}”`);
      if (before.group.id !== group.id) out.push(`Moved “${category.name}” to ${group.name}`);
    }
  }
  for (const [id, { category }] of savedCats) {
    if (treeCats.has(id)) continue;
    const move = moves.find((m) => m.fromId === id);
    const to = move && treeCats.get(move.toId);
    const where = move ? ` — ${plural(move.count, 'transaction')} → ${to ? to.category.name : '?'}` : '';
    out.push(`Deleted “${category.name}”${where}`);
  }

  // order changes count only among items present both before and after
  const sameOrder = (before: string[], after: string[]) => {
    const common = new Set(before.filter((x) => after.includes(x)));
    return before.filter((x) => common.has(x)).join() === after.filter((x) => common.has(x)).join();
  };
  for (const k of KINDS) {
    const ids = (t: EditableGroup[]) => t.filter((g) => g.kind === k).map((g) => g.id);
    if (!sameOrder(ids(saved), ids(tree))) out.push(`Reordered ${SECTION_TITLES[k].toLowerCase()} groups`);
  }
  for (const g of tree) {
    const before = savedGroups.get(g.id);
    const ids = (group: EditableGroup) => group.categories.map((c) => c.id as string);
    if (before && !sameOrder(ids(before), ids(g))) out.push(`Reordered categories in ${g.name}`);
  }
  return out;
}

/** The edited tree as the Api's save request. */
export function toSaveRequest(tree: EditableGroup[], moves: Reassignment[]): CategoryChange {
  const groups: CategoryGroup[] = [];
  const categories: Category[] = [];
  for (const k of KINDS)
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
