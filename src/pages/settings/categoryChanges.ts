import { CATEGORY_KINDS } from '../../../shared/types';
import { KIND_LABELS } from '../../model/lookup';
import { plural } from '../../model/plural';
import { type EditableCategory, type EditableGroup, type Reassignment, SECTION_TITLES } from './categoryTree';

export type ChangeTag = 'New' | 'Edited' | '';

export function groupTag(saved: EditableGroup | undefined, group: EditableGroup): ChangeTag {
  if (!saved) return 'New';
  return saved.name !== group.name || saved.kind !== group.kind ? 'Edited' : '';
}

export function categoryTag(
  saved: { category: EditableCategory; group: EditableGroup } | undefined,
  category: EditableCategory,
  group: EditableGroup,
): ChangeTag {
  if (!saved) return 'New';
  return saved.category.name !== category.name || saved.group.id !== group.id ? 'Edited' : '';
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
  for (const k of CATEGORY_KINDS) {
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
