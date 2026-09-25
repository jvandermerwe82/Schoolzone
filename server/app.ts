/**
 * Schoolzone API. Build with `buildApp(options)`; `server/index.ts` starts it.
 *
 * Parents have accounts; children don't (a child uses the app on a parent's
 * signed-in device). Before any child data is stored, a parent must accept
 * the data-processing consent. The AI tutor and research use of answer data
 * are separate, optional consents.
 */
import cookie from '@fastify/cookie';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { createHmac } from 'node:crypto';
import { updateItem, type ItemStats } from '../src/brain/items';
import type { Level, Question } from '../src/brain/types';
import type { LearningIntelligenceState } from '../src/brain/learning-intelligence';
import type { DB } from './db';
import { hashSecret, hashToken, newId, newToken, RateLimiter, verifySecret } from './security';
import { ConsoleMailer, emails, type Mailer } from './mailer';
import { registerClassRoutes } from './classview';
import { awardPoints, registerSchoolRoutes } from './leaderboard';
import { askTutor, type TutorModel, type TutorTurn } from './tutor';

export const CONSENT_VERSION = '2026-09-v1';

export interface AppOptions {
  db: DB;
  /** Absent when no Anthropic credentials are configured: the tutor is switched off. */
  tutor?: TutorModel | null;
  /** Mark cookies Secure (production, behind HTTPS). */
  secureCookies?: boolean;
  /** Enables the research export when set. */
  adminToken?: string;
  /** Secret used to pseudonymise child ids in research exports. */
  exportSalt?: string;
  /** Maximum AI tutor messages per child per day. */
  tutorDailyLimit?: number;
  /** Sends verification, password-reset and safety emails. Defaults to logging them. */
  mailer?: Mailer;
  /** Public address of the app, used in email links (never taken from request headers). */
  appUrl?: string;
  /**
   * Behind a hosting proxy/load balancer, trust its X-Forwarded-For header so
   * rate limits see the real client address: `true`, or the proxy's
   * addresses/ranges (comma-separated). Only enable when the app can't be
   * reached except through that proxy.
   */
  trustProxy?: boolean | string;
  /** Where to send "a new school needs approving" emails. */
  adminEmail?: string;
  /** Send Strict-Transport-Security (only when served over HTTPS). */
  hsts?: boolean;
  now?: () => number;
  logger?: boolean;
}

const SESSION_DAYS = 30;
const RESET_TTL = 60 * 60_000;
const VERIFY_TTL = 7 * 86_400_000;
const FLAG_EMAIL_GAP = 60 * 60_000;
const COOKIE = 'sz_session';
const MAX_PROFILE_BYTES = 512 * 1024;

interface Parent { id: string; email: string }
interface ConsentRow { version: string; data_processing: number; ai_tutor: number; research: number; created_at: number }

declare module 'fastify' {
  interface FastifyRequest { parent?: Parent }
}

export function buildApp(opts: AppOptions) {
  const { db } = opts;
  const now = opts.now ?? Date.now;
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1024 * 1024, trustProxy: opts.trustProxy ?? false });
  app.register(cookie);

  // Security headers on every response.
  app.addHook('onSend', async (req, reply) => {
    reply.header('Content-Security-Policy', [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
      "connect-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ].join('; '));
    reply.header('X-Content-Type-Options', 'nosniff');
    // Email links carry one-time tokens in the URL: never pass them on to other sites.
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    if (opts.hsts) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });

  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const signupLimiter = new RateLimiter(5, 60 * 60_000);
  const forgotLimiter = new RateLimiter(5, 60 * 60_000);
  const mailer = opts.mailer ?? new ConsoleMailer();
  const appUrl = (opts.appUrl ?? 'http://localhost:5173').replace(/\/$/, '');

  /** Email failures are logged, never shown to the user (they could reveal whether an account exists). */
  const sendMail = (to: string, mail: { subject: string; text: string }) =>
    mailer.send({ to, ...mail }).catch((err) => app.log.error({ err }, 'email failed'));

  /** Single-use token: only its hash is stored. */
  const issueToken = (parentId: string, kind: 'reset' | 'verify', ttl: number) => {
    const token = newToken();
    db.prepare('INSERT INTO auth_tokens (token_hash, parent_id, kind, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), parentId, kind, now() + ttl);
    return token;
  };
  /** Returns the parent id if the token is valid, and marks it used. */
  const useToken = (token: string, kind: 'reset' | 'verify'): string | null => {
    const row = db.prepare('SELECT parent_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND kind = ?')
      .get(hashToken(token), kind) as { parent_id: string; expires_at: number; used_at: number | null } | undefined;
    if (!row || row.used_at !== null || row.expires_at < now()) return null;
    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?').run(now(), hashToken(token));
    return row.parent_id;
  };
  const sendVerification = (parentId: string, email: string) => {
    const token = issueToken(parentId, 'verify', VERIFY_TTL);
    return sendMail(email, emails.verify(`${appUrl}/?verify=${token}`));
  };
  const isVerified = (parentId: string) =>
    !!(db.prepare('SELECT email_verified_at FROM parents WHERE id = ?').get(parentId) as { email_verified_at: number | null }).email_verified_at;

  // ---------- helpers ----------
  const setSession = (reply: FastifyReply, parentId: string) => {
    const token = newToken();
    const t = now();
    db.prepare('INSERT INTO sessions (token_hash, parent_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), parentId, t, t + SESSION_DAYS * 86_400_000);
    reply.setCookie(COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: !!opts.secureCookies, maxAge: SESSION_DAYS * 86_400,
    });
  };

  const currentParent = (req: FastifyRequest): Parent | null => {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const row = db.prepare(
      'SELECT p.id, p.email FROM sessions s JOIN parents p ON p.id = s.parent_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ).get(hashToken(token), now()) as Parent | undefined;
    return row ?? null;
  };

  const requireParent = async (req: FastifyRequest, reply: FastifyReply) => {
    const parent = currentParent(req);
    if (!parent) return reply.code(401).send({ error: 'Please sign in.' });
    req.parent = parent;
  };

  const latestConsent = (parentId: string): ConsentRow | null =>
    (db.prepare('SELECT version, data_processing, ai_tutor, research, created_at FROM consents WHERE parent_id = ? ORDER BY id DESC LIMIT 1')
      .get(parentId) as ConsentRow | undefined) ?? null;

  const hasDataConsent = (parentId: string) => {
    const c = latestConsent(parentId);
    return !!c && c.version === CONSENT_VERSION && c.data_processing === 1;
  };

  /** Child routes: signed in, consent given, and the child belongs to this parent. */
  const requireChild = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await requireParent(req, reply);
    if (reply.sent) return;
    if (!hasDataConsent(req.parent!.id)) return reply.code(403).send({ error: 'Consent needed first.' });
    const owns = db.prepare('SELECT 1 FROM children WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent!.id);
    if (!owns) return reply.code(404).send({ error: 'Not found.' });
  };

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

  // ---------- health ----------
  app.get('/api/health', async (_req, reply) => {
    try {
      db.prepare('SELECT 1').get();
    } catch {
      return reply.code(503).send({ ok: false, error: 'Database unavailable.' });
    }
    return { ok: true, tutor: !!opts.tutor, consentVersion: CONSENT_VERSION };
  });

  // ---------- auth ----------
  const credentials = {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: { email: { type: 'string', maxLength: 254 }, password: { type: 'string', maxLength: 200 } },
  } as const;

  app.post<{ Body: { email: string; password: string } }>('/api/auth/signup', { schema: { body: credentials } }, async (req, reply) => {
    if (!signupLimiter.take(req.ip, now())) return reply.code(429).send({ error: 'Too many sign-ups. Try again later.' });
    const email = req.body.email.trim().toLowerCase();
    if (!emailOk(email)) return reply.code(400).send({ error: 'Please enter a valid email address.' });
    if (req.body.password.length < 10) return reply.code(400).send({ error: 'Please use a password of at least 10 characters.' });
    if (db.prepare('SELECT 1 FROM parents WHERE email = ?').get(email)) {
      return reply.code(409).send({ error: 'An account with that email already exists.' });
    }
    const id = newId();
    db.prepare('INSERT INTO parents (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(id, email, await hashSecret(req.body.password), now());
    await sendVerification(id, email);
    setSession(reply, id);
    return reply.code(201).send({ email });
  });

  app.post<{ Body: { email: string; password: string } }>('/api/auth/login', { schema: { body: credentials } }, async (req, reply) => {
    const email = req.body.email.trim().toLowerCase();
    if (!loginLimiter.take(`${req.ip}|${email}`, now())) return reply.code(429).send({ error: 'Too many attempts. Try again in 15 minutes.' });
    const row = db.prepare('SELECT id, password_hash FROM parents WHERE email = ?').get(email) as { id: string; password_hash: string } | undefined;
    // Same message either way, so the form doesn't reveal which emails have accounts.
    if (!row || !(await verifySecret(req.body.password, row.password_hash))) {
      return reply.code(401).send({ error: 'Email or password is not right.' });
    }
    setSession(reply, row.id);
    return { email };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  // ---------- email verification ----------
  const tokenBody = {
    type: 'object', required: ['token'], additionalProperties: false,
    properties: { token: { type: 'string', maxLength: 200 } },
  } as const;

  app.post<{ Body: { token: string } }>('/api/auth/verify', { schema: { body: tokenBody } }, async (req, reply) => {
    const parentId = useToken(req.body.token, 'verify');
    if (!parentId) return reply.code(400).send({ error: 'That link has expired or was already used. Sign in and ask for a new one.' });
    db.prepare('UPDATE parents SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL').run(now(), parentId);
    return { ok: true };
  });

  const resendLimiter = new RateLimiter(3, 60 * 60_000);
  app.post('/api/auth/verify/resend', { preHandler: requireParent }, async (req, reply) => {
    if (isVerified(req.parent!.id)) return { ok: true };
    if (!resendLimiter.take(req.parent!.id, now())) return reply.code(429).send({ error: 'Please wait a while before asking again.' });
    await sendVerification(req.parent!.id, req.parent!.email);
    return { ok: true };
  });

  // ---------- password reset ----------
  app.post<{ Body: { email: string } }>('/api/auth/forgot', {
    schema: { body: { type: 'object', required: ['email'], additionalProperties: false, properties: { email: { type: 'string', maxLength: 254 } } } },
  }, async (req, reply) => {
    const email = req.body.email.trim().toLowerCase();
    if (!forgotLimiter.take(req.ip, now()) || !forgotLimiter.take(`e|${email}`, now())) {
      return reply.code(429).send({ error: 'Too many requests. Try again later.' });
    }
    const row = db.prepare('SELECT id FROM parents WHERE email = ?').get(email) as { id: string } | undefined;
    if (row) {
      const token = issueToken(row.id, 'reset', RESET_TTL);
      // Not awaited, so the response time doesn't reveal whether the account exists.
      void sendMail(email, emails.reset(`${appUrl}/?reset=${token}`));
    }
    // Same answer either way.
    return { ok: true };
  });

  app.post<{ Body: { token: string; password: string } }>('/api/auth/reset', {
    schema: {
      body: {
        type: 'object', required: ['token', 'password'], additionalProperties: false,
        properties: { token: { type: 'string', maxLength: 200 }, password: { type: 'string', maxLength: 200 } },
      },
    },
  }, async (req, reply) => {
    if (req.body.password.length < 10) return reply.code(400).send({ error: 'Please use a password of at least 10 characters.' });
    const parentId = useToken(req.body.token, 'reset');
    if (!parentId) return reply.code(400).send({ error: 'That link has expired or was already used. Please ask for a new one.' });
    const parent = db.prepare('SELECT email FROM parents WHERE id = ?').get(parentId) as { email: string };
    db.prepare('UPDATE parents SET password_hash = ? WHERE id = ?').run(await hashSecret(req.body.password), parentId);
    // Clicking the emailed link proves the address works.
    db.prepare('UPDATE parents SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(now(), parentId);
    db.prepare('DELETE FROM sessions WHERE parent_id = ?').run(parentId); // sign out every device
    db.prepare("UPDATE auth_tokens SET used_at = ? WHERE parent_id = ? AND kind = 'reset' AND used_at IS NULL").run(now(), parentId);
    void sendMail(parent.email, emails.passwordChanged());
    setSession(reply, parentId);
    return { email: parent.email };
  });

  app.post<{ Body: { current: string; password: string } }>('/api/auth/password', {
    preHandler: requireParent,
    schema: {
      body: {
        type: 'object', required: ['current', 'password'], additionalProperties: false,
        properties: { current: { type: 'string', maxLength: 200 }, password: { type: 'string', maxLength: 200 } },
      },
    },
  }, async (req, reply) => {
    if (!loginLimiter.take(`${req.ip}|${req.parent!.email}`, now())) return reply.code(429).send({ error: 'Too many attempts. Try again in 15 minutes.' });
    const row = db.prepare('SELECT password_hash FROM parents WHERE id = ?').get(req.parent!.id) as { password_hash: string };
    if (!(await verifySecret(req.body.current, row.password_hash))) return reply.code(401).send({ error: 'Your current password is not right.' });
    if (req.body.password.length < 10) return reply.code(400).send({ error: 'Please use a password of at least 10 characters.' });
    db.prepare('UPDATE parents SET password_hash = ? WHERE id = ?').run(await hashSecret(req.body.password), req.parent!.id);
    db.prepare('DELETE FROM sessions WHERE parent_id = ?').run(req.parent!.id);
    void sendMail(req.parent!.email, emails.passwordChanged());
    setSession(reply, req.parent!.id);
    return { ok: true };
  });

  app.get('/api/me', { preHandler: requireParent }, async (req) => {
    const c = latestConsent(req.parent!.id);
    const pin = db.prepare('SELECT pin_hash FROM parents WHERE id = ?').get(req.parent!.id) as { pin_hash: string | null };
    const flags = db.prepare(`SELECT COUNT(*) AS n FROM tutor_messages t JOIN children c ON c.id = t.child_id
      WHERE c.parent_id = ? AND t.flagged LIKE 'safety:%' AND t.at > ?`).get(req.parent!.id, now() - 30 * 86_400_000) as { n: number };
    return {
      email: req.parent!.email,
      emailVerified: isVerified(req.parent!.id),
      safetyFlags: flags.n,
      hasPin: !!pin.pin_hash,
      consent: c && c.version === CONSENT_VERSION
        ? { version: c.version, dataProcessing: !!c.data_processing, aiTutor: !!c.ai_tutor, research: !!c.research, at: c.created_at }
        : null,
      tutorAvailable: !!opts.tutor,
    };
  });

  // ---------- consent ----------
  app.post<{ Body: { version: string; dataProcessing: boolean; aiTutor: boolean; research: boolean } }>('/api/consent', {
    preHandler: requireParent,
    schema: {
      body: {
        type: 'object', additionalProperties: false,
        required: ['version', 'dataProcessing', 'aiTutor', 'research'],
        properties: { version: { type: 'string' }, dataProcessing: { type: 'boolean' }, aiTutor: { type: 'boolean' }, research: { type: 'boolean' } },
      },
    },
  }, async (req, reply) => {
    if (req.body.version !== CONSENT_VERSION) return reply.code(400).send({ error: 'Please review the latest consent text.' });
    db.prepare('INSERT INTO consents (parent_id, version, data_processing, ai_tutor, research, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.parent!.id, req.body.version, req.body.dataProcessing ? 1 : 0, req.body.aiTutor ? 1 : 0, req.body.research ? 1 : 0, now());
    if (!req.body.research) {
      // Withdrawing research consent removes stored answer events.
      db.prepare('DELETE FROM events WHERE child_id IN (SELECT id FROM children WHERE parent_id = ?)').run(req.parent!.id);
    }
    return { ok: true };
  });

  // ---------- parent PIN ----------
  app.post<{ Body: { pin: string } }>('/api/pin', {
    preHandler: requireParent,
    schema: { body: { type: 'object', required: ['pin'], additionalProperties: false, properties: { pin: { type: 'string', pattern: '^\\d{4}$' } } } },
  }, async (req) => {
    db.prepare('UPDATE parents SET pin_hash = ? WHERE id = ?').run(await hashSecret(req.body.pin), req.parent!.id);
    return { ok: true };
  });

  const pinLimiter = new RateLimiter(10, 15 * 60_000);
  app.post<{ Body: { pin: string } }>('/api/pin/check', {
    preHandler: requireParent,
    schema: { body: { type: 'object', required: ['pin'], additionalProperties: false, properties: { pin: { type: 'string', maxLength: 10 } } } },
  }, async (req, reply) => {
    if (!pinLimiter.take(req.parent!.id, now())) return reply.code(429).send({ error: 'Too many tries. Try again later.' });
    const row = db.prepare('SELECT pin_hash FROM parents WHERE id = ?').get(req.parent!.id) as { pin_hash: string | null };
    return { ok: !!row.pin_hash && (await verifySecret(req.body.pin, row.pin_hash)) };
  });

  // ---------- children ----------
  app.get('/api/children', { preHandler: requireParent }, async (req) => {
    const rows = db.prepare('SELECT id, profile_json, version FROM children WHERE parent_id = ? ORDER BY created_at').all(req.parent!.id) as
      { id: string; profile_json: string; version: number }[];
    return rows.map((r) => ({ id: r.id, version: r.version, profile: JSON.parse(r.profile_json) }));
  });

  app.post<{ Body: { profile: Record<string, unknown> } }>('/api/children', {
    preHandler: requireParent,
    schema: { body: { type: 'object', required: ['profile'], properties: { profile: { type: 'object' } } } },
  }, async (req, reply) => {
    if (!hasDataConsent(req.parent!.id)) return reply.code(403).send({ error: 'Consent needed first.' });
    // A confirmed email means we can always reach the parent (e.g. about a flagged chat).
    if (!isVerified(req.parent!.id)) return reply.code(403).send({ error: 'Please confirm your email first. Check your inbox for our link.' });
    const json = JSON.stringify(req.body.profile);
    if (json.length > MAX_PROFILE_BYTES) return reply.code(413).send({ error: 'Profile too large.' });
    const id = newId();
    const t = now();
    const profile = { ...req.body.profile, id };
    db.prepare('INSERT INTO children (id, parent_id, profile_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run(id, req.parent!.id, JSON.stringify(profile), t, t);
    return reply.code(201).send({ id, version: 1, profile });
  });

  /** Save a child's profile. `version` must match, so two devices can't silently overwrite each other. */
  app.put<{ Params: { id: string }; Body: { profile: Record<string, unknown>; version: number } }>('/api/children/:id', {
    preHandler: requireChild,
    schema: { body: { type: 'object', required: ['profile', 'version'], properties: { profile: { type: 'object' }, version: { type: 'integer' } } } },
  }, async (req, reply) => {
    const json = JSON.stringify({ ...req.body.profile, id: req.params.id });
    if (json.length > MAX_PROFILE_BYTES) return reply.code(413).send({ error: 'Profile too large.' });
    const res = db.prepare('UPDATE children SET profile_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
      .run(json, now(), req.params.id, req.body.version);
    if (res.changes === 0) {
      const cur = db.prepare('SELECT profile_json, version FROM children WHERE id = ?').get(req.params.id) as { profile_json: string; version: number };
      return reply.code(409).send({ error: 'Updated on another device.', version: cur.version, profile: JSON.parse(cur.profile_json) });
    }
    return { version: req.body.version + 1 };
  });

  /** Erase a child and everything recorded about them. */
  app.delete<{ Params: { id: string } }>('/api/children/:id', { preHandler: requireChild }, async (req) => {
    db.prepare('DELETE FROM children WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // ---------- answer events and shared question difficulty ----------
  interface EventIn {
    at: number;
    skillId: string;
    level: number;
    itemKey: string;
    correct: boolean;
    hinted: boolean;
    rapid: boolean;
    timeMs: number;
    predicted: number;
    misconception?: string | null;
    strategy?: string | null;

    eventVersion?: number;
    sessionId?: string | null;
    sessionPosition?: number | null;
    missionLength?: number | null;
    planReason?: 'new' | 'continue' | 'review' | 'help' | 'climb' | null;
    helpEvent?: 'stuck' | 'helped' | 'switched' | 'resolved' | null;
    diagnostic?: boolean | null;
    dueReview?: boolean | null;
    curriculumId?: string | null;
    canonicalNodeId?: string | null;
    evidenceStrength?: 'direct' | 'supporting' | null;
    teacherTargetNodeId?: string | null;
    teacherRouteReason?: 'target' | 'prerequisite' | null;
    pKnownBefore?: number | null;
    pKnownAfter?: number | null;
    abilityBefore?: number | null;
    abilityAfter?: number | null;
    masteredAfter?: boolean | null;
  }

  const eventSchema = {
    type: 'object', additionalProperties: false,
    required: ['at', 'skillId', 'level', 'itemKey', 'correct', 'hinted', 'rapid', 'timeMs', 'predicted'],
    properties: {
      at: { type: 'integer' },
      skillId: { type: 'string', maxLength: 64 },
      level: { type: 'integer', minimum: 1, maximum: 5 },
      itemKey: { type: 'string', maxLength: 128 },
      correct: { type: 'boolean' },
      hinted: { type: 'boolean' },
      rapid: { type: 'boolean' },
      timeMs: { type: 'integer', minimum: 0 },
      predicted: { type: 'number', minimum: 0, maximum: 1 },
      misconception: { type: ['string', 'null'], maxLength: 128 },
      strategy: { type: ['string', 'null'], maxLength: 32 },

      eventVersion: { type: 'integer', minimum: 1, maximum: 100 },
      sessionId: { type: ['string', 'null'], maxLength: 64 },
      sessionPosition: { type: ['integer', 'null'], minimum: 1, maximum: 1000 },
      missionLength: { type: ['integer', 'null'], minimum: 1, maximum: 1000 },
      planReason: { enum: ['new', 'continue', 'review', 'help', 'climb', null] },
      helpEvent: { enum: ['stuck', 'helped', 'switched', 'resolved', null] },
      diagnostic: { type: ['boolean', 'null'] },
      dueReview: { type: ['boolean', 'null'] },
      curriculumId: { type: ['string', 'null'], maxLength: 64 },
      canonicalNodeId: { type: ['string', 'null'], maxLength: 160 },
      evidenceStrength: { enum: ['direct', 'supporting', null] },
      teacherTargetNodeId: { type: ['string', 'null'], maxLength: 160 },
      teacherRouteReason: { enum: ['target', 'prerequisite', null] },
      pKnownBefore: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      pKnownAfter: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      abilityBefore: { type: ['number', 'null'], minimum: -20, maximum: 20 },
      abilityAfter: { type: ['number', 'null'], minimum: -20, maximum: 20 },
      masteredAfter: { type: ['boolean', 'null'] },
    },
  } as const;

  const loadItems = (): ItemStats => {
    const rows = db.prepare('SELECT key, offset, n FROM items').all() as { key: string; offset: number; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.key, { offset: r.offset, n: r.n }]));
  };

  const nullableBool = (value: boolean | null | undefined): number | null =>
    value === null || value === undefined ? null : value ? 1 : 0;

  app.post<{ Params: { id: string }; Body: { events: EventIn[] } }>('/api/children/:id/events', {
    preHandler: requireChild,
    schema: { body: { type: 'object', required: ['events'], properties: { events: { type: 'array', maxItems: 200, items: eventSchema } } } },
  }, async (req) => {
    const research = latestConsent(req.parent!.id)?.research === 1;
    const insert = db.prepare(`INSERT INTO events (
      child_id, at, skill_id, level, item_key, correct, hinted, rapid, time_ms, predicted, misconception, strategy,
      event_version, session_id, session_position, mission_length, plan_reason, help_event, diagnostic, due_review,
      curriculum_id, canonical_node_id, evidence_strength, teacher_target_node_id, teacher_route_reason,
      p_known_before, p_known_after, ability_before, ability_after, mastered_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const upsert = db.prepare('INSERT INTO items (key, offset, n) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET offset = excluded.offset, n = excluded.n');
    let items = loadItems();
    db.exec('BEGIN');
    try {
      for (const e of req.body.events) {
        if (research) {
          insert.run(
            req.params.id,
            e.at,
            e.skillId,
            e.level,
            e.itemKey,
            e.correct ? 1 : 0,
            e.hinted ? 1 : 0,
            e.rapid ? 1 : 0,
            e.timeMs,
            e.predicted,
            e.misconception ?? null,
            e.strategy ?? null,
            e.eventVersion ?? 1,
            e.sessionId ?? null,
            e.sessionPosition ?? null,
            e.missionLength ?? null,
            e.planReason ?? null,
            e.helpEvent ?? null,
            nullableBool(e.diagnostic),
            nullableBool(e.dueReview),
            e.curriculumId ?? null,
            e.canonicalNodeId ?? null,
            e.evidenceStrength ?? null,
            e.teacherTargetNodeId ?? null,
            e.teacherRouteReason ?? null,
            e.pKnownBefore ?? null,
            e.pKnownAfter ?? null,
            e.abilityBefore ?? null,
            e.abilityAfter ?? null,
            nullableBool(e.masteredAfter),
          );
        }

        // Shared learning of question difficulty uses no personal data; skip hinted or rushed answers.
        // The key must belong to the skill, so one bad client can't disturb other skills' data.
        const keyOk = e.itemKey === `${e.skillId}:L${e.level}` || e.itemKey.startsWith(`${e.skillId}#`);
        if (!e.hinted && !e.rapid && keyOk) {
          const before = items;
          items = updateItem(items, { id: e.itemKey, skillId: e.skillId, level: e.level as Level }, e.correct ? 1 : 0, e.predicted);
          for (const [k, v] of Object.entries(items)) if (before[k] !== v) upsert.run(k, v.offset, v.n);
        }
      }

      // Leaderboard effort points (only if the child has joined a school).
      awardPoints(db, req.params.id, req.body.events, now());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { ok: true, stored: research ? req.body.events.length : 0 };
  });

  app.get('/api/items', async () => loadItems());

  // ---------- AI tutor ----------
  const tutorLimit = opts.tutorDailyLimit ?? 60;
  app.post<{ Params: { id: string }; Body: { question: Question; given?: string; misconception?: string; history: TutorTurn[]; message: string } }>(
    '/api/children/:id/tutor',
    {
      preHandler: requireChild,
      schema: {
        body: {
          type: 'object', required: ['question', 'history', 'message'],
          properties: {
            question: {
              type: 'object', required: ['skillId', 'level', 'id', 'prompt', 'answer', 'explanation'],
              properties: {
                skillId: { type: 'string', maxLength: 64 }, level: { type: 'integer' }, id: { type: 'string', maxLength: 300 },
                prompt: { type: 'string', maxLength: 500 }, answer: { type: 'string', maxLength: 200 },
                explanation: { type: 'string', maxLength: 1000 }, choices: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 200 } },
                passageId: { type: 'string', maxLength: 64 },
              },
            },
            given: { type: 'string', maxLength: 200 },
            misconception: { type: 'string', maxLength: 300 },
            history: {
              type: 'array', maxItems: 20,
              items: { type: 'object', required: ['role', 'content'], properties: { role: { enum: ['user', 'assistant'] }, content: { type: 'string', maxLength: 1000 } } },
            },
            message: { type: 'string', minLength: 1, maxLength: 1000 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!opts.tutor) return reply.code(503).send({ error: 'The tutor is not switched on.' });
      if (latestConsent(req.parent!.id)?.ai_tutor !== 1) return reply.code(403).send({ error: 'A parent needs to switch on the AI tutor first.' });
      if (!isVerified(req.parent!.id)) return reply.code(403).send({ error: 'A parent needs to confirm their email first.' });
      const since = now() - 86_400_000;
      const used = db.prepare("SELECT COUNT(*) AS n FROM tutor_messages WHERE child_id = ? AND role = 'user' AND at > ?").get(req.params.id, since) as { n: number };
      if (used.n >= tutorLimit) return reply.code(429).send({ error: 'That\'s enough tutor chat for today. Try the hints and examples!' });

      const result = await askTutor(opts.tutor, req.body);
      const log = db.prepare('INSERT INTO tutor_messages (child_id, at, role, text, flagged) VALUES (?, ?, ?, ?, ?)');
      log.run(req.params.id, now(), 'user', req.body.message.slice(0, 1000), null);
      log.run(req.params.id, now(), 'assistant', result.reply, result.flagged);

      // Tell the parent straight away (at most once an hour per child, so they aren't flooded).
      if (result.flagged?.startsWith('safety:')) {
        const last = db.prepare('SELECT last_sent_at FROM flag_notices WHERE child_id = ?').get(req.params.id) as { last_sent_at: number } | undefined;
        if (!last || now() - last.last_sent_at >= FLAG_EMAIL_GAP) {
          db.prepare('INSERT INTO flag_notices (child_id, last_sent_at) VALUES (?, ?) ON CONFLICT(child_id) DO UPDATE SET last_sent_at = excluded.last_sent_at')
            .run(req.params.id, now());
          const child = db.prepare('SELECT profile_json FROM children WHERE id = ?').get(req.params.id) as { profile_json: string };
          const name = String((JSON.parse(child.profile_json) as { name?: string }).name ?? 'your child');
          void sendMail(req.parent!.email, emails.safetyFlag(name, result.flagged.slice(7), appUrl));
        }
      }
      return result;
    },
  );

  /** Parents can read everything their child said to the tutor, and every reply. */
  app.get<{ Params: { id: string } }>('/api/children/:id/tutor', { preHandler: requireChild }, async (req) =>
    db.prepare('SELECT at, role, text, flagged FROM tutor_messages WHERE child_id = ? ORDER BY id DESC LIMIT 200').all(req.params.id));

  // ---------- schools and leaderboards ----------
  registerSchoolRoutes(app, {
    db, now, requireParent, requireChild, isVerified, sendMail, appUrl,
    adminToken: opts.adminToken, adminEmail: opts.adminEmail,
  });
  registerClassRoutes(app, { db, now, requireParent });

  // ---------- account deletion ----------
  app.delete('/api/account', { preHandler: requireParent }, async (req, reply) => {
    db.prepare('DELETE FROM parents WHERE id = ?').run(req.parent!.id); // cascades to everything else
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  // ---------- research export (pseudonymised, research-consented data only) ----------
  const researchSalt = opts.exportSalt ?? opts.adminToken ?? 'research-disabled';
  const researchPseudo = (id: string) =>
    createHmac('sha256', researchSalt).update(id).digest('hex').slice(0, 16);
  const researchKids = () => db.prepare(`SELECT c.id, c.profile_json FROM children c WHERE c.parent_id IN (
    SELECT parent_id FROM consents x
    WHERE x.id = (SELECT MAX(id) FROM consents y WHERE y.parent_id = x.parent_id)
      AND x.research = 1)`).all() as { id: string; profile_json: string }[];

  app.get('/api/admin/events.csv', async (req, reply) => {
    if (!opts.adminToken || req.headers['x-admin-token'] !== opts.adminToken) return reply.code(404).send({ error: 'Not found.' });
    const rows = db.prepare(`SELECT
      child_id, event_version, at, session_id, session_position, mission_length,
      skill_id, level, item_key, correct, hinted, rapid, time_ms, predicted,
      misconception, strategy, plan_reason, help_event, diagnostic, due_review,
      curriculum_id, canonical_node_id, evidence_strength,
      teacher_target_node_id, teacher_route_reason,
      p_known_before, p_known_after, ability_before, ability_after, mastered_after
      FROM events ORDER BY id`).all() as Record<string, string | number | null>[];
    const esc = (v: string | number | null) =>
      v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const header = [
      'learner', 'event_version', 'at', 'session_id', 'session_position', 'mission_length',
      'skill', 'level', 'item', 'correct', 'hinted', 'rapid', 'time_ms', 'predicted',
      'misconception', 'strategy', 'plan_reason', 'help_event', 'diagnostic', 'due_review',
      'curriculum_id', 'canonical_node_id', 'evidence_strength',
      'teacher_target_node_id', 'teacher_route_reason',
      'p_known_before', 'p_known_after', 'ability_before', 'ability_after', 'mastered_after',
    ].join(',');
    const lines = rows.map((r) => [
      researchPseudo(String(r.child_id)),
      r.event_version,
      r.at,
      r.session_id,
      r.session_position,
      r.mission_length,
      r.skill_id,
      r.level,
      r.item_key,
      r.correct,
      r.hinted,
      r.rapid,
      r.time_ms,
      r.predicted,
      r.misconception,
      r.strategy,
      r.plan_reason,
      r.help_event,
      r.diagnostic,
      r.due_review,
      r.curriculum_id,
      r.canonical_node_id,
      r.evidence_strength,
      r.teacher_target_node_id,
      r.teacher_route_reason,
      r.p_known_before,
      r.p_known_after,
      r.ability_before,
      r.ability_after,
      r.mastered_after,
    ].map(esc).join(','));
    reply.header('content-type', 'text/csv; charset=utf-8');
    return [header, ...lines].join('\n');
  });

  /**
   * Current explicit support preferences, excluding optional free-text notes.
   * These are hypotheses/instructions, not claims that the support works.
   */
  app.get('/api/admin/support-preferences.csv', async (req, reply) => {
    if (!opts.adminToken || req.headers['x-admin-token'] !== opts.adminToken) return reply.code(404).send({ error: 'Not found.' });
    const lines = ['learner,at,source,strategy,value'];
    for (const kid of researchKids()) {
      const profile = JSON.parse(kid.profile_json) as { learningIntelligence?: LearningIntelligenceState };
      for (const pref of profile.learningIntelligence?.supportPreferences ?? []) {
        lines.push([
          researchPseudo(kid.id),
          pref.at,
          pref.source,
          pref.strategy,
          pref.value,
        ].join(','));
      }
    }
    reply.header('content-type', 'text/csv; charset=utf-8');
    return lines.join('\n');
  });

  /** Structured support-effectiveness evidence; contains no preference notes. */
  app.get('/api/admin/support-outcomes.csv', async (req, reply) => {
    if (!opts.adminToken || req.headers['x-admin-token'] !== opts.adminToken) return reply.code(404).send({ error: 'Not found.' });
    const lines = ['learner,at,source,strategy,delta,weight,subject,skill'];
    for (const kid of researchKids()) {
      const profile = JSON.parse(kid.profile_json) as { learningIntelligence?: LearningIntelligenceState };
      for (const outcome of profile.learningIntelligence?.supportOutcomes ?? []) {
        lines.push([
          researchPseudo(kid.id),
          outcome.at,
          outcome.source,
          outcome.strategy,
          outcome.delta,
          outcome.weight,
          outcome.subject ?? '',
          outcome.skillId ?? '',
        ].join(','));
      }
    }
    reply.header('content-type', 'text/csv; charset=utf-8');
    return lines.join('\n');
  });

  /** Observable engagement signals only; never diagnostic labels or inferred conditions. */
  app.get('/api/admin/engagement.csv', async (req, reply) => {
    if (!opts.adminToken || req.headers['x-admin-token'] !== opts.adminToken) return reply.code(404).send({ error: 'Not found.' });
    const lines = ['learner,at,kind,subject,skill,value'];
    for (const kid of researchKids()) {
      const profile = JSON.parse(kid.profile_json) as { learningIntelligence?: LearningIntelligenceState };
      for (const signal of profile.learningIntelligence?.engagement ?? []) {
        lines.push([
          researchPseudo(kid.id),
          signal.at,
          signal.kind,
          signal.subject ?? '',
          signal.skillId ?? '',
          signal.value ?? '',
        ].join(','));
      }
    }
    reply.header('content-type', 'text/csv; charset=utf-8');
    return lines.join('\n');
  });

  /**
   * Checkpoint results, one row per answer, for children whose parent opted in
   * to research. Same pseudonymous learner ids as the events export.
   */
  app.get('/api/admin/checkpoints.csv', async (req, reply) => {
    if (!opts.adminToken || req.headers['x-admin-token'] !== opts.adminToken) return reply.code(404).send({ error: 'Not found.' });
    const kids = researchKids();
    const lines = ['learner,year,subject,form,order,at,skill,level,correct,time_ms'];
    for (const k of kids) {
      const p = JSON.parse(k.profile_json) as { year?: number; checkpoints?: { subject: string; form: string; at: number; answers: { skillId: string; level: number; correct: boolean; timeMs: number }[] }[] };
      const bySubject = new Map<string, number>();
      for (const c of [...(p.checkpoints ?? [])].sort((a, b) => a.at - b.at)) {
        const order = (bySubject.get(c.subject) ?? 0) + 1;
        bySubject.set(c.subject, order);
        for (const a of c.answers) {
          lines.push([researchPseudo(k.id), p.year ?? '', c.subject, c.form, order, c.at, a.skillId, a.level, a.correct ? 1 : 0, a.timeMs].join(','));
        }
      }
    }
    reply.header('content-type', 'text/csv; charset=utf-8');
    return lines.join('\n');
  });

  return app;
}
