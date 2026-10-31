// Data model, as agreed in the requirements document.

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TransactionId = Brand<string, 'TransactionId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type CategoryGroupId = Brand<string, 'CategoryGroupId'>;

/** ISO 8601 in UTC, always with zone: "2026-10-20T11:30:00Z". Displayed in Europe/Tallinn. */
export type Timestamp = Brand<string, 'Timestamp'>;

/** Signed integer in hundredths: -4837 = −48,37. Negative = money out. */
export type Amount = number;

// ---------- Stored entities ----------

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
  /** Last change; needed later for syncing with the backend. */
  updatedAt: Timestamp;
}

/** Created in Settings or automatically the first time an import mentions it; renamable, never deleted. */
export interface Account {
  id: AccountId;
  /** Display name, editable. */
  name: string;
  /** Account identifier as sent by the push service; matches imports to this account. Never shown.
   *  null for accounts created by hand: imports never land in them. */
  importKey: string | null;
}

export type CategoryKind = 'income' | 'expense' | 'transfer' | 'opening';

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

export type OverviewPeriod = 'last3' | 'last12' | 'all';

/** View settings, stored on the server so they follow you between devices. */
export interface Preferences {
  overviewPeriod: OverviewPeriod;
  hiddenCategoryIds: CategoryId[];
  transactionSort: 'addedAt' | 'occurredAt';
}

// ---------- Derived in the browser (never stored, never fetched) ----------

export type RequiredField = 'accountId' | 'occurredAt' | 'counterparty' | 'amount' | 'categoryId';

/** Fields missing on a row; empty = valid. Invalid rows are excluded from Overview. */
export type MissingFields = RequiredField[];

export interface AccountSummary {
  accountId: AccountId;
  total: Amount;
  transactionCount: number;
}

// ---------- Import (push API payload) ----------

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

// ---------- API (REST, served by server/; all filtering happens in the browser) ----------

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

export interface Api {
  transactions: {
    list(): Promise<Transaction[]>; // GET    /transactions
    create(t: CreateTransaction): Promise<Transaction>; // POST   /transactions
    update(id: TransactionId, patch: Partial<NewTransaction>): Promise<Transaction>; // PATCH  /transactions/:id
    remove(id: TransactionId): Promise<void>; // DELETE /transactions/:id
    /** Puts back a row exactly as it was, original id included; used by undo. */
    restore(row: Transaction): Promise<Transaction>; // PUT    /transactions/:id
    import(rows: ImportTransaction[]): Promise<ImportResult>; // POST   /transactions/import
  };
  accounts: {
    list(): Promise<Account[]>; // GET    /accounts
    create(name: string): Promise<Account>; // POST   /accounts
    rename(id: AccountId, name: string): Promise<Account>; // PATCH  /accounts/:id
    /** Only an account without transactions can be deleted. */
    remove(id: AccountId): Promise<void>; // DELETE /accounts/:id
  };
  categories: {
    tree(): Promise<CategoryTree>; // GET    /categories
    /** Applies all Settings edits at once (Save). moveTo reassigns transactions of deleted categories. */
    save(change: CategoryChange): Promise<void>; // PUT    /categories
  };
  preferences: {
    get(): Promise<Preferences>; // GET    /preferences
    set(p: Partial<Preferences>): Promise<void>; // PATCH  /preferences
  };
}

// ---------- Undo (in memory only) ----------

export type UndoEntry =
  | { kind: 'update'; id: TransactionId; before: Partial<NewTransaction>; after: Partial<NewTransaction> }
  | { kind: 'create'; row: Transaction }
  /** Rows deleted together, undone together. */
  | { kind: 'remove'; rows: Transaction[] };
