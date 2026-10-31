import type { Amount } from '../../shared/types';

/** −1 234,56 / +25,00 / 0,00 — sign, space thousands, comma decimals; never a currency. */
export function formatAmount(amount: Amount): string {
  const abs = Math.abs(Math.round(amount));
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = String(abs % 100).padStart(2, '0');
  return `${amount < 0 ? '−' : amount > 0 ? '+' : ''}${int},${frac}`;
}

/** The value as typed in the editor: -48,37 */
export function amountEditText(amount: Amount | null): string {
  if (amount == null) return '';
  return (amount / 100).toFixed(2).replace('.', ',');
}

function normalise(text: string): string {
  return text
    .replace(/[\s  ]/g, '')
    .replace(/−/g, '-')
    .replace(',', '.')
    .replace(/^\+/, '');
}

export type ParsedAmount = { kind: 'empty' } | { kind: 'amount'; value: Amount } | { kind: 'invalid' };

/** Parses "-12,50", "2850", "+3.5" into hundredths; more than 2 decimals is invalid. */
export function parseAmount(text: string): ParsedAmount {
  const normalised = normalise(text);
  if (normalised === '') return { kind: 'empty' };
  const parts = normalised.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!parts) return { kind: 'invalid' };
  const [, sign, whole, decimals = ''] = parts;
  // built from the digits, so no floating-point rounding: "0,29" is exactly 29
  const value = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  return { kind: 'amount', value: sign ? -value : value };
}

function hundredths(decimal: string) {
  return Math.round(Number(decimal) * 100);
}

/** Amount filter (column filter and Find): "<-20", ">=100", "10..50", "=12,5" or a fragment like "1234". */
export function amountMatches(amount: Amount | null, query: string): boolean {
  if (amount == null) return false;
  const normalised = normalise(query).replace(/,/g, '.');
  const range = normalised.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const from = hundredths(range[1]);
    const to = hundredths(range[2]);
    return amount >= Math.min(from, to) && amount <= Math.max(from, to);
  }
  const comparison = normalised.match(/^(<=|>=|<|>|=)(-?\d+(?:\.\d+)?)$/);
  if (comparison) return compare(amount, comparison[1], hundredths(comparison[2]));
  // fragments ignore the thousands space: "1234" finds +1 234,56
  const plain = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-');
  return plain(formatAmount(amount)).includes(plain(query));
}

function compare(amount: Amount, operator: string, limit: Amount): boolean {
  switch (operator) {
    case '<':
      return amount < limit;
    case '>':
      return amount > limit;
    case '<=':
      return amount <= limit;
    case '>=':
      return amount >= limit;
    default:
      return amount === limit;
  }
}
