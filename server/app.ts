import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import type { z } from 'zod';
import {
  accountId,
  accountNameSchema,
  categoryChangeSchema,
  createTransactionSchema,
  importBatchSchema,
  issuesOf,
  patchTransactionSchema,
  preferencesPatchSchema,
  transactionId,
  transactionSchema,
} from '../src/model/schemas.ts';
import { HttpError, type Service } from './service.ts';

export interface AppOptions {
  service: Service;
  /** Built frontend to serve, e.g. "dist". */
  staticDir?: string;
  /** Enables POST /api/test/reset, for end-to-end tests. */
  testReset?: boolean;
  /** Logs every request (except the health check) with its status and time. */
  log?: boolean;
}

const SQLITE_CONSTRAINT = 19;

async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'The body is not valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(422, 'Invalid request', issuesOf(result.error));
  return result.data;
}

function parseId<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const result = schema.safeParse(c.req.param('id'));
  if (!result.success) throw new HttpError(404, 'Not found');
  return result.data;
}

export function createApp({ service, staticDir, testReset, log }: AppOptions) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  if (log) app.use('*', logger());

  app.use(
    '/api/*',
    bodyLimit({
      // 1000 rows with every field at its longest fit
      maxSize: 4 * 1024 * 1024,
      onError: (c) => c.json({ error: 'The body is too large' }, 413),
    }),
  );

  // writes must be JSON: other sites cannot send that without the browser asking this server first
  app.use('/api/*', async (c, next) => {
    if (
      ['POST', 'PUT', 'PATCH'].includes(c.req.method) &&
      !c.req.header('content-type')?.startsWith('application/json')
    )
      throw new HttpError(415, 'Send the body as application/json');
    await next();
  });

  app.get('/api/transactions', (c) => c.json(service.listTransactions()));
  app.post('/api/transactions', async (c) =>
    c.json(service.createTransaction(await parseBody(c, createTransactionSchema)), 201),
  );
  app.post('/api/transactions/import', async (c) =>
    c.json(service.importTransactions(await parseBody(c, importBatchSchema))),
  );
  app.patch('/api/transactions/:id', async (c) =>
    c.json(service.updateTransaction(parseId(c, transactionId), await parseBody(c, patchTransactionSchema))),
  );
  app.put('/api/transactions/:id', async (c) => {
    const id = parseId(c, transactionId);
    const row = await parseBody(c, transactionSchema);
    if (row.id !== id) throw new HttpError(422, 'Invalid request', [{ path: ['id'], message: 'must match the URL' }]);
    return c.json(service.restoreTransaction(row));
  });
  app.delete('/api/transactions/:id', (c) => {
    service.removeTransaction(parseId(c, transactionId));
    return c.body(null, 204);
  });

  app.get('/api/accounts', (c) => c.json(service.listAccounts()));
  app.post('/api/accounts', async (c) =>
    c.json(service.createAccount((await parseBody(c, accountNameSchema)).name), 201),
  );
  app.patch('/api/accounts/:id', async (c) =>
    c.json(service.renameAccount(parseId(c, accountId), (await parseBody(c, accountNameSchema)).name)),
  );
  app.delete('/api/accounts/:id', (c) => {
    service.removeAccount(parseId(c, accountId));
    return c.body(null, 204);
  });

  app.get('/api/categories', (c) => c.json(service.categoryTree()));
  app.put('/api/categories', async (c) => {
    service.saveCategories(await parseBody(c, categoryChangeSchema));
    return c.body(null, 204);
  });

  app.get('/api/preferences', (c) => c.json(service.getPreferences()));
  app.patch('/api/preferences', async (c) => {
    service.setPreferences(await parseBody(c, preferencesPatchSchema));
    return c.body(null, 204);
  });

  if (testReset)
    app.post('/api/test/reset', async (c) => {
      const { demo } = (await c.req.json().catch(() => ({}))) as { demo?: boolean };
      service.reset(!!demo);
      return c.body(null, 204);
    });

  app.all('/api/*', () => {
    throw new HttpError(404, 'Not found');
  });

  if (staticDir) app.use('/*', serveStatic({ root: staticDir }));

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      const body = err.issues.length ? { error: err.message, issues: err.issues } : { error: err.message };
      return c.json(body, err.status as 400);
    }
    // a database constraint caught what validation missed: the request conflicts with stored data
    if ('errcode' in err && typeof err.errcode === 'number' && (err.errcode & 0xff) === SQLITE_CONSTRAINT) {
      console.error(err);
      return c.json({ error: 'The change conflicts with stored data' }, 409);
    }
    console.error(err);
    return c.json({ error: 'Something went wrong on the server' }, 500);
  });

  return app;
}
