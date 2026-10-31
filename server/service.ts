import { demoData } from '../src/model/demo.ts';
import { newAccountId, newTransactionId } from '../src/model/ids.ts';
import { sameName } from '../src/model/names.ts';
import {
  type CategoryChangeInput,
  type CreateTransactionInput,
  DEFAULT_PREFERENCES,
  type ImportRow,
  type Issue,
  preferencesSchema,
} from '../src/model/schemas.ts';
import { nowTimestamp } from '../src/model/time.ts';
import type {
  Account,
  AccountId,
  Category,
  CategoryGroup,
  CategoryTree,
  ImportConflict,
  ImportResult,
  NewTransaction,
  Preferences,
  Transaction,
  TransactionId,
} from '../src/model/types.ts';
import { type Db, transaction } from './db.ts';
import { EXAMPLE_SEED, readSeed, type Seed, type SeedTransaction } from './seed.ts';

/** A failure the client caused; becomes an HTTP error response. */
export class HttpError extends Error {
  readonly status: number;
  readonly issues: Issue[];
  constructor(status: number, message: string, issues: Issue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

const invalid = (path: (string | number)[], message: string) =>
  new HttpError(422, 'Invalid request', [{ path, message }]);

const TRANSACTION_COLUMNS = `id, external_id AS externalId, account_id AS accountId, occurred_at AS occurredAt,
  counterparty, amount, category_id AS categoryId, description, added_at AS addedAt, updated_at AS updatedAt`;
const ACCOUNT_COLUMNS = 'id, name, import_key AS importKey';

export type Service = ReturnType<typeof createService>;

export function createService(db: Db) {
  const sql = {
    listTransactions: db.prepare(`SELECT ${TRANSACTION_COLUMNS} FROM transactions`),
    getTransaction: db.prepare(`SELECT ${TRANSACTION_COLUMNS} FROM transactions WHERE id = ?`),
    insertTransaction: db.prepare(
      `INSERT INTO transactions (id, external_id, account_id, occurred_at, counterparty, amount, category_id,
        description, added_at, updated_at)
       VALUES (:id, :externalId, :accountId, :occurredAt, :counterparty, :amount, :categoryId, :description,
        :addedAt, :updatedAt)`,
    ),
    updateTransaction: db.prepare(
      `UPDATE transactions SET account_id = :accountId, occurred_at = :occurredAt, counterparty = :counterparty,
        amount = :amount, category_id = :categoryId, description = :description, updated_at = :updatedAt
       WHERE id = :id`,
    ),
    deleteTransaction: db.prepare('DELETE FROM transactions WHERE id = ?'),
    externalIdExists: db.prepare('SELECT 1 FROM transactions WHERE external_id = ? LIMIT 1'),
    savedForExternalId: db.prepare(
      `SELECT id, occurred_at AS occurredAt, counterparty, amount, description FROM transactions
       WHERE external_id = ? ORDER BY added_at, rowid`,
    ),
    addedSince: db.prepare('SELECT 1 FROM transactions WHERE external_id = ? AND added_at > ? LIMIT 1'),
    countForAccount: db.prepare('SELECT count(*) AS n FROM transactions WHERE account_id = ?'),
    countTransactions: db.prepare('SELECT count(*) AS n FROM transactions'),

    listAccounts: db.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts`),
    getAccount: db.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`),
    accountByImportKey: db.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE import_key = ?`),
    insertAccount: db.prepare('INSERT INTO accounts (id, name, import_key) VALUES (:id, :name, :importKey)'),
    renameAccount: db.prepare('UPDATE accounts SET name = ? WHERE id = ?'),
    deleteAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),

    listGroups: db.prepare('SELECT id, name, kind, sort_order AS "order" FROM category_groups'),
    listCategories: db.prepare('SELECT id, group_id AS groupId, name, sort_order AS "order" FROM categories'),
    categoryExists: db.prepare('SELECT 1 FROM categories WHERE id = ?'),
    insertGroup: db.prepare(
      'INSERT INTO category_groups (id, name, kind, sort_order) VALUES (:id, :name, :kind, :order)',
    ),
    insertCategory: db.prepare(
      'INSERT INTO categories (id, group_id, name, sort_order) VALUES (:id, :groupId, :name, :order)',
    ),
    moveCategory: db.prepare('UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?'),

    getPreferences: db.prepare('SELECT value FROM preferences WHERE id = 1'),
    putPreferences: db.prepare('INSERT OR REPLACE INTO preferences (id, value) VALUES (1, ?)'),
  };

  // rows come back as null-prototype objects; spread them into plain ones
  const all = <T>(statement: { all(): unknown[] }) => statement.all().map((r) => ({ ...(r as T) }));

  const getTransaction = (id: TransactionId) => {
    const row = sql.getTransaction.get(id);
    if (!row) throw new HttpError(404, 'Transaction not found');
    return { ...(row as unknown as Transaction) };
  };

  /** Referenced accounts and categories must exist. */
  function checkReferences(t: Partial<NewTransaction>) {
    if (t.accountId && !sql.getAccount.get(t.accountId)) throw invalid(['accountId'], 'no such account');
    if (t.categoryId && !sql.categoryExists.get(t.categoryId)) throw invalid(['categoryId'], 'no such category');
  }

  const accountNamed = (name: string, exceptId?: AccountId) =>
    all<Account>(sql.listAccounts).find((a) => a.id !== exceptId && sameName(a.name, name));

  /** Stored settings, each one falling back to its default on its own if it no longer fits. */
  function getPreferences(): Preferences {
    const row = sql.getPreferences.get() as { value: string } | undefined;
    const stored = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    const prefs: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
    for (const [key, schema] of Object.entries(preferencesSchema.shape)) {
      const parsed = schema.safeParse(stored[key]);
      if (parsed.success) prefs[key] = parsed.data;
    }
    return prefs as unknown as Preferences;
  }

  /** The account an import key lands in, created (named after the key, "Northmere Bank 2" if taken) when new. */
  function accountFor(key: string, created: Account[]): Account {
    const found = sql.accountByImportKey.get(key) as Account | undefined;
    if (found) return { ...found };
    let name = key;
    for (let n = 2; accountNamed(name); n++) name = `${key.slice(0, 95)} ${n}`;
    const account: Account = { id: newAccountId(), name, importKey: key };
    sql.insertAccount.run({ ...account });
    created.push(account);
    return account;
  }

  function insertImported(r: SeedTransaction, now: string, created: Account[], addedAt = now) {
    sql.insertTransaction.run({
      id: newTransactionId(),
      externalId: r.externalId,
      accountId: accountFor(r.account, created).id,
      occurredAt: r.occurredAt,
      counterparty: r.counterparty,
      amount: r.amount,
      categoryId: r.categoryId,
      description: r.description ?? null,
      addedAt,
      updatedAt: now,
    });
  }

  function insertTree(tree: CategoryTree) {
    for (const g of tree.groups) sql.insertGroup.run({ ...g });
    for (const c of tree.categories) sql.insertCategory.run({ ...c });
  }

  return {
    listTransactions: () => all<Transaction>(sql.listTransactions),

    createTransaction(input: CreateTransactionInput): Transaction {
      return transaction(db, () => {
        const { addedAt, ...fields } = input;
        // a bank id can only be copied from an existing row (a split), never made up
        if (fields.externalId && !sql.externalIdExists.get(fields.externalId))
          throw invalid(['externalId'], 'only a split may carry a transaction id, and it must exist');
        checkReferences(fields);
        const now = nowTimestamp();
        if (addedAt && addedAt > now) throw invalid(['addedAt'], 'must not be in the future');
        const row: Transaction = { ...fields, id: newTransactionId(), addedAt: addedAt ?? now, updatedAt: now };
        sql.insertTransaction.run({ ...row });
        return row;
      });
    },

    /** Changes the editable fields; the bank id and import time never change. */
    updateTransaction(id: TransactionId, patch: Partial<NewTransaction>): Transaction {
      return transaction(db, () => {
        const row: Transaction = { ...getTransaction(id), ...patch, updatedAt: nowTimestamp() };
        checkReferences(patch);
        const { externalId: _externalId, addedAt: _addedAt, ...fields } = row;
        sql.updateTransaction.run(fields);
        return row;
      });
    },

    removeTransaction(id: TransactionId) {
      if (!sql.deleteTransaction.run(id).changes) throw new HttpError(404, 'Transaction not found');
    },

    /** Undo of a delete: the row comes back exactly as it was. It cannot replace a row that exists. */
    restoreTransaction(row: Transaction): Transaction {
      return transaction(db, () => {
        if (sql.getTransaction.get(row.id)) throw new HttpError(409, 'The transaction already exists');
        if (row.updatedAt > nowTimestamp()) throw invalid(['updatedAt'], 'must not be in the future');
        if (row.addedAt > row.updatedAt) throw invalid(['addedAt'], 'must not be after updatedAt');
        // the bank sent it again after it was deleted (splits keep their original's older addedAt)
        if (row.externalId && sql.addedSince.get(row.externalId, row.updatedAt))
          throw new HttpError(409, 'The transaction was imported again after it was deleted');
        checkReferences(row);
        sql.insertTransaction.run({ ...row });
        return row;
      });
    },

    /**
     * All or nothing. A transaction id already present (on any row, splits included) is skipped, so edits made in
     * the app are never overwritten; deleting every row with that id lets the next import bring it back. A skipped
     * id whose amount no longer matches (the bank or seller changed it) is reported in `ignoredConflicts`.
     */
    importTransactions(rows: ImportRow[]): ImportResult {
      return transaction(db, () => {
        const now = nowTimestamp();
        const skipped: string[] = [];
        const ignoredConflicts: ImportConflict[] = [];
        const newAccounts: Account[] = [];
        let added = 0;
        for (const r of rows) {
          const saved = sql.savedForExternalId.all(r.externalId) as ImportConflict['saved'];
          if (saved.length) {
            skipped.push(r.externalId);
            // a split's parts add up; one with no amount yet counts as 0
            const savedAmount = saved.reduce((sum, t) => sum + (t.amount ?? 0), 0);
            if (savedAmount !== r.amount) {
              const rows = saved.map((t) => ({ ...t }));
              ignoredConflicts.push({ externalId: r.externalId, savedAmount, sentAmount: r.amount, saved: rows });
            }
            continue;
          }
          insertImported({ ...r, categoryId: null }, now, newAccounts);
          added++;
        }
        return { added, skipped, ignoredConflicts, newAccounts };
      });
    },

    listAccounts: () => all<Account>(sql.listAccounts),

    createAccount(name: string): Account {
      return transaction(db, () => {
        if (accountNamed(name)) throw new HttpError(409, `“${name}” already exists`);
        const account: Account = { id: newAccountId(), name, importKey: null };
        sql.insertAccount.run({ ...account });
        return account;
      });
    },

    renameAccount(id: AccountId, name: string): Account {
      return transaction(db, () => {
        const account = sql.getAccount.get(id) as Account | undefined;
        if (!account) throw new HttpError(404, 'Account not found');
        if (accountNamed(name, id)) throw new HttpError(409, `“${name}” already exists`);
        sql.renameAccount.run(name, id);
        return { ...account, name };
      });
    },

    removeAccount(id: AccountId) {
      transaction(db, () => {
        if (!sql.getAccount.get(id)) throw new HttpError(404, 'Account not found');
        const { n } = sql.countForAccount.get(id) as { n: number };
        if (n) throw new HttpError(409, `The account has ${n} transactions`);
        sql.deleteAccount.run(id);
      });
    },

    categoryTree: (): CategoryTree => ({
      groups: all<CategoryGroup>(sql.listGroups),
      categories: all<Category>(sql.listCategories),
    }),

    /** Replaces the whole tree. Transactions of deleted categories move per moveTo, or become uncategorized. */
    saveCategories(change: CategoryChangeInput) {
      transaction(db, () => {
        const kept = new Set<string>(change.categories.map((c) => c.id));
        const removed = all<Category>(sql.listCategories)
          .map((c) => c.id as string)
          .filter((id) => !kept.has(id));
        for (const from of Object.keys(change.moveTo))
          if (!removed.includes(from)) throw invalid(['moveTo', from], 'no such category');
        const now = nowTimestamp();
        for (const id of removed) sql.moveCategory.run(change.moveTo[id] ?? null, now, id);
        db.exec('DELETE FROM categories; DELETE FROM category_groups;');
        insertTree(change);
        // deleted categories no longer count as hidden
        const prefs = getPreferences();
        const hidden = prefs.hiddenCategoryIds.filter((id) => kept.has(id));
        if (hidden.length !== prefs.hiddenCategoryIds.length)
          sql.putPreferences.run(JSON.stringify({ ...prefs, hiddenCategoryIds: hidden }));
      });
    },

    getPreferences,

    setPreferences(patch: Partial<Preferences>) {
      transaction(db, () => {
        patch.hiddenCategoryIds?.forEach((id, i) => {
          if (!sql.categoryExists.get(id)) throw invalid(['hiddenCategoryIds', i], 'no such category');
        });
        sql.putPreferences.run(JSON.stringify({ ...getPreferences(), ...patch }));
      });
    },

    /** A seed file's categories and transactions, into a new database. */
    seed({ tree, transactions }: Seed) {
      transaction(db, () => {
        insertTree(tree);
        const now = nowTimestamp();
        // added when it happened, so years of history sort by date in the default order
        // biome-ignore lint/complexity/useMathMinMax: timestamps are strings, which Math.min cannot compare
        for (const t of transactions) insertImported(t, now, [], t.occurredAt < now ? t.occurredAt : now);
      });
    },

    isEmpty: () => (sql.countTransactions.get() as { n: number }).n === 0 && sql.listAccounts.all().length === 0,

    /**
     * Wipes everything and loads the example seed's categories (not its transactions), plus the 8,725-row demo set
     * if asked.
     * For tests and `npm run seed:demo`.
     */
    reset(demo: boolean) {
      transaction(db, () => {
        db.exec(`DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories;
          DELETE FROM category_groups; DELETE FROM preferences;`);
        const { tree } = readSeed(EXAMPLE_SEED);
        insertTree(tree);
        if (!demo) return;
        const { accounts, transactions } = demoData(tree);
        for (const a of accounts) sql.insertAccount.run({ ...a });
        for (const t of transactions) sql.insertTransaction.run({ ...t });
      });
    },
  };
}
