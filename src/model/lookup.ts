import type { Account, AccountId, Category, CategoryGroup, CategoryGroupId, CategoryId, CategoryKind } from './types';

export const KINDS: CategoryKind[] = ['income', 'expense', 'transfer', 'opening'];

export const KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
  opening: 'Opening balance',
};

/** Name and group lookups by id, built once per data change. */
export interface Lookup {
  accounts: Map<AccountId, Account>;
  groups: Map<CategoryGroupId, CategoryGroup>;
  categories: Map<CategoryId, Category>;
  accountName(id: AccountId | null): string;
  categoryName(id: CategoryId | null): string;
  groupOf(id: CategoryId | null): CategoryGroup | undefined;
}

export function makeLookup(accounts: Account[], groups: CategoryGroup[], categories: Category[]): Lookup {
  const a = new Map(accounts.map((x) => [x.id, x]));
  const g = new Map(groups.map((x) => [x.id, x]));
  const c = new Map(categories.map((x) => [x.id, x]));
  return {
    accounts: a,
    groups: g,
    categories: c,
    accountName: (id) => (id ? (a.get(id)?.name ?? '') : ''),
    categoryName: (id) => (id ? (c.get(id)?.name ?? '') : ''),
    groupOf: (id) => {
      const cat = id ? c.get(id) : undefined;
      return cat ? g.get(cat.groupId) : undefined;
    },
  };
}

/** Groups in display order: by kind, then their own order; categories within a group by order. */
export function sortedTree(groups: CategoryGroup[], categories: Category[]) {
  return KINDS.flatMap((kind) =>
    groups
      .filter((g) => g.kind === kind)
      .sort((x, y) => x.order - y.order)
      .map((group) => ({
        group,
        categories: categories.filter((c) => c.groupId === group.id).sort((x, y) => x.order - y.order),
      })),
  );
}
