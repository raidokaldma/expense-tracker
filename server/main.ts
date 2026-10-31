import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { type Db, migrate, openDatabase, schemaVersion } from './db.ts';
import { readSeed, type Seed } from './seed.ts';
import { createService } from './service.ts';

/** The seed for a database without a schema yet; read before migrating, which gives it one. */
function seedForNewDatabase(db: Db, seedFile: string | null): Seed | null {
  if (schemaVersion(db) !== 0 || !seedFile) return null;
  if (existsSync(seedFile)) return readSeed(seedFile);
  console.log(`No seed file at ${seedFile}: starting empty`);
  return null;
}

const config = readConfig();
const db = openDatabase(config.dbPath);
const seed = seedForNewDatabase(db, config.seedFile);
migrate(db, { backupDir: config.dbPath === ':memory:' ? undefined : config.backupDir });
const service = createService(db);
if (seed) {
  service.seed(seed);
  const { tree, transactions } = seed;
  console.log(
    `New database: ${tree.categories.length} categories, ${transactions.length} transactions from ${config.seedFile}`,
  );
}

if (!existsSync(join(config.staticDir, 'index.html')))
  console.warn(`No frontend in ${config.staticDir}/: run npm run build, or use npm run dev`);
const app = createApp({
  service,
  staticDir: config.staticDir,
  testReset: config.testReset,
  log: true,
});
const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, ({ address, port }) =>
  console.log(`Expense tracker on http://${address}:${port} (database ${config.dbPath})`),
);

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
