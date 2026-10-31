import { nearbySuffixCategory } from './nearbySuffix';
import type { CategoryId, Transaction } from './types';

export type ConfidenceLevel = 'high' | 'med' | 'low';

export interface CategorySuggestion {
  categoryId: CategoryId;
  confidence: number;
  level: ConfidenceLevel;
}

/**
 * How an earlier row with a category relates to the row being categorized, strongest first. Only the strongest
 * kind of hint found is used, so many weak hints never outvote a strong one.
 */
const HINTS = [
  /** Same account and same recipient; the same (or a close) amount counts double: rent, subscriptions. */
  { name: 'sameAccountAndRecipient', maxConfidence: 0.97 },
  /** Same recipient, from another account; a close amount counts double here too. */
  { name: 'sameRecipient', maxConfidence: 0.9 },
  /** The recipient's first word appears in the other row's recipient ("Green" in "Green Basket Market"). */
  { name: 'sameFirstWord', maxConfidence: 0.6 },
] as const;

type HintKind = (typeof HINTS)[number]['name'];

/** Amounts closer than this (smaller ÷ larger) count as near: 0.8 means within 20%. */
const NEAR_AMOUNT = 0.8;
/** Added to the total when turning scores into confidence, so a single hint never reads as certain. */
const DOUBT = 1.5;
const MAX_SUGGESTIONS = 3;
const MIN_CONFIDENCE = 0.2;
/** The most a recipient ending ("…, Edinburgh, GB") shared with rows of the same week can say. */
const NEARBY_SUFFIX_CONFIDENCE = 0.5;

/** Recipients compare without case and extra spaces. */
const normalize = (name: string | null) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (name: string) => name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** The recipient's first word, when it says something: at least 3 characters and not just digits. */
function firstWord(name: string) {
  const word = words(name)[0] ?? '';
  return word.length >= 3 && !/^\d+$/.test(word) ? word : '';
}

/**
 * 1 for the same amount, falling to 0 at `NEAR_AMOUNT`; 0 when the amounts differ more, or one is money in and
 * the other money out.
 */
export function amountCloseness(a: number | null, b: number | null) {
  if (a == null || b == null || a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) return 0;
  const ratio = Math.min(Math.abs(a), Math.abs(b)) / Math.max(Math.abs(a), Math.abs(b));
  return ratio < NEAR_AMOUNT ? 0 : (ratio - NEAR_AMOUNT) / (1 - NEAR_AMOUNT);
}

/** What kind of hint an earlier row is, and how much it weighs (1, up to 2 for a matching amount); null for none. */
export function hint(row: Transaction, earlier: Transaction): { kind: HintKind; weight: number } | null {
  const recipient = normalize(row.counterparty);
  if (!recipient) return null;
  const other = normalize(earlier.counterparty);
  if (other === recipient) {
    const weight = 1 + amountCloseness(row.amount, earlier.amount);
    const sameAccount = row.accountId != null && earlier.accountId === row.accountId;
    return { kind: sameAccount ? 'sameAccountAndRecipient' : 'sameRecipient', weight };
  }
  const word = firstWord(recipient);
  return word && words(other).includes(word) ? { kind: 'sameFirstWord', weight: 1 } : null;
}

/**
 * Up to 3 categories for a row, from the rows already categorized. Strongest hints: the same account, recipient
 * and (about) the same amount; then the same account and recipient; then the same recipient on another account;
 * then recipients sharing the first word. Confidence is a category's share of the strongest kind of hint found.
 * Without any of those: the category most rows within a week share when their recipient ends the same way.
 */
export function suggestCategories(row: Transaction | null, rows: Transaction[]): CategorySuggestion[] {
  if (!row) return [];
  const scores = new Map<HintKind, Map<CategoryId, number>>();
  for (const earlier of rows) {
    if (!earlier.categoryId || earlier.id === row.id) continue;
    const found = hint(row, earlier);
    if (!found) continue;
    const byCategory = scores.get(found.kind) ?? new Map<CategoryId, number>();
    byCategory.set(earlier.categoryId, (byCategory.get(earlier.categoryId) ?? 0) + found.weight);
    scores.set(found.kind, byCategory);
  }

  const strongest = HINTS.find((h) => scores.has(h.name));
  if (!strongest) {
    const nearby = nearbySuffixCategory(row, rows);
    return nearby
      ? leveled([confidenceOf(nearby.categoryId, nearby.score, nearby.total, NEARBY_SUFFIX_CONFIDENCE)])
      : [];
  }
  const byCategory = scores.get(strongest.name)!;
  const total = [...byCategory.values()].reduce((sum, score) => sum + score, 0);
  return leveled(
    [...byCategory.entries()].map(([categoryId, score]) =>
      confidenceOf(categoryId, score, total, strongest.maxConfidence),
    ),
  );
}

const confidenceOf = (categoryId: CategoryId, score: number, total: number, max: number) => ({
  categoryId,
  confidence: Math.min(max, score / (total + DOUBT)),
});

function leveled(list: { categoryId: CategoryId; confidence: number }[]): CategorySuggestion[] {
  return list
    .filter((s) => s.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({ ...s, level: s.confidence >= 0.7 ? 'high' : s.confidence >= 0.4 ? 'med' : 'low' }));
}
