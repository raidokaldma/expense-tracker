import { Hono } from 'hono';
import {
  createTransactionSchema,
  importBatchSchema,
  patchTransactionSchema,
  transactionId,
  transactionSchema,
} from '../../shared/schemas.ts';
import { invalid } from '../errors.ts';
import { parseBody, parseId } from '../http/request.ts';
import type { Transactions } from '../service/transactions.ts';

export function transactionRoutes(transactions: Transactions) {
  return new Hono()
    .get('/', (c) => c.json(transactions.list()))
    .post('/', async (c) => c.json(transactions.create(await parseBody(c, createTransactionSchema)), 201))
    .post('/import', async (c) => c.json(transactions.import(await parseBody(c, importBatchSchema))))
    .patch('/:id', async (c) =>
      c.json(transactions.update(parseId(c, transactionId), await parseBody(c, patchTransactionSchema))),
    )
    .put('/:id', async (c) => {
      const id = parseId(c, transactionId);
      const row = await parseBody(c, transactionSchema);
      if (row.id !== id) throw invalid(['id'], 'must match the URL');
      return c.json(transactions.restore(row));
    })
    .delete('/:id', (c) => {
      transactions.remove(parseId(c, transactionId));
      return c.body(null, 204);
    });
}
