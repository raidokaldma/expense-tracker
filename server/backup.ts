// npm run backup [-- --keep 30]: writes a consistent copy of the database to backups/, keeping the newest N.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readConfig } from './config.ts';
import { backup, backupStamp, openDatabase } from './db.ts';

function run() {
  const config = readConfig();
  const { values } = parseArgs({ options: { keep: { type: 'string' } } });
  const keep = values.keep === undefined ? null : Number(values.keep);
  if (keep !== null && !(Number.isInteger(keep) && keep > 0)) throw new Error('--keep needs a positive number');
  if (!existsSync(config.dbPath)) throw new Error(`No database at ${config.dbPath}`);

  const db = openDatabase(config.dbPath);
  try {
    console.log(`Wrote ${backup(db, join(config.backupDir, `expenses-${backupStamp()}.db`))}`);
  } finally {
    db.close();
  }

  if (keep) {
    // names sort by time; copies made before upgrades are kept
    const old = readdirSync(config.backupDir)
      .filter((f) => /^expenses-\d{4}-\d{2}-\d{2}T\d{6}\.db$/.test(f))
      .sort()
      .slice(0, -keep);
    for (const f of old) {
      rmSync(join(config.backupDir, f));
      console.log(`Removed ${f}`);
    }
  }
}

try {
  run();
} catch (err) {
  console.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
