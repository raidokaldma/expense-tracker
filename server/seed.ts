import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { newCategoryGroupId, newCategoryId } from '../shared/ids.ts';
import { foldName } from '../shared/names.ts';
import { categoryChangeSchema, importTransactionSchema, issuesOf } from '../shared/schemas.ts';
import {
  CATEGORY_KINDS,
  type Category,
  type CategoryGroup,
  type CategoryId,
  type CategoryTree,
} from '../shared/types.ts';

/** The example seed. Tests and the demo data use its categories. */
export const EXAMPLE_SEED = fileURLToPath(new URL('../seed.example.json', import.meta.url));

/** A transaction from the seed: an import row whose bank id is optional and whose category is already known. */
export interface SeedTransaction extends Omit<z.output<typeof importTransactionSchema>, 'externalId'> {
  externalId: string | null;
  categoryId: CategoryId | null;
}

export interface Seed {
  tree: CategoryTree;
  transactions: SeedTransaction[];
}

const seedSchema = z.strictObject({
  groups: z.array(
    z.strictObject({
      name: z.string(),
      kind: z.enum(CATEGORY_KINDS),
      categories: z.array(z.string()),
    }),
  ),
  // as for POST /api/transactions/import, plus a category name from the groups above
  transactions: z
    .array(
      z.strictObject({
        ...importTransactionSchema.shape,
        externalId: importTransactionSchema.shape.externalId.nullish(),
        category: z.string().nullish(),
      }),
    )
    .default([]),
});

/**
 * Reads a seed file (see seed.example.json): the category tree with new ids, checked like a save from Settings,
 * and transactions, checked like an import.
 */
export function readSeed(file: string): Seed {
  const fail = (why: string) => new Error(`Seed file ${file}: ${why}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw fail(err instanceof Error ? err.message : String(err));
  }
  const seed = seedSchema.safeParse(raw);
  if (!seed.success) throw fail(z.prettifyError(seed.error));

  const groups: CategoryGroup[] = [];
  const categories: Category[] = [];
  const orderInKind: Record<string, number> = {};
  for (const g of seed.data.groups) {
    const order = orderInKind[g.kind] ?? 0;
    orderInKind[g.kind] = order + 1;
    const group: CategoryGroup = { id: newCategoryGroupId(), name: g.name, kind: g.kind, order };
    groups.push(group);
    g.categories.forEach((name, i) => {
      categories.push({ id: newCategoryId(), groupId: group.id, name, order: i });
    });
  }
  const tree = categoryChangeSchema.safeParse({ groups, categories, moveTo: {} });
  if (!tree.success)
    throw fail(
      issuesOf(tree.error)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );

  const byName = new Map(tree.data.categories.map((c) => [foldName(c.name), c.id]));
  // split rows share their original's externalId, as after an import
  const transactions = seed.data.transactions.map(({ category, externalId, ...row }, i) => {
    const categoryId = category ? byName.get(foldName(category)) : null;
    if (categoryId === undefined) throw fail(`transactions.${i}.category: no category “${category}”`);
    return { ...row, externalId: externalId ?? null, categoryId };
  });
  return { tree: { groups: tree.data.groups, categories: tree.data.categories }, transactions };
}
