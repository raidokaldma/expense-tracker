import { DEFAULT_PREFERENCES, preferencesSchema } from '../../shared/schemas.ts';
import type { CategoryId, Preferences } from '../../shared/types.ts';
import { type Db, inTransaction } from '../db.ts';
import { invalid } from '../errors.ts';

export type PreferencesStore = ReturnType<typeof createPreferences>;

export function createPreferences(db: Db) {
  const sql = {
    get: db.prepare('SELECT value FROM preferences WHERE id = 1'),
    put: db.prepare('INSERT OR REPLACE INTO preferences (id, value) VALUES (1, ?)'),
    categoryExists: db.prepare('SELECT 1 FROM categories WHERE id = ?'),
  };

  /** Stored settings, each one falling back to its default on its own if it no longer fits. */
  function get(): Preferences {
    const row = sql.get.get() as { value: string } | undefined;
    const stored = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    const prefs: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
    for (const [key, schema] of Object.entries(preferencesSchema.shape)) {
      const parsed = schema.safeParse(stored[key]);
      if (parsed.success) prefs[key] = parsed.data;
    }
    return prefs as unknown as Preferences;
  }

  const put = (prefs: Preferences) => sql.put.run(JSON.stringify(prefs));

  return {
    get,

    set(patch: Partial<Preferences>) {
      inTransaction(db, () => {
        patch.hiddenCategoryIds?.forEach((id, i) => {
          if (!sql.categoryExists.get(id)) throw invalid(['hiddenCategoryIds', i], 'no such category');
        });
        put({ ...get(), ...patch });
      });
    },

    /** Deleted categories no longer count as hidden. Runs inside the caller's transaction. */
    keepHiddenOnly(kept: ReadonlySet<CategoryId>) {
      const prefs = get();
      const hidden = prefs.hiddenCategoryIds.filter((id) => kept.has(id));
      if (hidden.length !== prefs.hiddenCategoryIds.length) put({ ...prefs, hiddenCategoryIds: hidden });
    },
  };
}
