import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import { issuesOf } from '../../shared/schemas.ts';
import { NotFoundError, ValidationError } from '../errors.ts';

/** A failure of the request itself, before it reaches the service. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  constructor(status: ContentfulStatusCode, message: string) {
    super(message);
    this.status = status;
  }
}

export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'The body is not valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(issuesOf(result.error));
  return result.data;
}

/** The `:id` in the path; one that cannot be an id finds nothing. */
export function parseId<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const result = schema.safeParse(c.req.param('id'));
  if (!result.success) throw new NotFoundError('Not found');
  return result.data;
}
