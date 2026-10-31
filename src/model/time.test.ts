import { describe, expect, it } from 'vitest';
import { formatTimestamp, fromLocal, monthKey, parseLocalInput, shiftMonths, toLocal, toTimestamp } from './time';
import type { Timestamp } from './types';

describe('Tallinn time', () => {
  it('stores UTC and shows Tallinn time, summer and winter', () => {
    expect(fromLocal({ y: 2026, mo: 7, d: 1, h: 12, mi: 0 })).toBe('2026-07-01T09:00:00Z');
    expect(fromLocal({ y: 2026, mo: 1, d: 1, h: 12, mi: 0 })).toBe('2026-01-01T10:00:00Z');
    expect(toLocal('2026-07-01T09:00:00Z' as Timestamp)).toEqual({ y: 2026, mo: 7, d: 1, h: 12, mi: 0 });
  });

  it('normalises any offset to UTC', () => {
    expect(toTimestamp('2026-10-20T14:30:00+03:00')).toBe('2026-10-20T11:30:00Z');
  });

  it('puts late-evening UTC rows into the Tallinn month', () => {
    expect(monthKey('2026-09-30T22:30:00Z' as Timestamp)).toBe('2026-10');
  });

  it('formats with a weekday letter', () => {
    expect(formatTimestamp('2026-10-20T11:30:00Z' as Timestamp)).toBe('T 20.10.2026 14:30');
  });
});

describe('parseLocalInput', () => {
  const base = { y: 2026, mo: 10, d: 20, h: 9, mi: 15 };
  it('fills missing parts from the base', () => {
    expect(parseLocalInput('20.10.2026 14:30', base)).toEqual({ y: 2026, mo: 10, d: 20, h: 14, mi: 30 });
    expect(parseLocalInput('5.3', base)).toEqual({ y: 2026, mo: 3, d: 5, h: 9, mi: 15 });
    expect(parseLocalInput('2025-12-31', base)).toEqual({ y: 2025, mo: 12, d: 31, h: 9, mi: 15 });
    expect(parseLocalInput('18:05', base)).toEqual({ y: 2026, mo: 10, d: 20, h: 18, mi: 5 });
  });

  it('rejects impossible dates', () => {
    expect(parseLocalInput('31.02', base)).toBeNull();
    expect(parseLocalInput('hello', base)).toBeNull();
  });

  it('keeps the time for today and yesterday', () => {
    const t = parseLocalInput('t', base);
    expect(t && [t.h, t.mi]).toEqual([9, 15]);
  });
});

describe('shiftMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(shiftMonths({ y: 2026, mo: 1, d: 31, h: 0, mi: 0 }, 1)).toEqual({ y: 2026, mo: 2, d: 28, h: 0, mi: 0 });
  });
});
