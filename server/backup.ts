/**
 * Database backups. SQLite's `VACUUM INTO` writes a consistent copy even
 * while the app is running. One file per day; older ones are removed.
 *
 * Backups contain children's data: keep them on encrypted storage that only
 * the people running Schoolzone can reach, and copy them off the server.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from './db';

const PREFIX = 'schoolzone-';

export function backupDb(db: DB, dir: string, now: Date, keep: number): string {
  mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().slice(0, 10);
  const file = join(dir, `${PREFIX}${stamp}.db`);
  rmSync(file, { force: true }); // VACUUM INTO won't overwrite; re-running on the same day replaces it
  db.prepare('VACUUM INTO ?').run(file);
  const old = readdirSync(dir).filter((f) => f.startsWith(PREFIX) && f.endsWith('.db')).sort().reverse().slice(keep);
  for (const f of old) rmSync(join(dir, f), { force: true });
  return file;
}
