import type { Category, CategoryId } from '../../shared/types';
import type { Lookup } from './lookup';
import { categoryOfRowKey, type PivotRow } from './pivot';

/** Hides the categories, or shows them again when all of them are hidden already. */
export function toggleHidden(hidden: readonly CategoryId[], ids: CategoryId[]): CategoryId[] {
  const allHidden = ids.every((id) => hidden.includes(id));
  return allHidden ? hidden.filter((id) => !ids.includes(id)) : [...new Set([...hidden, ...ids])];
}

/** The categories a group or category row hides: every category of the group, or the one category. */
export function rowCategoryIds(row: PivotRow, categories: Category[]): CategoryId[] {
  if (row.kind === 'parent') return categories.filter((c) => c.groupId === row.groupId).map((c) => c.id);
  const id = categoryOfRowKey(row.key);
  return id ? [id] : [];
}

/** Opening balances are never part of the overview, so they do not count as hidden. */
export function countHidden(hidden: readonly CategoryId[], lookup: Lookup) {
  return hidden.filter((id) => lookup.categories.has(id) && lookup.groupOf(id)?.kind !== 'opening').length;
}
