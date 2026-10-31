import { sortedTree } from './lookup';
import { MONTH_NAMES, monthKey, nowLocal, pad2 } from './time';
import type {
  Category,
  CategoryGroup,
  CategoryGroupId,
  CategoryId,
  CategoryKind,
  OverviewPeriod,
  Transaction,
} from './types';
import { isValid } from './validity';

export interface PivotMonth {
  key: string;
  short: string;
  mid: string;
  long: string;
}

export type PivotRowKind = 'section' | 'parent' | 'child' | 'total' | 'net';

export interface PivotRow {
  kind: PivotRowKind;
  /** Navigation key; empty for section rows. g:<groupId>, c:<categoryId>, t:income, t:expense, net */
  key: string;
  label: string;
  categoryIds: CategoryId[];
  /** One value per month (newest first), then the total. */
  values: number[];
  /** How many transactions each value sums, in the same order: a sum of 0 still counts its transactions. */
  counts: number[];
  /** The category (or every category of the group) is hidden and only shown dimmed. */
  hidden: boolean;
  groupId?: CategoryGroupId;
  open?: boolean;
  categoryCount?: number;
}

export interface Pivot {
  months: PivotMonth[];
  rows: PivotRow[];
  /** Valid transactions in the period, transfers included, opening balances not. */
  transactions: Transaction[];
}

export function monthInfo(key: string): PivotMonth {
  const name = MONTH_NAMES[Number(key.slice(5, 7)) - 1];
  const now = nowLocal();
  const current = key === `${now.y}-${pad2(now.mo)}`;
  return {
    key,
    short: `${name.slice(0, 3)} ’${key.slice(2, 4)}`,
    mid: `${name.slice(0, 3)} ${key.slice(0, 4)}`,
    long: `${name} ${key.slice(0, 4)}${current ? ' (to date)' : ''}`,
  };
}

export interface PivotInput {
  transactions: Transaction[];
  groups: CategoryGroup[];
  categories: Category[];
  period: OverviewPeriod;
  hidden: ReadonlySet<CategoryId>;
  showHidden: boolean;
  collapsed: ReadonlySet<CategoryGroupId>;
}

const shiftMonth = (key: string, n: number) => {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
};

/**
 * Calendar months of a period, oldest first. "Last 3 / 12 months" count back from the current month, empty months
 * included; "All" runs from the first month with data to the current month.
 */
export function periodMonths(period: OverviewPeriod, dataMonths: string[]): string[] {
  const now = nowLocal();
  const current = `${now.y}-${pad2(now.mo)}`;
  const sorted = [...dataMonths].sort();
  if (period === 'all' && !sorted.length) return [];
  const last = sorted.length && sorted[sorted.length - 1] > current ? sorted[sorted.length - 1] : current;
  const first = period === 'all' ? sorted[0] : shiftMonth(current, period === 'last3' ? -2 : -11);
  const out: string[] = [];
  for (let k = first; k <= last; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

/**
 * Months × categories, newest month first: Income, Expenses and Transfers, each with its total, then Net. Net is
 * income minus expenses; transfers move money between accounts, so they are shown but not counted in it.
 * Invalid rows and opening balances are left out.
 */
export function buildPivot(input: PivotInput): Pivot {
  const { hidden, showHidden, collapsed } = input;
  const opening = new Set(
    input.categories.filter((c) => input.groups.find((g) => g.id === c.groupId)?.kind === 'opening').map((c) => c.id),
  );
  const counted = input.transactions.filter((t) => isValid(t) && !opening.has(t.categoryId!));
  const keys = periodMonths(
    input.period,
    counted.map((t) => monthKey(t.occurredAt!)),
  );
  const months = keys.slice().reverse().map(monthInfo);
  const inPeriod = new Set(keys);
  const transactions = counted.filter((t) => inPeriod.has(monthKey(t.occurredAt!)));

  const sums = new Map<string, number>();
  const tally = new Map<string, number>();
  for (const t of transactions) {
    const k = `${t.categoryId}|${monthKey(t.occurredAt!)}`;
    sums.set(k, (sums.get(k) || 0) + t.amount!);
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  /** Per month, then the total, of every category in `ids`. */
  const perMonth = (by: Map<string, number>, ids: CategoryId[]) => {
    const vals = months.map((m) => ids.reduce((a, id) => a + (by.get(`${id}|${m.key}`) || 0), 0));
    return [...vals, vals.reduce((a, b) => a + b, 0)];
  };
  const cells = (ids: CategoryId[]) => ({ values: perMonth(sums, ids), counts: perMonth(tally, ids) });

  const rows: PivotRow[] = [];
  // categories without transactions in the period are left out, as are hidden ones unless shown
  const used = new Set(transactions.map((t) => t.categoryId!));
  const excluded = (id: CategoryId) => !used.has(id) || (!showHidden && hidden.has(id));
  const shownIds = (kind: CategoryKind) =>
    sortedTree(input.groups, input.categories)
      .filter((x) => x.group.kind === kind)
      .flatMap((x) => x.categories.map((c) => c.id))
      .filter((id) => !excluded(id));

  const section = (label: string) =>
    rows.push({ kind: 'section', key: '', label, categoryIds: [], values: [], counts: [], hidden: false });

  const groupRows = (kind: CategoryKind) => {
    for (const { group, categories } of sortedTree(input.groups, input.categories)) {
      if (group.kind !== kind) continue;
      const kids = categories.filter((c) => !excluded(c.id));
      if (!kids.length) continue;
      const open = !collapsed.has(group.id);
      const ids = kids.map((c) => c.id);
      rows.push({
        kind: 'parent',
        key: `g:${group.id}`,
        label: group.name,
        categoryIds: ids,
        ...cells(ids),
        hidden: categories.length > 0 && categories.every((c) => hidden.has(c.id)),
        groupId: group.id,
        open,
        categoryCount: ids.length,
      });
      if (open)
        for (const c of kids)
          rows.push({
            kind: 'child',
            key: `c:${c.id}`,
            label: c.name,
            categoryIds: [c.id],
            ...cells([c.id]),
            hidden: hidden.has(c.id),
            groupId: group.id,
          });
    }
  };

  // a block (and the Net row) is left out when none of its categories is shown
  const block = (kind: CategoryKind, title: string, totalLabel: string) => {
    const ids = shownIds(kind);
    if (!ids.length) return ids;
    section(title);
    groupRows(kind);
    rows.push({
      kind: 'total',
      key: `t:${kind}`,
      label: totalLabel,
      categoryIds: ids,
      ...cells(ids),
      hidden: false,
    });
    return ids;
  };
  const both = [...block('income', 'Income', 'Total income'), ...block('expense', 'Expenses', 'Total expenses')];
  block('transfer', 'Transfers', 'Total transfers');
  if (both.length)
    rows.push({ kind: 'net', key: 'net', label: 'Net', categoryIds: both, ...cells(both), hidden: false });

  return { months, rows, transactions };
}
