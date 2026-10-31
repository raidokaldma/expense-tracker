import { useCallback, useMemo } from 'react';
import { sortedTree } from '../../model/lookup';
import { suggestCategories } from '../../model/suggest';
import type { CategoryId, Transaction } from '../../model/types';
import { useStore } from '../../store/store';
import { type ColKey, DRAFT_ID } from './columns';
import type { Option } from './editState';

const LIMIT_TYPED = 8;
const LIMIT_EMPTY = 50;

/** Returns the dropdown options for a suggest column, filtered by what has been typed. */
export function useSuggestions() {
  const transactions = useStore((st) => st.transactions);
  const accounts = useStore((st) => st.accounts);
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);
  const lookup = useStore((st) => st.lookup);

  // opening balances are one per account, so they never teach suggestions
  const openingIds = useMemo(() => {
    const opening = new Set(groups.filter((g) => g.kind === 'opening').map((g) => g.id));
    return new Set(categories.filter((c) => opening.has(c.groupId)).map((c) => c.id));
  }, [groups, categories]);
  const everyday = useMemo(
    () => transactions.filter((t) => !t.categoryId || !openingIds.has(t.categoryId)),
    [transactions, openingIds],
  );

  // recipients most used first
  const counterparties = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of everyday) if (t.counterparty) counts.set(t.counterparty, (counts.get(t.counterparty) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [everyday]);

  const categoryOptions = useMemo<(Option & { id: CategoryId })[]>(
    () =>
      sortedTree(groups, categories).flatMap(({ group, categories: cats }) =>
        cats.map((c) => ({ value: c.name, label: c.name, hint: group.name, id: c.id })),
      ),
    [groups, categories],
  );

  const accountOptions = useMemo<Option[]>(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.name, label: a.name })),
    [accounts],
  );

  return useCallback(
    (key: ColKey, text: string, touched: boolean, row: Transaction): Option[] => {
      const q = touched ? text.trim().toLowerCase() : '';
      const matches = (o: Option) => !q || o.value.toLowerCase().includes(q);
      // typed text: matches only, the ones starting with it first
      const ranked = (list: Option[]) =>
        q
          ? list
              .filter(matches)
              .sort((a, b) => Number(b.value.toLowerCase().startsWith(q)) - Number(a.value.toLowerCase().startsWith(q)))
              .slice(0, LIMIT_TYPED)
          : list;

      if (key === 'categoryId') {
        const suggested: Option[] = suggestCategories(row.id === DRAFT_ID ? null : row, everyday)
          .map((g) => {
            const name = lookup.categoryName(g.categoryId);
            return { value: name, label: name, confidence: g.confidence, level: g.level };
          })
          .filter(matches);
        // an account that has its opening balance is not offered another
        const hasOpening =
          row.accountId != null &&
          transactions.some(
            (t) => t.id !== row.id && t.accountId === row.accountId && t.categoryId && openingIds.has(t.categoryId),
          );
        const rest = categoryOptions
          .filter((o) => !(hasOpening && openingIds.has(o.id)))
          .filter((o) => !suggested.some((g) => g.value === o.value));
        return [...suggested, ...ranked(rest)];
      }
      if (key === 'accountId') return ranked(accountOptions);

      // recipients: free text is allowed, offered as "Use “…”" when it is new
      const base: Option[] = counterparties.map((v) => ({ value: v, label: v }));
      const items = q ? ranked(base) : base.slice(0, LIMIT_EMPTY);
      if (q && !counterparties.some((v) => v.toLowerCase() === q)) {
        const v = text.trim();
        items.push({ value: v, label: `Use “${v}”`, isNew: true });
      }
      return items;
    },
    [transactions, everyday, openingIds, lookup, counterparties, categoryOptions, accountOptions],
  );
}
