import { newTransactionId } from '../../shared/ids.ts';
import type { CreateTransactionInput, ImportRow } from '../../shared/schemas.ts';
import { nowTimestamp } from '../../shared/time.ts';
import type {
  Account,
  ImportConflict,
  ImportResult,
  NewTransaction,
  Timestamp,
  Transaction,
  TransactionId,
} from '../../shared/types.ts';
import { type Db, inTransaction } from '../db.ts';
import { ConflictError, invalid, NotFoundError } from '../errors.ts';
import type { SeedTransaction } from '../seed.ts';
import type { Accounts } from './accounts.ts';
import type { Categories } from './categories.ts';
import { allRows, oneRow } from './rows.ts';

const COLUMNS = `id, external_id AS externalId, account_id AS accountId, occurred_at AS occurredAt,
  counterparty, amount, category_id AS categoryId, description, added_at AS addedAt, updated_at AS updatedAt`;

export type Transactions = ReturnType<typeof createTransactions>;

export function createTransactions(db: Db, accounts: Accounts, categories: Categories) {
  const sql = {
    list: db.prepare(`SELECT ${COLUMNS} FROM transactions`),
    get: db.prepare(`SELECT ${COLUMNS} FROM transactions WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO transactions (id, external_id, account_id, occurred_at, counterparty, amount, category_id,
        description, added_at, updated_at)
       VALUES (:id, :externalId, :accountId, :occurredAt, :counterparty, :amount, :categoryId, :description,
        :addedAt, :updatedAt)`,
    ),
    update: db.prepare(
      `UPDATE transactions SET account_id = :accountId, occurred_at = :occurredAt, counterparty = :counterparty,
        amount = :amount, category_id = :categoryId, description = :description, updated_at = :updatedAt
       WHERE id = :id`,
    ),
    remove: db.prepare('DELETE FROM transactions WHERE id = ?'),
    externalIdExists: db.prepare('SELECT 1 FROM transactions WHERE external_id = ? LIMIT 1'),
    savedForExternalId: db.prepare(
      `SELECT id, occurred_at AS occurredAt, counterparty, amount, description FROM transactions
       WHERE external_id = ? ORDER BY added_at, rowid`,
    ),
    addedSince: db.prepare('SELECT 1 FROM transactions WHERE external_id = ? AND added_at > ? LIMIT 1'),
    count: db.prepare('SELECT count(*) AS n FROM transactions'),
  };

  function get(id: TransactionId): Transaction {
    const row = oneRow<Transaction>(sql.get, id);
    if (!row) throw new NotFoundError('Transaction not found');
    return row;
  }

  const insert = (row: Transaction) => sql.insert.run({ ...row });

  /** Referenced accounts and categories must exist. */
  function checkReferences(t: Partial<NewTransaction>) {
    if (t.accountId && !accounts.exists(t.accountId)) throw invalid(['accountId'], 'no such account');
    if (t.categoryId && !categories.exists(t.categoryId)) throw invalid(['categoryId'], 'no such category');
  }

  function insertImported(r: SeedTransaction, created: Account[], now: Timestamp, addedAt = now) {
    insert({
      id: newTransactionId(),
      externalId: r.externalId,
      accountId: accounts.forImportKey(r.account, created).id,
      occurredAt: r.occurredAt,
      counterparty: r.counterparty,
      amount: r.amount,
      categoryId: r.categoryId,
      description: r.description ?? null,
      addedAt,
      updatedAt: now,
    });
  }

  /** What the app has for a bank id, when the amount sent differs from it; a split's parts add up. */
  function conflictWith(r: ImportRow, saved: ImportConflict['saved']): ImportConflict | null {
    const savedAmount = saved.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return savedAmount === r.amount ? null : { externalId: r.externalId, savedAmount, sentAmount: r.amount, saved };
  }

  return {
    insert,
    insertImported,
    isEmpty: () => (sql.count.get() as { n: number }).n === 0,
    list: () => allRows<Transaction>(sql.list),

    create(input: CreateTransactionInput): Transaction {
      return inTransaction(db, () => {
        const { addedAt, ...fields } = input;
        // a bank id can only be copied from an existing row (a split), never made up
        if (fields.externalId && !sql.externalIdExists.get(fields.externalId))
          throw invalid(['externalId'], 'only a split may carry a transaction id, and it must exist');
        checkReferences(fields);
        const now = nowTimestamp();
        if (addedAt && addedAt > now) throw invalid(['addedAt'], 'must not be in the future');
        const row: Transaction = { ...fields, id: newTransactionId(), addedAt: addedAt ?? now, updatedAt: now };
        insert(row);
        return row;
      });
    },

    /** Changes the editable fields; the bank id and import time never change. */
    update(id: TransactionId, patch: Partial<NewTransaction>): Transaction {
      return inTransaction(db, () => {
        const row: Transaction = { ...get(id), ...patch, updatedAt: nowTimestamp() };
        checkReferences(patch);
        const { externalId: _externalId, addedAt: _addedAt, ...fields } = row;
        sql.update.run(fields);
        return row;
      });
    },

    remove(id: TransactionId) {
      if (!sql.remove.run(id).changes) throw new NotFoundError('Transaction not found');
    },

    /** Undo of a delete: the row comes back exactly as it was. It cannot replace a row that exists. */
    restore(row: Transaction): Transaction {
      return inTransaction(db, () => {
        if (sql.get.get(row.id)) throw new ConflictError('The transaction already exists');
        if (row.updatedAt > nowTimestamp()) throw invalid(['updatedAt'], 'must not be in the future');
        if (row.addedAt > row.updatedAt) throw invalid(['addedAt'], 'must not be after updatedAt');
        // the bank sent it again after it was deleted (splits keep their original's older addedAt)
        if (row.externalId && sql.addedSince.get(row.externalId, row.updatedAt))
          throw new ConflictError('The transaction was imported again after it was deleted');
        checkReferences(row);
        insert(row);
        return row;
      });
    },

    /**
     * All or nothing. A transaction id already present (on any row, splits included) is skipped, so edits made in
     * the app are never overwritten; deleting every row with that id lets the next import bring it back. A skipped
     * id whose amount no longer matches (the bank or seller changed it) is reported in `ignoredConflicts`.
     */
    import(rows: ImportRow[]): ImportResult {
      return inTransaction(db, () => {
        const now = nowTimestamp();
        const result: ImportResult = { added: 0, skipped: [], ignoredConflicts: [], newAccounts: [] };
        for (const r of rows) {
          const saved = allRows<ImportConflict['saved'][number]>(sql.savedForExternalId, r.externalId);
          if (!saved.length) {
            insertImported({ ...r, categoryId: null }, result.newAccounts, now);
            result.added++;
            continue;
          }
          result.skipped.push(r.externalId);
          const conflict = conflictWith(r, saved);
          if (conflict) result.ignoredConflicts.push(conflict);
        }
        return result;
      });
    },
  };
}
