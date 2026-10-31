import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import { NotFoundError } from './errors.ts';
import { errorResponse } from './http/errorResponse.ts';
import { HttpError } from './http/request.ts';
import { accountRoutes } from './routes/accounts.ts';
import { categoryRoutes, preferenceRoutes } from './routes/settings.ts';
import { transactionRoutes } from './routes/transactions.ts';
import type { Service } from './service.ts';

interface AppOptions {
  service: Service;
  /** Built frontend to serve, e.g. "dist". */
  staticDir?: string;
  /** Enables POST /api/test/reset, for end-to-end tests. */
  testReset?: boolean;
  /** Logs every request (except the health check) with its status and time. */
  log?: boolean;
}

/** 1000 import rows with every field at its longest fit. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export function createApp({ service, staticDir, testReset, log }: AppOptions) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  if (log) app.use('*', logger());

  app.use(
    '/api/*',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'The body is too large' }, 413) }),
  );

  // writes must be JSON: other sites cannot send that without the browser asking this server first
  app.use('/api/*', async (c, next) => {
    const isWrite = ['POST', 'PUT', 'PATCH'].includes(c.req.method);
    if (isWrite && !c.req.header('content-type')?.startsWith('application/json'))
      throw new HttpError(415, 'Send the body as application/json');
    await next();
  });

  app.route('/api/transactions', transactionRoutes(service.transactions));
  app.route('/api/accounts', accountRoutes(service.accounts));
  app.route('/api/categories', categoryRoutes(service.categories));
  app.route('/api/preferences', preferenceRoutes(service.preferences));

  if (testReset)
    app.post('/api/test/reset', async (c) => {
      const { demo } = (await c.req.json().catch(() => ({}))) as { demo?: boolean };
      service.reset(!!demo);
      return c.body(null, 204);
    });

  app.all('/api/*', () => {
    throw new NotFoundError('Not found');
  });

  if (staticDir) app.use('/*', serveStatic({ root: staticDir }));

  app.onError(errorResponse);

  return app;
}
