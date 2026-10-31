import { TZDate } from '@date-fns/tz';
import type { Timestamp } from './types.ts';

export const TIME_ZONE = 'Europe/Tallinn';

/** A wall-clock moment in Tallinn; months are 1-based. */
export interface LocalParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

/** 7 → "07" */
export const pad2 = (n: number) => String(n).padStart(2, '0');

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Any ISO 8601 string with a zone (or a Date) → UTC timestamp without milliseconds. */
export function toTimestamp(value: string | Date | number): Timestamp {
  // a TZDate's own toISOString() keeps its zone offset, so always go through a plain Date
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${String(value)}`);
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z') as Timestamp;
}

export const nowTimestamp = () => toTimestamp(new Date());

// time-zone conversion is the slow part of rendering 20k rows, so each stored timestamp is converted once
const localCache = new Map<string, LocalParts>();

export function toLocal(ts: Timestamp | Date): LocalParts {
  if (ts instanceof Date) return convert(ts.getTime());
  let p = localCache.get(ts);
  if (!p) {
    if (localCache.size > 200_000) localCache.clear();
    p = convert(Date.parse(ts));
    localCache.set(ts, p);
  }
  return p;
}

function convert(ms: number): LocalParts {
  const t = new TZDate(ms, TIME_ZONE);
  return { y: t.getFullYear(), mo: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes() };
}

export function fromLocal(p: LocalParts): Timestamp {
  return toTimestamp(new TZDate(p.y, p.mo - 1, p.d, p.h, p.mi, TIME_ZONE));
}

export const nowLocal = () => toLocal(new Date());

/** dd.mm.yyyy hh:mm */
export const formatLocal = (p: LocalParts) => `${pad2(p.d)}.${pad2(p.mo)}.${p.y} ${pad2(p.h)}:${pad2(p.mi)}`;

export const localDateKey = (p: LocalParts) => `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;

/** Tallinn month of a timestamp: "2026-10" */
export function monthKey(ts: Timestamp): string {
  const p = toLocal(ts);
  return `${p.y}-${pad2(p.mo)}`;
}

/** Weekday letter, Sunday first: S M T W T F S */
export function weekdayLetter(p: LocalParts): string {
  return 'SMTWTFS'[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()];
}

/** Grid format: "T 20.10.2026 14:30" */
export function formatTimestamp(ts: Timestamp): string {
  const p = toLocal(ts);
  return `${weekdayLetter(p)} ${formatLocal(p)}`;
}

/** Monday-first weekday index (0 = Monday) of the 1st of a month. */
export function firstWeekdayOfMonth(y: number, mo: number): number {
  return (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
}

export const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();

export function shiftDays(p: LocalParts, n: number): LocalParts {
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + n));
  return { ...p, y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

export function shiftMonths(p: LocalParts, n: number): LocalParts {
  const first = new Date(Date.UTC(p.y, p.mo - 1 + n, 1));
  const y = first.getUTCFullYear();
  const mo = first.getUTCMonth() + 1;
  return { ...p, y, mo, d: Math.min(p.d, daysInMonth(y, mo)) };
}

function make(y: number, mo: number, d: number, h: number, mi: number): LocalParts | null {
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59) return null;
  return { y, mo, d, h, mi };
}

/**
 * Parses what people type into the date editor, in Tallinn time:
 * "20.10.2026 14:30", "20.10 14:30", "20.10", "2026-10-20", "14:30", "t" / "y" / "n" (today / yesterday / now).
 * Missing parts come from `base`.
 */
export function parseLocalInput(text: string, base: LocalParts = nowLocal()): LocalParts | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const now = nowLocal();
  if (t === 'n' || t === 'now') return now;
  if (t === 't' || t === 'today') return { ...now, h: base.h, mi: base.mi };
  if (t === 'y' || t === 'yesterday') return { ...shiftDays(now, -1), h: base.h, mi: base.mi };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t]+(\d{1,2}):(\d{2}))?$/);
  if (m) return make(+m[1], +m[2], +m[3], m[4] != null ? +m[4] : base.h, m[5] != null ? +m[5] : base.mi);
  m = t.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}|\d{2}))?\.?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : base.y;
    if (y < 100) y += 2000;
    return make(y, +m[2], +m[1], m[4] != null ? +m[4] : base.h, m[5] != null ? +m[5] : base.mi);
  }
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return make(base.y, base.mo, base.d, +m[1], +m[2]);
  return null;
}
