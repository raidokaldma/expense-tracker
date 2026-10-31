/** "1 transaction", "2 transactions"; pass the plural when it is not just an added "s" ("categories"). */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
