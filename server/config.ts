import { dirname, join } from 'node:path';

/** Settings from the environment (see .env.example). */
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const dbPath = env.DB_PATH || './data/expenses.db';
  return {
    production,
    dbPath,
    backupDir: env.BACKUP_DIR || join(dirname(dbPath), 'backups'),
    /** Categories for a new database (see seed.example.json); ignored once the database exists. */
    seedFile: env.SEED_FILE || null,
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT) || 8080,
    /** The built frontend (npm run build) */
    staticDir: env.STATIC_DIR || 'dist',
    testReset: !production && env.TEST_RESET === '1',
  };
}
