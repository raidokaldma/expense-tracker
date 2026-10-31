import type { CategoryChangeInput } from '../../shared/schemas.ts';
import { nowTimestamp } from '../../shared/time.ts';
import type { Category, CategoryGroup, CategoryId, CategoryTree } from '../../shared/types.ts';
import { type Db, inTransaction } from '../db.ts';
import { invalid } from '../errors.ts';
import type { PreferencesStore } from './preferences.ts';
import { allRows } from './rows.ts';

export type Categories = ReturnType<typeof createCategories>;

export function createCategories(db: Db, preferences: PreferencesStore) {
  const sql = {
    listGroups: db.prepare('SELECT id, name, kind, sort_order AS "order" FROM category_groups'),
    list: db.prepare('SELECT id, group_id AS groupId, name, sort_order AS "order" FROM categories'),
    exists: db.prepare('SELECT 1 FROM categories WHERE id = ?'),
    insertGroup: db.prepare(
      'INSERT INTO category_groups (id, name, kind, sort_order) VALUES (:id, :name, :kind, :order)',
    ),
    insert: db.prepare('INSERT INTO categories (id, group_id, name, sort_order) VALUES (:id, :groupId, :name, :order)'),
    moveTransactions: db.prepare('UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?'),
  };

  function insertTree(tree: CategoryTree) {
    for (const g of tree.groups) sql.insertGroup.run({ ...g });
    for (const c of tree.categories) sql.insert.run({ ...c });
  }

  return {
    exists: (id: CategoryId) => !!sql.exists.get(id),
    insertTree,

    tree: (): CategoryTree => ({
      groups: allRows<CategoryGroup>(sql.listGroups),
      categories: allRows<Category>(sql.list),
    }),

    /** Replaces the whole tree. Transactions of deleted categories move per moveTo, or become uncategorized. */
    save(change: CategoryChangeInput) {
      inTransaction(db, () => {
        const kept = new Set<CategoryId>(change.categories.map((c) => c.id));
        const removed = allRows<Category>(sql.list)
          .map((c) => c.id)
          .filter((id) => !kept.has(id));
        for (const from of Object.keys(change.moveTo))
          if (!removed.includes(from as CategoryId)) throw invalid(['moveTo', from], 'no such category');
        const now = nowTimestamp();
        for (const id of removed) sql.moveTransactions.run(change.moveTo[id] ?? null, now, id);
        db.exec('DELETE FROM categories; DELETE FROM category_groups;');
        insertTree(change);
        preferences.keepHiddenOnly(kept);
      });
    },
  };
}
