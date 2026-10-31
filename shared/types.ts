declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TransactionId = Brand<string, 'TransactionId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type CategoryGroupId = Brand<string, 'CategoryGroupId'>;

/** ISO 8601 in UTC, always with zone: "2026-10-20T11:30:00Z". Displayed in Europe/Tallinn. */
export type Timestamp = Brand<string, 'Timestamp'>;

/** Signed integer in hundredths: -4837 = −48,37. Negative = money out. */
export type Amount = number;

// Stored entities

export interface Transaction {
  id: TransactionId;
  /** Bank transaction id from import; null for rows typed in by hand.
   *  Not unique: split rows share their original's value. Import skips any externalId already present. */
  externalId: string | null;
  accountId: AccountId | null;
  occurredAt: Timestamp | null;
  /** Recipient or payer. */
  counterparty: string | null;
  amount: Amount | null;
  categoryId: CategoryId | null;
  description: string | null;
  /** When the row entered the app; drives the "import" sort order. */
  addedAt: Timestamp;
  /** Last change; restoring a deleted row checks it against later imports of the same bank id. */
  updatedAt: Timestamp;
}

/** Created in Settings or by the first import that mentions it; only an account without transactions can be deleted. */
export interface Account {
  id: AccountId;
  name: string;
  /** Account identifier as sent by the push service; matches imports to this account. Never shown.
   *  null for accounts created by hand: imports never land in them. */
  importKey: string | null;
}

export const CATEGORY_KINDS = ['income', 'expense', 'transfer', 'opening'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface CategoryGroup {
  id: CategoryGroupId;
  name: string;
  kind: CategoryKind;
  /** Sort position within its kind. */
  order: number;
}

export interface Category {
  id: CategoryId;
  groupId: CategoryGroupId;
  name: string;
  /** Sort position within its group. */
  order: number;
}

export const OVERVIEW_PERIODS = ['last3', 'last12', 'all'] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export const TRANSACTION_SORTS = ['addedAt', 'occurredAt'] as const;
export type TransactionSort = (typeof TRANSACTION_SORTS)[number];

/** View settings, stored on the server so they follow you between devices. */
export interface Preferences {
  overviewPeriod: OverviewPeriod;
  hiddenCategoryIds: CategoryId[];
  transactionSort: TransactionSort;
}

// Derived in the browser (never stored, never fetched)

export type RequiredField = 'accountId' | 'occurredAt' | 'counterparty' | 'amount' | 'categoryId';

/** Fields missing on a row; empty = valid. Invalid rows are excluded from Overview. */
export type MissingFields = RequiredField[];

// Import (push API payload)

export interface ImportTransaction {
  /** The dedupe key. */
  externalId: string;
  /** Matched against Account.importKey; an unknown key creates a new Account named after it. */
  account: string;
  /** Any offset accepted, stored converted to UTC. */
  occurredAt: string;
  /** Recipient or payer. */
  counterparty: string;
  amount: Amount;
  description?: string | null;
}

export interface ImportConflict {
  externalId: string;
  savedAmount: Amount;
  sentAmount: Amount;
  /** The rows with that id: one, or the parts of a split, in the order they were added. */
  saved: Pick<Transaction, 'id' | 'occurredAt' | 'counterparty' | 'amount' | 'description'>[];
}

export interface ImportResult {
  added: number;
  /** externalIds already present, not imported. */
  skipped: string[];
  /**
   * Skipped ids whose amount differs: what the app has (all rows with that id, so splits add up) and what was sent.
   * The saved rows are kept as they are.
   */
  ignoredConflicts: ImportConflict[];
  /** Accounts created by this import. */
  newAccounts: Account[];
}

// API

export type NewTransaction = Omit<Transaction, 'id' | 'addedAt' | 'updatedAt'>;

/** A new row. A split copies its original's externalId and addedAt, so it sorts next to it. */
export type CreateTransaction = NewTransaction & { addedAt?: Timestamp };

export interface CategoryTree {
  groups: CategoryGroup[];
  categories: Category[];
}

export interface CategoryChange extends CategoryTree {
  /** Deleted category -> category that receives its transactions. */
  moveTo: Partial<Record<CategoryId, CategoryId>>;
}
