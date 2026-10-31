import { Hono } from 'hono';
import { categoryChangeSchema, preferencesPatchSchema } from '../../shared/schemas.ts';
import { parseBody } from '../http/request.ts';
import type { Categories } from '../service/categories.ts';
import type { PreferencesStore } from '../service/preferences.ts';

export function categoryRoutes(categories: Categories) {
  return new Hono()
    .get('/', (c) => c.json(categories.tree()))
    .put('/', async (c) => {
      categories.save(await parseBody(c, categoryChangeSchema));
      return c.body(null, 204);
    });
}

export function preferenceRoutes(preferences: PreferencesStore) {
  return new Hono()
    .get('/', (c) => c.json(preferences.get()))
    .patch('/', async (c) => {
      preferences.set(await parseBody(c, preferencesPatchSchema));
      return c.body(null, 204);
    });
}
