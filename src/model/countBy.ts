/** How many items share each key; items without a key are not counted. */
export function countBy<T, K>(items: T[], keyOf: (item: T) => K | null | undefined): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key != null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
