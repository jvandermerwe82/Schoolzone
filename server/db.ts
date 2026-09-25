/**
 * SQLite storage, using Node's built-in `node:sqlite` (no native build step).
 *
 * Data minimisation (ICO Children's Code): children are identified by a random
 * id; their first name lives only inside the profile the parent created. Answer
 * events never contain names, and are only kept if the parent opted in to
 * research use. Parents can delete a child or their whole account at any time.
 */
import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  data_processing INTEGER NOT NULL,
  ai_tutor INTEGER NOT NULL,
  research INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  correct INTEGER NOT NULL,
  hinted INTEGER NOT NULL,
  rapid INTEGER NOT NULL,
  time_ms INTEGER NOT NULL,
  predicted REAL NOT NULL,
  misconception TEXT,
  strategy TEXT,
  event_version INTEGER NOT NULL DEFAULT 1,
  session_id TEXT,
  session_position INTEGER,
  plan_reason TEXT,
  help_event TEXT,
  diagnostic INTEGER,
  due_review INTEGER,
  curriculum_id TEXT,
  canonical_node_id TEXT,
  evidence_strength TEXT,
  teacher_target_node_id TEXT,
  teacher_route_reason TEXT,
  p_known_before REAL,
  p_known_after REAL,
  ability_before REAL,
  ability_after REAL,
  mastered_after INTEGER
);
CREATE INDEX IF NOT EXISTS events_child ON events(child_id);
CREATE TABLE IF NOT EXISTS items (
  key TEXT PRIMARY KEY,
  offset REAL NOT NULL,
  n INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  flagged TEXT
);
CREATE INDEX IF NOT EXISTS tutor_child ON tutor_messages(child_id, at);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  child_id TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code_name TEXT NOT NULL,
  on_board INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  UNIQUE (school_id, code_name)
);
CREATE TABLE IF NOT EXISTS points (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (child_id, day)
);
CREATE TABLE IF NOT EXISTS flag_notices (
  child_id TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  last_sent_at INTEGER NOT NULL
);
`;

/** Columns added after the first version; added to existing databases on start-up. */
const ADDED_COLUMNS: [table: string, column: string, definition: string][] = [
  ['parents', 'email_verified_at', 'INTEGER'],
  // Parent's choice to share a child's progress (with their name) with the school's teacher.
  ['memberships', 'share_progress', 'INTEGER NOT NULL DEFAULT 0'],
  // Homework topic set by the teacher: {"skillId", "note", "setAt"}.
  ['schools', 'focus_json', 'TEXT'],
  ['events', 'event_version', 'INTEGER NOT NULL DEFAULT 1'],
  ['events', 'session_id', 'TEXT'],
  ['events', 'session_position', 'INTEGER'],
  ['events', 'plan_reason', 'TEXT'],
  ['events', 'help_event', 'TEXT'],
  ['events', 'diagnostic', 'INTEGER'],
  ['events', 'due_review', 'INTEGER'],
  ['events', 'curriculum_id', 'TEXT'],
  ['events', 'canonical_node_id', 'TEXT'],
  ['events', 'evidence_strength', 'TEXT'],
  ['events', 'teacher_target_node_id', 'TEXT'],
  ['events', 'teacher_route_reason', 'TEXT'],
  ['events', 'p_known_before', 'REAL'],
  ['events', 'p_known_after', 'REAL'],
  ['events', 'ability_before', 'REAL'],
  ['events', 'ability_after', 'REAL'],
  ['events', 'mastered_after', 'INTEGER'],
];

export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS events_session ON events(child_id, session_id, at);');
  db.exec('CREATE INDEX IF NOT EXISTS events_canonical ON events(canonical_node_id, at);');
  return db;
}

/** Remove expired sessions and answer events older than the retention period. */
export function pruneOldData(db: DB, now: number, retentionDays: number): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM events WHERE at < ?').run(now - retentionDays * 86_400_000);
  db.prepare('DELETE FROM tutor_messages WHERE at < ?').run(now - retentionDays * 86_400_000);
  // Weekly leaderboard points are only needed for the current week.
  db.prepare('DELETE FROM points WHERE day < ?').run(new Date(now - 14 * 86_400_000).toISOString().slice(0, 10));
}
