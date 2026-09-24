/** `npm run backup`: make a backup straight away (uses DATABASE_PATH and BACKUP_DIR). */
import { backupDb } from './backup';
import { openDb } from './db';

const db = openDb(process.env.DATABASE_PATH ?? 'schoolzone.db');
const file = backupDb(db, process.env.BACKUP_DIR ?? 'backups', new Date(), Number(process.env.BACKUP_KEEP ?? 14));
db.close();
console.log(`Backup written to ${file}`);
