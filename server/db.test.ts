import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, migrate, openDatabase } from './db.ts';

const tempDir = () => mkdtempSync(join(tmpdir(), 'expenses-'));

/** A copy of the real migrations plus extra ones, in a temporary directory. */
function migrationsWith(extra: Record<string, string>) {
  const dir = tempDir();
  for (const f of readdirSync(MIGRATIONS_DIR)) writeFileSync(join(dir, f), readFileSync(join(MIGRATIONS_DIR, f)));
  for (const [f, sql] of Object.entries(extra)) writeFileSync(join(dir, f), sql);
  return dir;
}

/** The real migrations' count; extra ones are numbered from the next. */
const latest = readdirSync(MIGRATIONS_DIR).length;
const next = String(latest + 1).padStart(3, '0');

const version = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

describe('migrations', () => {
  it('builds a new database and does nothing the second time', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    expect(version(db)).toBe(latest);
    migrate(db);
    expect(version(db)).toBe(latest);
  });

  it('backs up an existing database before changing it', () => {
    const data = tempDir();
    const db = openDatabase(join(data, 'expenses.db'));
    migrate(db);
    migrate(db, {
      dir: migrationsWith({ [`${next}_note.sql`]: 'ALTER TABLE transactions ADD COLUMN note TEXT;' }),
      backupDir: join(data, 'backups'),
    });
    expect(version(db)).toBe(latest + 1);
    expect(readdirSync(join(data, 'backups'))).toEqual([
      expect.stringMatching(new RegExp(`^expenses-v${latest}-before-v${latest + 1}-.+\\.db$`)),
    ]);
  });

  it('backs up once when a failing upgrade is retried on every restart', () => {
    const data = tempDir();
    const db = openDatabase(join(data, 'expenses.db'));
    migrate(db);
    const options = {
      dir: migrationsWith({ [`${next}_bad.sql`]: 'SELECT * FROM missing;' }),
      backupDir: join(data, 'backups'),
    };
    expect(() => migrate(db, options)).toThrow();
    expect(() => migrate(db, options)).toThrow();
    expect(readdirSync(join(data, 'backups'))).toHaveLength(1);
  });

  it('rolls a failed migration back completely', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const dir = migrationsWith({ [`${next}_bad.sql`]: 'CREATE TABLE extra (a INTEGER); SELECT * FROM missing;' });
    expect(() => migrate(db, { dir })).toThrow();
    expect(version(db)).toBe(latest);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'extra'").get()).toBeUndefined();
  });

  it('refuses a database made by a newer app', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    db.exec('PRAGMA user_version = 99');
    expect(() => migrate(db)).toThrow(/use a newer app/);
  });

  it('keeps bad rows out even if a bug got past the API', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const insert = (amount: unknown, occurredAt: string) => () =>
      db
        .prepare(
          `INSERT INTO transactions (id, amount, occurred_at, added_at, updated_at)
           VALUES ('${crypto.randomUUID()}', ?, ?, '2026-10-20T11:30:00Z', '2026-10-20T11:30:00Z')`,
        )
        .run(amount as number, occurredAt);
    expect(insert(-1250, '2026-10-20T11:30:00Z')).not.toThrow();
    expect(insert(-12.5, '2026-10-20T11:30:00Z')).toThrow();
    expect(insert('12 apples', '2026-10-20T11:30:00Z')).toThrow();
    expect(insert(-1250, '2026-10-20T14:30:00+03:00')).toThrow();
    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (id, account_id, added_at, updated_at)
           VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', '2026-10-20T11:30:00Z', '2026-10-20T11:30:00Z')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
