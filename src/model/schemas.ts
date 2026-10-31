// Request validation, shared by the server (which enforces it) and the browser.
// Imports carry .ts extensions because the server runs this file with Node directly.
import { z } from 'zod';
import { foldName } from './names.ts';
import { toTimestamp } from './time.ts';
import type { AccountId, CategoryGroupId, CategoryId, Preferences, Timestamp, TransactionId } from './types.ts';

export const MAX_IMPORT_ROWS = 1000;
/** ±1 000 000 000,00 */
export const MAX_AMOUNT = 100_000_000_000;

export const DEFAULT_PREFERENCES: Preferences = {
  overviewPeriod: 'last12',
  hiddenCategoryIds: [],
  transactionSort: 'addedAt',
};

const id = <T extends string>() => z.uuid().transform((s) => s as T);
export const transactionId = id<TransactionId>();
export const accountId = id<AccountId>();
export const categoryId = id<CategoryId>();
export const categoryGroupId = id<CategoryGroupId>();

/** A stored timestamp: UTC, whole seconds, "2026-10-20T11:30:00Z", and a real date. */
export const timestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'must be UTC, e.g. 2026-10-20T11:30:00Z')
  .refine((s) => !Number.isNaN(Date.parse(s)) && toTimestamp(s) === s, 'not a real date')
  .transform((s) => s as Timestamp);

/** The written date and time exist: Date.parse alone turns 30 February into 2 March. */
function realDateTime(s: string) {
  const [y, mo, d, h, mi, sec = 0] = (s.match(/\d+/g) ?? []).map(Number);
  const day = new Date(Date.UTC(y, mo - 1, d));
  return day.getUTCMonth() === mo - 1 && day.getUTCDate() === d && h < 24 && mi < 60 && sec < 60;
}

/** ISO 8601 date-time that states its zone (Z or ±hh:mm); converted to a stored UTC timestamp. */
const zonedDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/, 'must be ISO 8601 with a time zone')
  .refine((s) => realDateTime(s) && !Number.isNaN(Date.parse(s)), 'not a real date')
  .transform((s) => toTimestamp(s));

/** Integer hundredths: -1250 = −12,50. */
export const amount = z.int().min(-MAX_AMOUNT).max(MAX_AMOUNT);

const noControl = (s: string) => !/\p{Cc}/u.test(s);
const text = (max: number) =>
  z.string().trim().min(1, 'must not be empty').max(max).refine(noControl, 'must not contain control characters');
const name = text(100);
/** Optional text, line breaks and tabs allowed: blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => noControl(s.replace(/[\t\n\r]/g, '')), 'must not contain control characters')
    .transform((s) => s || null)
    .nullable();

const externalId = text(200);

const editableFields = {
  accountId: accountId.nullable(),
  occurredAt: timestamp.nullable(),
  counterparty: optionalText(200),
  amount: amount.nullable(),
  categoryId: categoryId.nullable(),
  description: optionalText(1000),
};

/** POST /transactions. A split passes its original's externalId and addedAt. */
export const createTransactionSchema = z.strictObject({
  externalId: externalId.nullable(),
  ...editableFields,
  addedAt: timestamp.optional(),
});

/** PATCH /transactions/:id. externalId and addedAt never change. */
export const patchTransactionSchema = z
  .strictObject(editableFields)
  .partial()
  .refine((p) => Object.keys(p).length > 0, 'nothing to change');

/** PUT /transactions/:id: a deleted row put back exactly as it was. */
export const transactionSchema = z.strictObject({
  id: transactionId,
  externalId: externalId.nullable(),
  ...editableFields,
  addedAt: timestamp,
  updatedAt: timestamp,
});

/** One row of POST /transactions/import. */
export const importTransactionSchema = z.strictObject({
  externalId,
  account: name,
  occurredAt: zonedDateTime,
  counterparty: text(200),
  amount,
  description: optionalText(1000).optional(),
});

export const importBatchSchema = z
  .array(importTransactionSchema)
  .min(1, 'send at least one transaction')
  .max(MAX_IMPORT_ROWS, `send at most ${MAX_IMPORT_ROWS} transactions per request`)
  .superRefine((rows, ctx) => {
    const first = new Map<string, number>();
    rows.forEach((r, i) => {
      const seen = first.get(r.externalId);
      if (seen === undefined) first.set(r.externalId, i);
      else ctx.addIssue({ code: 'custom', path: [i, 'externalId'], message: `repeats row ${seen}` });
    });
  });

export const accountNameSchema = z.strictObject({ name });

const order = z.int().min(0).max(10_000);

/** PUT /categories: the whole tree as edited in Settings. */
export const categoryChangeSchema = z
  .strictObject({
    groups: z
      .array(
        z.strictObject({
          id: categoryGroupId,
          name,
          kind: z.enum(['income', 'expense', 'transfer', 'opening']),
          order,
        }),
      )
      .max(500),
    categories: z.array(z.strictObject({ id: categoryId, groupId: categoryGroupId, name, order })).max(2000),
    /** Deleted category → the category that receives its transactions. */
    moveTo: z.record(z.uuid(), categoryId),
  })
  .superRefine((tree, ctx) => {
    const groupIds = new Set(tree.groups.map((g) => g.id as string));
    const categoryIds = new Set(tree.categories.map((c) => c.id as string));
    const names = new Map<string, string>();
    const unique = (n: string, path: (string | number)[]) => {
      const key = foldName(n);
      if (names.has(key)) ctx.addIssue({ code: 'custom', path, message: `“${n}” is used twice` });
      names.set(key, n);
    };
    if (groupIds.size !== tree.groups.length)
      ctx.addIssue({ code: 'custom', path: ['groups'], message: 'repeated id' });
    if (categoryIds.size !== tree.categories.length)
      ctx.addIssue({ code: 'custom', path: ['categories'], message: 'repeated id' });
    tree.groups.forEach((g, i) => {
      unique(g.name, ['groups', i, 'name']);
    });
    tree.categories.forEach((c, i) => {
      unique(c.name, ['categories', i, 'name']);
      if (!groupIds.has(c.groupId))
        ctx.addIssue({ code: 'custom', path: ['categories', i, 'groupId'], message: 'no such group' });
    });
    for (const [from, to] of Object.entries(tree.moveTo)) {
      if (categoryIds.has(from))
        ctx.addIssue({ code: 'custom', path: ['moveTo', from], message: 'category is not being deleted' });
      if (!categoryIds.has(to)) ctx.addIssue({ code: 'custom', path: ['moveTo', from], message: 'no such category' });
    }
  });

export const preferencesSchema = z.strictObject({
  overviewPeriod: z.enum(['last3', 'last12', 'all']),
  hiddenCategoryIds: z.array(categoryId).max(2000),
  transactionSort: z.enum(['addedAt', 'occurredAt']),
});

export const preferencesPatchSchema = preferencesSchema.partial();

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
export type ImportRow = z.output<typeof importTransactionSchema>;
export type CategoryChangeInput = z.output<typeof categoryChangeSchema>;

export interface Issue {
  path: (string | number)[];
  message: string;
}

export const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map((i) => ({ path: i.path.map((p) => (typeof p === 'symbol' ? String(p) : p)), message: i.message }));
