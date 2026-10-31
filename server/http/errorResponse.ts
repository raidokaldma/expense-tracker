import type { Context } from 'hono';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import { HttpError } from './request.ts';

const SQLITE_CONSTRAINT = 19;

function isConstraintError(err: Error) {
  return 'errcode' in err && typeof err.errcode === 'number' && (err.errcode & 0xff) === SQLITE_CONSTRAINT;
}

export function errorResponse(err: Error, c: Context) {
  if (err instanceof ValidationError) return c.json({ error: err.message, issues: err.issues }, 422);
  if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
  if (err instanceof ConflictError) return c.json({ error: err.message }, 409);
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  // a database constraint caught what validation missed: the request conflicts with stored data
  if (isConstraintError(err)) return c.json({ error: 'The change conflicts with stored data' }, 409);
  return c.json({ error: 'Something went wrong on the server' }, 500);
}
