/**
 * Schools and leaderboards.
 *
 * - A teacher registers a school; it only goes live after an admin checks
 *   the teacher really works there. The school then gets a join code.
 * - A parent enters the code to join their child. The child's points count
 *   towards the school's score (an average, no names).
 * - Children only appear on their school's pupil leaderboard if a parent
 *   switches it on, and then under a generated code name, never their real
 *   name (ICO Children's Code: high privacy by default).
 * - "This week" ranks effort points, counted by the server and capped per
 *   day so long sessions don't win. "All time" ranks XP.
 */
import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DB } from './db';
import { emails } from './mailer';
import { newId, RateLimiter } from './security';

/** Points for one answer: effort counts, rushed guesses don't. */
export function pointsFor(e: { correct: boolean; hinted: boolean; rapid: boolean }): number {
  if (e.rapid) return 0;
  if (e.correct) return e.hinted ? 5 : 10;
  return 2;
}
export const DAILY_POINTS_CAP = 300;
/** Schools with fewer pupils aren't shown on the school board, so one child's score can't be picked out. */
export const MIN_SCHOOL_PUPILS = 5;
const BOARD_SIZE = 10;
const MAX_SCHOOLS_PER_TEACHER = 3;

const londonDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The date in the UK (YYYY-MM-DD), so days and weeks roll over at UK midnight. */
export const londonDay = (t: number) => londonDate.format(t);
/** The Monday of the week containing `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Standard competition ranking: equal scores share a rank (1, 1, 3). */
export function rank<T extends { score: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  let prev = 0;
  return sorted.map((r, i) => {
    prev = i > 0 && sorted[i - 1].score === r.score ? prev : i + 1;
    return { ...r, rank: prev };
  });
}

const ADJECTIVES = ['Swift', 'Brave', 'Clever', 'Cosmic', 'Mighty', 'Nimble', 'Bright', 'Bold', 'Lucky', 'Rapid', 'Silent', 'Sonic',
  'Turbo', 'Epic', 'Stellar', 'Quantum', 'Electric', 'Golden', 'Frosty', 'Blazing', 'Hyper', 'Pixel', 'Neon', 'Radiant', 'Super',
  'Daring', 'Steady', 'Wise', 'Jolly', 'Fierce'];
const ANIMALS = ['Falcon', 'Panther', 'Otter', 'Dolphin', 'Tiger', 'Fox', 'Wolf', 'Eagle', 'Lynx', 'Hawk', 'Orca', 'Gecko', 'Raven',
  'Badger', 'Cheetah', 'Jaguar', 'Koala', 'Panda', 'Puffin', 'Stingray', 'Mustang', 'Phoenix', 'Dragon', 'Comet', 'Rocket',
  'Owl', 'Hedgehog', 'Kestrel', 'Bison', 'Meerkat'];
const pick = <T>(xs: T[]) => xs[randomInt(xs.length)];
export const randomCodeName = () => `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;

/** 8 characters without look-alikes (no I, O, 0 or 1), shown as XXXX-XXXX. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newJoinCode = () => Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

interface Ctx {
  db: DB;
  now: () => number;
  requireParent: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  requireChild: (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<unknown>;
  isVerified: (parentId: string) => boolean;
  sendMail: (to: string, mail: { subject: string; text: string }) => Promise<unknown>;
  adminToken?: string;
  adminEmail?: string;
  appUrl: string;
}

/** Add effort points for a batch of answers, if the child is in a school. */
export function awardPoints(db: DB, childId: string, answers: { correct: boolean; hinted: boolean; rapid: boolean }[], now: number): void {
  if (!db.prepare('SELECT 1 FROM memberships WHERE child_id = ?').get(childId)) return;
  const day = londonDay(now);
  const cur = (db.prepare('SELECT points FROM points WHERE child_id = ? AND day = ?').get(childId, day) as { points: number } | undefined)?.points ?? 0;
  const add = answers.reduce((s, a) => s + pointsFor(a), 0);
  const next = Math.min(DAILY_POINTS_CAP, cur + add);
  if (next === cur) return;
  db.prepare('INSERT INTO points (child_id, day, points) VALUES (?, ?, ?) ON CONFLICT(child_id, day) DO UPDATE SET points = excluded.points')
    .run(childId, day, next);
}

type Period = 'week' | 'all';

/** Each member's score for the period. All-time uses the XP saved in the child's profile. */
function memberScores(db: DB, schoolId: string, period: Period, since: string) {
  const score = period === 'week'
    ? 'COALESCE((SELECT SUM(p.points) FROM points p WHERE p.child_id = m.child_id AND p.day >= ?), 0)'
    : "MAX(0, CAST(COALESCE(json_extract(c.profile_json, '$.xp'), 0) AS INTEGER))";
  const sql = `SELECT m.child_id AS childId, m.code_name AS codeName, m.on_board AS onBoard,
      json_extract(c.profile_json, '$.avatar') AS avatar, ${score} AS score
    FROM memberships m JOIN children c ON c.id = m.child_id WHERE m.school_id = ?`;
  const rows = (period === 'week' ? db.prepare(sql).all(since, schoolId) : db.prepare(sql).all(schoolId)) as
    { childId: string; codeName: string; onBoard: number; avatar: string | null; score: number }[];
  return rows;
}

export function schoolBoard(db: DB, period: Period, since: string) {
  const schools = db.prepare("SELECT id, name FROM schools WHERE status = 'approved'").all() as { id: string; name: string }[];
  const rows = schools.map((s) => {
    const members = memberScores(db, s.id, period, since);
    const total = members.reduce((sum, m) => sum + m.score, 0);
    return { id: s.id, name: s.name, pupils: members.length, score: members.length ? Math.round(total / members.length) : 0 };
  }).filter((s) => s.pupils >= MIN_SCHOOL_PUPILS);
  return rank(rows);
}

export function registerSchoolRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { db, now } = ctx;
  const joinLimiter = new RateLimiter(10, 15 * 60_000);
  const isAdmin = (req: FastifyRequest) => !!ctx.adminToken && req.headers['x-admin-token'] === ctx.adminToken;

  const membership = (childId: string) => db.prepare(
    `SELECT m.school_id AS schoolId, s.name AS schoolName, m.code_name AS codeName, m.on_board AS onBoard
     FROM memberships m JOIN schools s ON s.id = m.school_id WHERE m.child_id = ?`,
  ).get(childId) as { schoolId: string; schoolName: string; codeName: string; onBoard: number } | undefined;

  /** A code name no one else in the school has. */
  const uniqueCodeName = (schoolId: string) => {
    const taken = db.prepare('SELECT 1 FROM memberships WHERE school_id = ? AND code_name = ?');
    for (let i = 0; i < 30; i++) {
      const name = randomCodeName();
      if (!taken.get(schoolId, name)) return name;
    }
    for (;;) {
      const name = `${randomCodeName()} ${randomInt(10, 100)}`;
      if (!taken.get(schoolId, name)) return name;
    }
  };

  // ---------- parents: joining a school ----------
  app.get<{ Params: { id: string } }>('/api/children/:id/school', { preHandler: ctx.requireChild }, async (req) => {
    const m = membership(req.params.id);
    return m ? { school: { name: m.schoolName }, codeName: m.codeName, onBoard: !!m.onBoard } : { school: null };
  });

  app.post<{ Params: { id: string }; Body: { code: string } }>('/api/children/:id/school', {
    preHandler: ctx.requireChild,
    schema: { body: { type: 'object', required: ['code'], additionalProperties: false, properties: { code: { type: 'string', maxLength: 20 } } } },
  }, async (req, reply) => {
    if (!joinLimiter.take(req.parent!.id, now())) return reply.code(429).send({ error: 'Too many tries. Try again in 15 minutes.' });
    const school = db.prepare("SELECT id, name FROM schools WHERE join_code = ? AND status = 'approved'")
      .get(normaliseCode(req.body.code)) as { id: string; name: string } | undefined;
    if (!school) return reply.code(404).send({ error: 'That code isn\'t right. Please check it with the school.' });
    const existing = membership(req.params.id);
    if (existing?.schoolId === school.id) return { school: { name: school.name }, codeName: existing.codeName, onBoard: !!existing.onBoard };
    // Moving school starts fresh: no points carried over.
    db.prepare('DELETE FROM memberships WHERE child_id = ?').run(req.params.id);
    db.prepare('DELETE FROM points WHERE child_id = ?').run(req.params.id);
    const codeName = uniqueCodeName(school.id);
    db.prepare('INSERT INTO memberships (child_id, school_id, code_name, on_board, joined_at) VALUES (?, ?, ?, 0, ?)')
      .run(req.params.id, school.id, codeName, now());
    return reply.code(201).send({ school: { name: school.name }, codeName, onBoard: false });
  });

  app.patch<{ Params: { id: string }; Body: { onBoard?: boolean; newCodeName?: boolean } }>('/api/children/:id/school', {
    preHandler: ctx.requireChild,
    schema: { body: { type: 'object', additionalProperties: false, properties: { onBoard: { type: 'boolean' }, newCodeName: { type: 'boolean' } } } },
  }, async (req, reply) => {
    const m = membership(req.params.id);
    if (!m) return reply.code(404).send({ error: 'Not in a school.' });
    const codeName = req.body.newCodeName ? uniqueCodeName(m.schoolId) : m.codeName;
    const onBoard = req.body.onBoard ?? !!m.onBoard;
    db.prepare('UPDATE memberships SET code_name = ?, on_board = ? WHERE child_id = ?').run(codeName, onBoard ? 1 : 0, req.params.id);
    return { school: { name: m.schoolName }, codeName, onBoard };
  });

  app.delete<{ Params: { id: string } }>('/api/children/:id/school', { preHandler: ctx.requireChild }, async (req) => {
    db.prepare('DELETE FROM memberships WHERE child_id = ?').run(req.params.id);
    db.prepare('DELETE FROM points WHERE child_id = ?').run(req.params.id);
    return { ok: true };
  });

  // ---------- the leaderboard a child sees ----------
  app.get<{ Params: { id: string }; Querystring: { period?: string } }>('/api/children/:id/leaderboard', {
    preHandler: ctx.requireChild,
    schema: { querystring: { type: 'object', properties: { period: { enum: ['week', 'all'] } } } },
  }, async (req) => {
    const period: Period = req.query.period === 'all' ? 'all' : 'week';
    const since = weekStart(londonDay(now()));
    const m = membership(req.params.id);
    const schools = schoolBoard(db, period, since);
    const top = schools.slice(0, BOARD_SIZE);
    const mine = m ? schools.find((s) => s.id === m.schoolId) : undefined;
    const strip = ({ id, ...s }: (typeof schools)[number]) => ({ ...s, mine: id === m?.schoolId });
    if (!m) return { period, weekStart: since, school: null, schools: top.map(strip) };

    const members = memberScores(db, m.schoolId, period, since);
    const me = members.find((x) => x.childId === req.params.id)!;
    const shown = rank(members.filter((x) => x.onBoard && (period === 'all' || x.score > 0)));
    const myRow = shown.find((x) => x.childId === req.params.id);
    const pupils = [...shown.slice(0, BOARD_SIZE), ...(myRow && myRow.rank > BOARD_SIZE ? [myRow] : [])]
      .map((x) => ({ rank: x.rank, codeName: x.codeName, avatar: x.avatar ?? '🙂', score: x.score, me: x.childId === req.params.id }));
    return {
      period,
      weekStart: since,
      school: { name: m.schoolName, pupils: members.length, rank: mine?.rank ?? null, score: mine?.score ?? null, minPupils: MIN_SCHOOL_PUPILS },
      schools: [...top, ...(mine && mine.rank > BOARD_SIZE ? [mine] : [])].map(strip),
      pupils,
      me: { codeName: m.codeName, onBoard: !!m.onBoard, score: me.score, rank: myRow?.rank ?? null },
      dailyCap: DAILY_POINTS_CAP,
    };
  });

  // ---------- teachers: registering a school ----------
  app.post<{ Body: { name: string } }>('/api/schools', {
    preHandler: ctx.requireParent,
    schema: { body: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', maxLength: 100 } } } },
  }, async (req, reply) => {
    const name = req.body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 3) return reply.code(400).send({ error: 'Please enter the school\'s full name.' });
    if (!ctx.isVerified(req.parent!.id)) return reply.code(403).send({ error: 'Please confirm your email first.' });
    const count = db.prepare('SELECT COUNT(*) AS n FROM schools WHERE owner_id = ?').get(req.parent!.id) as { n: number };
    if (count.n >= MAX_SCHOOLS_PER_TEACHER) return reply.code(429).send({ error: 'You have registered the maximum number of schools.' });
    const id = newId();
    db.prepare("INSERT INTO schools (id, name, owner_id, join_code, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
      .run(id, name, req.parent!.id, newJoinCode(), now());
    if (ctx.adminEmail) void ctx.sendMail(ctx.adminEmail, emails.schoolPending(name, req.parent!.email));
    return reply.code(201).send({ id, name, status: 'pending' });
  });

  app.get('/api/schools', { preHandler: ctx.requireParent }, async (req) => {
    const rows = db.prepare(`SELECT s.id, s.name, s.status, s.join_code AS code, (SELECT COUNT(*) FROM memberships m WHERE m.school_id = s.id) AS pupils
      FROM schools s WHERE s.owner_id = ? ORDER BY s.created_at`).all(req.parent!.id) as { id: string; name: string; status: string; code: string; pupils: number }[];
    // The join code is only shown once an admin has approved the school.
    return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, pupils: r.pupils, joinCode: r.status === 'approved' ? formatCode(r.code) : null }));
  });

  /** A new join code, e.g. if the old one was shared too widely. Pupils who already joined stay in. */
  app.post<{ Params: { id: string } }>('/api/schools/:id/code', { preHandler: ctx.requireParent }, async (req, reply) => {
    const s = db.prepare("SELECT id FROM schools WHERE id = ? AND owner_id = ? AND status = 'approved'").get(req.params.id, req.parent!.id);
    if (!s) return reply.code(404).send({ error: 'Not found.' });
    const code = newJoinCode();
    db.prepare('UPDATE schools SET join_code = ? WHERE id = ?').run(code, req.params.id);
    return { joinCode: formatCode(code) };
  });

  // ---------- admin: approving schools ----------
  app.get('/api/admin/schools', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: 'Not found.' });
    return db.prepare(`SELECT s.id, s.name, s.status, s.created_at AS createdAt, p.email AS teacherEmail,
      (SELECT COUNT(*) FROM memberships m WHERE m.school_id = s.id) AS pupils
      FROM schools s LEFT JOIN parents p ON p.id = s.owner_id ORDER BY s.status DESC, s.created_at`).all();
  });

  app.post<{ Params: { id: string } }>('/api/admin/schools/:id/approve', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: 'Not found.' });
    const s = db.prepare('SELECT s.name, p.email FROM schools s LEFT JOIN parents p ON p.id = s.owner_id WHERE s.id = ?')
      .get(req.params.id) as { name: string; email: string | null } | undefined;
    if (!s) return reply.code(404).send({ error: 'Not found.' });
    db.prepare("UPDATE schools SET status = 'approved' WHERE id = ?").run(req.params.id);
    if (s.email) void ctx.sendMail(s.email, emails.schoolApproved(s.name, ctx.appUrl));
    return { ok: true };
  });

  /** Remove a school (e.g. not genuine). Its pupils simply leave it; their own progress is untouched. */
  app.delete<{ Params: { id: string } }>('/api/admin/schools/:id', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: 'Not found.' });
    db.prepare('DELETE FROM points WHERE child_id IN (SELECT child_id FROM memberships WHERE school_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM schools WHERE id = ?').run(req.params.id);
    return { ok: true };
  });
}
