import { newAccountId } from '../../shared/ids.ts';
import { sameName } from '../../shared/names.ts';
import type { Account, AccountId } from '../../shared/types.ts';
import { type Db, inTransaction } from '../db.ts';
import { ConflictError, NotFoundError } from '../errors.ts';
import { allRows, oneRow } from './rows.ts';

const COLUMNS = 'id, name, import_key AS importKey';
const MAX_NAME = 100;

export type Accounts = ReturnType<typeof createAccounts>;

export function createAccounts(db: Db) {
  const sql = {
    list: db.prepare(`SELECT ${COLUMNS} FROM accounts`),
    get: db.prepare(`SELECT ${COLUMNS} FROM accounts WHERE id = ?`),
    byImportKey: db.prepare(`SELECT ${COLUMNS} FROM accounts WHERE import_key = ?`),
    insert: db.prepare('INSERT INTO accounts (id, name, import_key) VALUES (:id, :name, :importKey)'),
    rename: db.prepare('UPDATE accounts SET name = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM accounts WHERE id = ?'),
    transactionCount: db.prepare('SELECT count(*) AS n FROM transactions WHERE account_id = ?'),
  };

  const list = () => allRows<Account>(sql.list);
  const get = (id: AccountId) => oneRow<Account>(sql.get, id);
  const named = (name: string, exceptId?: AccountId) => list().find((a) => a.id !== exceptId && sameName(a.name, name));
  const insert = (account: Account) => sql.insert.run({ ...account });

  /** A name that is not taken yet: the name itself, else "Northmere Bank 2", "… 3" and so on. */
  function freeName(name: string) {
    let candidate = name;
    for (let n = 2; named(candidate); n++) {
      const suffix = ` ${n}`;
      candidate = name.slice(0, MAX_NAME - suffix.length) + suffix;
    }
    return candidate;
  }

  return {
    list,
    exists: (id: AccountId) => !!get(id),
    insert,

    /** The account an import key lands in; a new key creates one, named after it, and adds it to `created`. */
    forImportKey(key: string, created: Account[]): Account {
      const found = oneRow<Account>(sql.byImportKey, key);
      if (found) return found;
      const account: Account = { id: newAccountId(), name: freeName(key), importKey: key };
      insert(account);
      created.push(account);
      return account;
    },

    create(name: string): Account {
      return inTransaction(db, () => {
        if (named(name)) throw new ConflictError(`“${name}” already exists`);
        const account: Account = { id: newAccountId(), name, importKey: null };
        insert(account);
        return account;
      });
    },

    rename(id: AccountId, name: string): Account {
      return inTransaction(db, () => {
        const account = get(id);
        if (!account) throw new NotFoundError('Account not found');
        if (named(name, id)) throw new ConflictError(`“${name}” already exists`);
        sql.rename.run(name, id);
        return { ...account, name };
      });
    },

    remove(id: AccountId) {
      inTransaction(db, () => {
        if (!get(id)) throw new NotFoundError('Account not found');
        const { n } = sql.transactionCount.get(id) as { n: number };
        if (n) throw new ConflictError(`The account has ${n} transactions`);
        sql.remove.run(id);
      });
    },
  };
}
