import { sameName } from '../../../shared/names';
import {
  formatLocal,
  formatTimestamp,
  fromLocal,
  type LocalParts,
  nowLocal,
  nowTimestamp,
  parseLocalInput,
  toLocal,
} from '../../../shared/time';
import type { AccountId, CategoryId, NewTransaction, Transaction, TransactionId } from '../../../shared/types';
import type { Lookup } from '../../model/lookup';
import { amountEditText, formatAmount, parseAmount } from '../../model/money';

export type ColKey = 'accountId' | 'occurredAt' | 'counterparty' | 'amount' | 'categoryId' | 'description';

/** Text typed into each column's filter. */
export type Filters = Partial<Record<ColKey, string>>;

export interface Col {
  key: ColKey;
  label: string;
  kind: 'suggest' | 'date' | 'text';
  num?: boolean;
  placeholder: string;
}

export const COLS: Col[] = [
  { key: 'accountId', label: 'Account', kind: 'suggest', placeholder: 'contains…' },
  { key: 'occurredAt', label: 'Date & time', kind: 'date', placeholder: 'e.g. 10.2026' },
  { key: 'counterparty', label: 'Recipient / payer', kind: 'suggest', placeholder: 'contains…' },
  { key: 'amount', label: 'Amount', kind: 'text', num: true, placeholder: 'e.g. <-20' },
  { key: 'categoryId', label: 'Category', kind: 'suggest', placeholder: 'contains…' },
  { key: 'description', label: 'Description', kind: 'text', placeholder: 'contains…' },
];

export const CATEGORY_COL = COLS.findIndex((c) => c.key === 'categoryId');
export const AMOUNT_COL = COLS.findIndex((c) => c.key === 'amount');

export const DRAFT_ID = 'draft' as TransactionId;

/** The draft row as a new transaction, with the value just entered in `key`. A draft without a time is "now". */
export function draftToNew(draft: Partial<NewTransaction>, key: ColKey, value: NewTransaction[ColKey]): NewTransaction {
  return {
    externalId: null,
    accountId: draft.accountId ?? null,
    occurredAt: draft.occurredAt ?? nowTimestamp(),
    counterparty: draft.counterparty ?? null,
    amount: draft.amount ?? null,
    categoryId: draft.categoryId ?? null,
    description: draft.description ?? null,
    [key]: value,
  };
}

/** The new-transaction row at the top of the grid, as a row object. */
export function draftRow(draft: Partial<NewTransaction>): Transaction {
  return {
    id: DRAFT_ID,
    externalId: null,
    accountId: draft.accountId ?? null,
    occurredAt: draft.occurredAt ?? null,
    counterparty: draft.counterparty ?? null,
    amount: draft.amount ?? null,
    categoryId: draft.categoryId ?? null,
    description: draft.description ?? null,
    addedAt: '' as Transaction['addedAt'],
    updatedAt: '' as Transaction['updatedAt'],
  };
}

export function displayText(t: Transaction, key: ColKey, lookup: Lookup): string {
  switch (key) {
    case 'accountId':
      return lookup.accountName(t.accountId);
    case 'categoryId':
      return lookup.categoryName(t.categoryId);
    case 'occurredAt':
      return t.occurredAt ? formatTimestamp(t.occurredAt) : '';
    case 'amount':
      return t.amount == null ? '' : formatAmount(t.amount);
    default:
      return t[key] ?? '';
  }
}

/** The value as it appears in the editor (and on the clipboard). */
export function editText(t: Transaction, key: ColKey, lookup: Lookup, { draft = false } = {}): string {
  switch (key) {
    case 'occurredAt':
      return t.occurredAt ? formatLocal(toLocal(t.occurredAt)) : draft ? formatLocal(nowLocal()) : '';
    case 'amount':
      return amountEditText(t.amount);
    default:
      return displayText(t, key, lookup);
  }
}

export function baseParts(t: Transaction): LocalParts {
  return t.occurredAt ? toLocal(t.occurredAt) : nowLocal();
}

type Parsed = { ok: true; value: NewTransaction[ColKey] } | { ok: false; error: string };

/** Turns editor text into a stored value; names become ids. */
export function parseCell(key: ColKey, raw: string, row: Transaction, lookup: Lookup): Parsed {
  const text = raw.trim();
  switch (key) {
    case 'amount': {
      const parsed = parseAmount(text);
      if (parsed.kind === 'invalid') return { ok: false, error: 'Not a number — try -12,50 or 2850' };
      return { ok: true, value: parsed.kind === 'amount' ? parsed.value : null };
    }
    case 'occurredAt': {
      if (!text) return { ok: true, value: null };
      const p = parseLocalInput(text, baseParts(row));
      return p
        ? { ok: true, value: fromLocal(p) }
        : { ok: false, error: 'Unrecognised date — try 20.10 14:30, t or y' };
    }
    case 'accountId': {
      if (!text) return { ok: true, value: null };
      const a = [...lookup.accounts.values()].find((x) => sameName(x.name, text));
      return a ? { ok: true, value: a.id as AccountId } : { ok: false, error: 'Unknown account — add it in Settings' };
    }
    case 'categoryId': {
      if (!text) return { ok: true, value: null };
      const c = [...lookup.categories.values()].find((x) => sameName(x.name, text));
      if (c) return { ok: true, value: c.id as CategoryId };
      const isGroup = [...lookup.groups.values()].some((g) => sameName(g.name, text));
      return {
        ok: false,
        error: isGroup ? 'That is a group — pick one of its categories' : 'Unknown category — add it in Settings',
      };
    }
    default:
      return { ok: true, value: text || null };
  }
}

/** The text a paste puts into a cell: a block copied from a spreadsheet pastes its first cell, and an amount copied
 * from a bank page loses its currency sign. */
export function pastedText(clipboardText: string, key: ColKey): string {
  const text = clipboardText.split(/\r?\n/)[0].split('\t')[0].trim();
  return key === 'amount' && parseAmount(text).kind === 'invalid' ? text.replace(/\p{Sc}/gu, '') : text;
}
