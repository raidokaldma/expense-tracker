import { demoData } from '../../shared/demo.ts';
import { nowTimestamp } from '../../shared/time.ts';
import { type Db, inTransaction } from '../db.ts';
import { EXAMPLE_SEED, readSeed, type Seed } from '../seed.ts';
import type { Accounts } from './accounts.ts';
import type { Categories } from './categories.ts';
import type { Transactions } from './transactions.ts';

/** Filling a new database: from a seed file, or (for tests and `npm run seed:demo`) with example data. */
export function createDataSetup(db: Db, accounts: Accounts, categories: Categories, transactions: Transactions) {
  return {
    isEmpty: () => transactions.isEmpty() && accounts.list().length === 0,

    seed({ tree, transactions: rows }: Seed) {
      inTransaction(db, () => {
        categories.insertTree(tree);
        const now = nowTimestamp();
        // added when it happened, so years of history sort by date in the default order
        // biome-ignore lint/complexity/useMathMinMax: timestamps are strings, which Math.min cannot compare
        for (const t of rows) transactions.insertImported(t, [], now, t.occurredAt < now ? t.occurredAt : now);
      });
    },

    /** Wipes everything and loads the example seed's categories (not its transactions), plus the demo set if asked. */
    reset(demo: boolean) {
      inTransaction(db, () => {
        db.exec(`DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories;
          DELETE FROM category_groups; DELETE FROM preferences;`);
        const { tree } = readSeed(EXAMPLE_SEED);
        categories.insertTree(tree);
        if (!demo) return;
        const data = demoData(tree);
        for (const a of data.accounts) accounts.insert(a);
        for (const t of data.transactions) transactions.insert(t);
      });
    },
  };
}
