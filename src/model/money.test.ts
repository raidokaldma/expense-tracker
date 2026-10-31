import { describe, expect, it } from 'vitest';
import { amountEditText, amountMatches, formatAmount, parseAmount } from './money';

describe('formatAmount', () => {
  it('signs, groups thousands with spaces and uses a decimal comma', () => {
    expect(formatAmount(-123456)).toBe('−1 234,56');
    expect(formatAmount(2500)).toBe('+25,00');
    expect(formatAmount(0)).toBe('0,00');
    expect(formatAmount(-5)).toBe('−0,05');
  });
});

describe('parseAmount', () => {
  it('reads what people type into hundredths', () => {
    expect(parseAmount('-12,50')).toEqual({ kind: 'amount', value: -1250 });
    expect(parseAmount('2850')).toEqual({ kind: 'amount', value: 285000 });
    expect(parseAmount('+3.5')).toEqual({ kind: 'amount', value: 350 });
    expect(parseAmount('−1 234,56')).toEqual({ kind: 'amount', value: -123456 });
    expect(parseAmount('')).toEqual({ kind: 'empty' });
    expect(parseAmount('abc')).toEqual({ kind: 'invalid' });
    expect(parseAmount('1,005')).toEqual({ kind: 'invalid' });
    expect(parseAmount('0,29')).toEqual({ kind: 'amount', value: 29 });
  });

  it('round-trips through the editor text', () => {
    expect(parseAmount(amountEditText(-4837))).toEqual({ kind: 'amount', value: -4837 });
  });
});

describe('amountMatches', () => {
  it('supports comparisons, ranges and fragments', () => {
    expect(amountMatches(-2500, '<-20')).toBe(true);
    expect(amountMatches(-1500, '<-20')).toBe(false);
    expect(amountMatches(-1500, '-20..-10')).toBe(true);
    expect(amountMatches(1250, '=12,5')).toBe(true);
    expect(amountMatches(-3562, '35,62')).toBe(true);
    expect(amountMatches(null, '>0')).toBe(false);
    expect(amountMatches(10000, '>=100')).toBe(true);
    expect(amountMatches(1230, '<=12,3')).toBe(true);
    expect(amountMatches(123456, '1234')).toBe(true);
    expect(amountMatches(123456, '1 234,56')).toBe(true);
  });
});
