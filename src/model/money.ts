import type { Amount } from './types';

/** −1 234,56 / +25,00 / 0,00 — sign, space thousands, comma decimals; never a currency. */
export function formatAmount(n: Amount): string {
  const abs = Math.abs(Math.round(n));
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = String(abs % 100).padStart(2, '0');
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${int},${frac}`;
}

/** The value as typed in the editor: -48,37 */
export function amountEditText(n: Amount | null): string {
  if (n == null) return '';
  return (n / 100).toFixed(2).replace('.', ',');
}

function normalise(text: string): string {
  return text
    .replace(/[\s  ]/g, '')
    .replace(/−/g, '-')
    .replace(',', '.')
    .replace(/^\+/, '');
}

/** Parses "-12,50", "2850", "+3.5" into hundredths. Empty → null; garbage or more than 2 decimals → undefined. */
export function parseAmount(text: string): Amount | null | undefined {
  const t = normalise(text);
  if (t === '') return null;
  const m = t.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return undefined;
  // built from the digits, so no floating-point rounding: "0,29" is exactly 29
  const hundredths = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -hundredths : hundredths;
}

const hundredths = (decimal: string) => Math.round(Number(decimal) * 100);

/** Amount filter (column filter and Find): "<-20", ">=100", "10..50", "=12,5" or a fragment like "1234". */
export function amountMatches(v: Amount | null, query: string): boolean {
  if (v == null) return false;
  const t = normalise(query).replace(/,/g, '.');
  let m = t.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const a = hundredths(m[1]);
    const b = hundredths(m[2]);
    return v >= Math.min(a, b) && v <= Math.max(a, b);
  }
  m = t.match(/^(<=|>=|<|>|=)(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const x = hundredths(m[2]);
    switch (m[1]) {
      case '<':
        return v < x;
      case '>':
        return v > x;
      case '<=':
        return v <= x;
      case '>=':
        return v >= x;
      default:
        return v === x;
    }
  }
  // fragments ignore the thousands space: "1234" finds +1 234,56
  const plain = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-');
  return plain(formatAmount(v)).includes(plain(query));
}
