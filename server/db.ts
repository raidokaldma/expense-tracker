import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

/** Runs `fn` in one transaction: everything it writes lands, or nothing does. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** A consistent copy of the database, safe while the app is running. Returns the file written. */
export function backup(db: Db, file: string): string {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) throw new Error(`${file} already exists`);
  db.prepare('VACUUM INTO ?').run(file);
  return file;
}

export const backupStamp = (date = new Date()) => date.toISOString().slice(0, 19).replace(/:/g, '');

/** The schema version; 0 for a database that was just created. */
export const schemaVersion = (db: Db) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

/**
 * Brings the schema up to date from numbered files (001_init.sql, 002_….sql), each applied once and in order.
 * The version lives in PRAGMA user_version. An existing database is backed up first (once per upgrade, even if the
 * upgrade fails and is retried on every restart); a newer one is refused.
 */
export function migrate(db: Db, options: { dir?: string; backupDir?: string } = {}) {
  const dir = options.dir ?? MIGRATIONS_DIR;
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  files.forEach((f, i) => {
    if (Number(f.slice(0, 3)) !== i + 1) throw new Error(`Migrations must be numbered 001, 002, …; found ${f}`);
  });

  const current = schemaVersion(db);
  if (current > files.length)
    throw new Error(`The database is at version ${current}, this app knows up to ${files.length}: use a newer app`);
  if (current === files.length) return;
  const { backupDir } = options;
  const prefix = `expenses-v${current}-before-v${files.length}-`;
  if (current > 0 && backupDir && !(existsSync(backupDir) && readdirSync(backupDir).some((f) => f.startsWith(prefix))))
    backup(db, join(backupDir, `${prefix}${backupStamp()}.db`));

  for (let n = current + 1; n <= files.length; n++) {
    const sql = readFileSync(join(dir, files[n - 1]), 'utf8');
    // off for the migration so a table can be rebuilt; the check below catches anything left dangling
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      transaction(db, () => {
        db.exec(sql);
        const broken = db.prepare('PRAGMA foreign_key_check').all();
        if (broken.length) throw new Error(`${files[n - 1]} leaves ${broken.length} broken references`);
        db.exec(`PRAGMA user_version = ${n}`);
      });
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
  const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  if (check.integrity_check !== 'ok') throw new Error(`Integrity check failed: ${check.integrity_check}`);
}
