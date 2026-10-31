import type { Db } from './db.ts';
import { createAccounts } from './service/accounts.ts';
import { createCategories } from './service/categories.ts';
import { createDataSetup } from './service/dataSetup.ts';
import { createPreferences } from './service/preferences.ts';
import { createTransactions } from './service/transactions.ts';

export type Service = ReturnType<typeof createService>;

export function createService(db: Db) {
  const accounts = createAccounts(db);
  const preferences = createPreferences(db);
  const categories = createCategories(db, preferences);
  const transactions = createTransactions(db, accounts, categories);
  return {
    accounts,
    categories,
    preferences,
    transactions,
    ...createDataSetup(db, accounts, categories, transactions),
  };
}
