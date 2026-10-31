// npm run seed:demo: fills an empty database with 8,725 demo transactions. Refuses to touch real data.
import { readConfig } from './config.ts';
import { migrate, openDatabase } from './db.ts';
import { createService } from './service.ts';

const config = readConfig();
const db = openDatabase(config.dbPath);
migrate(db, { backupDir: config.backupDir });
const service = createService(db);
if (!service.isEmpty()) {
  console.error(`${config.dbPath} already has accounts or transactions; demo data goes into an empty database only`);
  process.exit(1);
}
service.reset(true);
console.log(`Loaded demo data into ${config.dbPath}`);
db.close();
