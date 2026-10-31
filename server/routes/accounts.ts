import { Hono } from 'hono';
import { accountId, accountNameSchema } from '../../shared/schemas.ts';
import { parseBody, parseId } from '../http/request.ts';
import type { Accounts } from '../service/accounts.ts';

export function accountRoutes(accounts: Accounts) {
  return new Hono()
    .get('/', (c) => c.json(accounts.list()))
    .post('/', async (c) => c.json(accounts.create((await parseBody(c, accountNameSchema)).name), 201))
    .patch('/:id', async (c) =>
      c.json(accounts.rename(parseId(c, accountId), (await parseBody(c, accountNameSchema)).name)),
    )
    .delete('/:id', (c) => {
      accounts.remove(parseId(c, accountId));
      return c.body(null, 204);
    });
}
