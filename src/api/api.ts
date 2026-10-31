import type {
  Account,
  AccountId,
  CategoryChange,
  CategoryTree,
  CreateTransaction,
  ImportResult,
  ImportTransaction,
  NewTransaction,
  Preferences,
  Transaction,
  TransactionId,
} from '../../shared/types';

export interface Api {
  transactions: {
    list(): Promise<Transaction[]>;
    create(t: CreateTransaction): Promise<Transaction>;
    update(id: TransactionId, patch: Partial<NewTransaction>): Promise<Transaction>;
    remove(id: TransactionId): Promise<void>;
    /** Puts back a deleted row exactly as it was, original id included; used by undo. */
    restore(row: Transaction): Promise<Transaction>;
    import(rows: ImportTransaction[]): Promise<ImportResult>;
  };
  accounts: {
    list(): Promise<Account[]>;
    create(name: string): Promise<Account>;
    rename(id: AccountId, name: string): Promise<Account>;
    /** Only an account without transactions can be deleted. */
    remove(id: AccountId): Promise<void>;
  };
  categories: {
    tree(): Promise<CategoryTree>;
    /** Applies all Settings edits at once; moveTo reassigns transactions of deleted categories. */
    save(change: CategoryChange): Promise<void>;
  };
  preferences: {
    get(): Promise<Preferences>;
    set(p: Partial<Preferences>): Promise<void>;
  };
}
