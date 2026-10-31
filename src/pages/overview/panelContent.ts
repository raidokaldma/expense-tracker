import { cellId } from '../../components/selection';
import type { Pivot } from '../../model/pivot';
import { plural } from '../../model/plural';
import { monthKey } from '../../model/time';
import type { Transaction } from '../../model/types';

/** What the side panel shows for the selected cells. */
export interface PanelContent {
  title: string;
  subtitle: string;
  /** The transactions behind the cells, each once however the cells overlap; largest first. */
  items: Transaction[];
  /** The cells cover more than one category, so each transaction names its own. */
  showCategory: boolean;
  /** The cells cover more than one month, so dates need the year. */
  showYear: boolean;
}

/** The content for the cells in `ids`; null when no cell is selected. */
export function panelContent(ids: ReadonlySet<string>, pivot: Pivot, range: string): PanelContent | null {
  const { months } = pivot;
  const cols = [...months.map((m) => m.key), 'total'];
  const cells = pivot.rows.flatMap((row) =>
    cols
      .filter((col) => ids.has(cellId({ key: row.key, col })))
      .map((col) => ({ row, month: months.find((m) => m.key === col) })),
  );
  if (!cells.length) return null;

  // "<category>|<month>", or "<category>|total" for every month
  const covered = new Set(cells.flatMap((c) => c.row.categoryIds.map((id) => `${id}|${c.month?.key ?? 'total'}`)));
  const items = pivot.transactions
    .filter((t) => covered.has(`${t.categoryId}|total`) || covered.has(`${t.categoryId}|${monthKey(t.occurredAt!)}`))
    .sort((a, b) => Math.abs(b.amount!) - Math.abs(a.amount!) || b.occurredAt!.localeCompare(a.occurredAt!));
  const categories = new Set(cells.flatMap((c) => c.row.categoryIds));
  const cellMonths = new Set(cells.map((c) => c.month?.key ?? 'total'));
  const [first] = cells;
  const labels = [...new Set(cells.map((c) => c.row.label))];

  return {
    title: cells.length === 1 ? first.row.label : `${plural(cells.length, 'cell')} selected`,
    subtitle: cells.length === 1 ? (first.month?.long ?? range) : labels.join(', '),
    items,
    showCategory: categories.size > 1,
    showYear: cellMonths.size > 1 || cellMonths.has('total'),
  };
}
