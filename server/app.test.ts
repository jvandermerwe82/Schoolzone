import { beforeEach, describe, expect, it } from 'vitest';
import type { Question } from '../src/brain/types';
import { buildApp, CONSENT_VERSION } from './app';
import { openDb, pruneOldData, type DB } from './db';
import { MemoryMailer } from './mailer';
import { contextFor, findWrongSum, scrub, type TutorModel } from './tutor';

const PASSWORD = 'correct horse battery';

/** A stand-in for Claude that returns scripted replies, so tests never call the real API. */
class FakeTutor implements TutorModel {
  calls: { system: string; messages: { role: string; content: string }[] }[] = [];
  constructor(private replies: string[]) {}
  async reply(system: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
    this.calls.push({ system, messages });
    return { text: this.replies.shift() ?? 'What could you try first?', refused: false };
  }
}

const question: Question = {
  skillId: 'addition', level: 4, id: 'addition:47 + 38 = ?', prompt: '47 + 38 = ?', answer: '85',
  explanation: 'Add the ones first: 7 + 8 = 15. That makes 15, so write 5 and carry 1. Then add the rest: 47 + 38 = 85.',
};

const mailers = new WeakMap<object, MemoryMailer>();

function setup(tutor: TutorModel | null = null, extra: Partial<Parameters<typeof buildApp>[0]> = {}) {
  const db = openDb(':memory:');
  const mailer = new MemoryMailer();
  const app = buildApp({ db, tutor, adminToken: 'admin-secret', exportSalt: 'salt', mailer, appUrl: 'https://app.test', ...extra });
  mailers.set(app, mailer);
  return { db, app, mailer };
}

const tokenFrom = (link: string | null) => new URL(link!).searchParams.values().next().value!;

/** Sign up and (by default) confirm the email using the link from the verification email. */
async function signUp(app: ReturnType<typeof buildApp>, email = 'parent@example.com', verify = true) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email, password: PASSWORD } });
  expect(res.statusCode).toBe(201);
  const cookie = res.cookies.find((c) => c.name === 'sz_session')!;
  if (verify) {
    const link = mailers.get(app)!.lastLink(email);
    expect(link).toMatch(/^https:\/\/app\.test\/\?verify=/);
    const v = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token: tokenFrom(link) } });
    expect(v.statusCode).toBe(200);
  }
  return { cookie: `sz_session=${cookie.value}`, raw: cookie };
}

async function consent(app: ReturnType<typeof buildApp>, cookie: string, aiTutor = true, research = true) {
  const res = await app.inject({
    method: 'POST', url: '/api/consent', headers: { cookie },
    payload: { version: CONSENT_VERSION, dataProcessing: true, aiTutor, research },
  });
  expect(res.statusCode).toBe(200);
}

async function addChild(app: ReturnType<typeof buildApp>, cookie: string, name = 'Ava') {
  const res = await app.inject({ method: 'POST', url: '/api/children', headers: { cookie }, payload: { profile: { name, year: 6 } } });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string; version: number };
}

const event = (over: Record<string, unknown> = {}) => ({
  at: 1, skillId: 'addition', level: 4, itemKey: 'addition:L4', correct: true, hinted: false, rapid: false,
  timeMs: 5000, predicted: 0.8, misconception: null, strategy: null, ...over,
});

describe('accounts', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = setup().app; });

  it('signs up with a secure, http-only session cookie', async () => {
    const { raw } = await signUp(app);
    expect(raw.httpOnly).toBe(true);
    expect(raw.sameSite).toBe('Lax');
  });

  it('marks cookies Secure in production', async () => {
    const { app: prod } = setup(null, { secureCookies: true });
    const { raw } = await signUp(prod);
    expect(raw.secure).toBe(true);
  });

  it('rejects weak passwords, bad emails and duplicate accounts', async () => {
    const weak = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'a@b.co', password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'nope', password: PASSWORD } });
    expect(bad.statusCode).toBe(400);
    await signUp(app);
    const dup = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'Parent@Example.com', password: PASSWORD } });
    expect(dup.statusCode).toBe(409);
  });

  it('logs in and out, and gives the same error for unknown email or wrong password', async () => {
    await signUp(app);
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'parent@example.com', password: 'wrong password!' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nobody@example.com', password: PASSWORD } });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json().error).toBe(wrong.json().error);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'parent@example.com', password: PASSWORD } });
    expect(ok.statusCode).toBe(200);
    const cookie = `sz_session=${ok.cookies.find((c) => c.name === 'sz_session')!.value}`;
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(200);
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('rate-limits repeated login attempts', async () => {
    await signUp(app);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      codes.push((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'parent@example.com', password: 'wrong password!' } })).statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });

  it('stores the parent PIN hashed and checks it', async () => {
    const { db, app } = setup();
    const { cookie } = await signUp(app);
    await app.inject({ method: 'POST', url: '/api/pin', headers: { cookie }, payload: { pin: '4321' } });
    const stored = (db.prepare('SELECT pin_hash FROM parents').get() as { pin_hash: string }).pin_hash;
    expect(stored).not.toContain('4321');
    expect((await app.inject({ method: 'POST', url: '/api/pin/check', headers: { cookie }, payload: { pin: '4321' } })).json().ok).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/api/pin/check', headers: { cookie }, payload: { pin: '1111' } })).json().ok).toBe(false);
  });
});

describe('consent and children', () => {
  it('stores no child data until a parent consents', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    const res = await app.inject({ method: 'POST', url: '/api/children', headers: { cookie }, payload: { profile: { name: 'Ava' } } });
    expect(res.statusCode).toBe(403);
    const old = await app.inject({ method: 'POST', url: '/api/consent', headers: { cookie }, payload: { version: 'old', dataProcessing: true, aiTutor: false, research: false } });
    expect(old.statusCode).toBe(400);
  });

  it('keeps each family\'s children private', async () => {
    const { app } = setup();
    const a = await signUp(app, 'a@example.com');
    const b = await signUp(app, 'b@example.com');
    await consent(app, a.cookie);
    await consent(app, b.cookie);
    const child = await addChild(app, a.cookie);
    const asB = await app.inject({ method: 'PUT', url: `/api/children/${child.id}`, headers: { cookie: b.cookie }, payload: { profile: { name: 'X' }, version: 1 } });
    expect(asB.statusCode).toBe(404);
    const list = await app.inject({ method: 'GET', url: '/api/children', headers: { cookie: b.cookie } });
    expect(list.json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/children' })).statusCode).toBe(401);
  });

  it('saves profiles with version checks so devices can\'t overwrite each other', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie);
    const child = await addChild(app, cookie);
    const ok = await app.inject({ method: 'PUT', url: `/api/children/${child.id}`, headers: { cookie }, payload: { profile: { name: 'Ava', year: 6, xp: 10 }, version: 1 } });
    expect(ok.json().version).toBe(2);
    const stale = await app.inject({ method: 'PUT', url: `/api/children/${child.id}`, headers: { cookie }, payload: { profile: { name: 'Ava', xp: 0 }, version: 1 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().profile.xp).toBe(10);
  });
});

describe('answer events and shared question difficulty', () => {
  it('learns question difficulty from answers even without research consent, but stores events only with it', async () => {
    const { db, app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie, false, false);
    const child = await addChild(app, cookie);
    const res = await app.inject({
      method: 'POST', url: `/api/children/${child.id}/events`, headers: { cookie },
      payload: { events: [event(), event({ level: 2, itemKey: 'addition:L2', correct: false, predicted: 0.9 })] },
    });
    expect(res.json()).toEqual({ ok: true, stored: 0 });
    expect((db.prepare('SELECT COUNT(*) n FROM events').get() as { n: number }).n).toBe(0);
    const items = (await app.inject({ method: 'GET', url: '/api/items' })).json();
    expect(items['addition:L2'].offset).toBeGreaterThan(0); // missed when expected to pass → harder
  });

  it('stores Pilot Evidence fields while remaining compatible with legacy minimal events', async () => {
    const { db, app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie, true, true);
    const child = await addChild(app, cookie);

    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${child.id}/events`,
      headers: { cookie },
      payload: {
        events: [
          event(),
          event({
            eventVersion: 1,
            sessionId: 'm-pilot-1',
            sessionPosition: 3,
            missionLength: 8,
            planReason: 'help',
            helpEvent: 'resolved',
            diagnostic: false,
            dueReview: true,
            curriculumId: 'au-ac-v9',
            canonicalNodeId: 'math.fractions.add-subtract-equivalent',
            evidenceStrength: 'direct',
            teacherTargetNodeId: 'math.fractions.add-subtract-equivalent',
            teacherRouteReason: 'target',
            pKnownBefore: 0.72,
            pKnownAfter: 0.84,
            abilityBefore: 0.4,
            abilityAfter: 0.7,
            masteredAfter: false,
          }),
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, stored: 2 });

    const rows = db.prepare(`SELECT event_version, session_id, session_position, mission_length, plan_reason, help_event,
      diagnostic, due_review, curriculum_id, canonical_node_id, evidence_strength,
      teacher_target_node_id, teacher_route_reason, p_known_before, p_known_after,
      ability_before, ability_after, mastered_after
      FROM events ORDER BY id`).all() as Record<string, string | number | null>[];

    expect(rows[0].event_version).toBe(1);
    expect(rows[0].session_id).toBeNull();
    expect(rows[1]).toMatchObject({
      event_version: 1,
      session_id: 'm-pilot-1',
      session_position: 3,
      mission_length: 8,
      plan_reason: 'help',
      help_event: 'resolved',
      diagnostic: 0,
      due_review: 1,
      curriculum_id: 'au-ac-v9',
      canonical_node_id: 'math.fractions.add-subtract-equivalent',
      evidence_strength: 'direct',
      teacher_target_node_id: 'math.fractions.add-subtract-equivalent',
      teacher_route_reason: 'target',
      p_known_before: 0.72,
      p_known_after: 0.84,
      ability_before: 0.4,
      ability_after: 0.7,
      mastered_after: 0,
    });
  });

  it('rejects free-text fields from the research event contract', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie, true, true);
    const child = await addChild(app, cookie);

    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${child.id}/events`,
      headers: { cookie },
      payload: {
        events: [event({ rawAnswer: 'private child answer', teacherNote: 'free text' })],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('stores events with research consent, removes them if consent is withdrawn, and ignores keys from other skills', async () => {
    const { db, app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie, true, true);
    const child = await addChild(app, cookie);
    await app.inject({
      method: 'POST', url: `/api/children/${child.id}/events`, headers: { cookie },
      payload: { events: [event(), event({ itemKey: 'subtraction:L4' })] },
    });
    expect((db.prepare('SELECT COUNT(*) n FROM events').get() as { n: number }).n).toBe(2);
    expect((db.prepare("SELECT COUNT(*) n FROM items WHERE key LIKE 'subtraction%'").get() as { n: number }).n).toBe(0);
    await consent(app, cookie, true, false);
    expect((db.prepare('SELECT COUNT(*) n FROM events').get() as { n: number }).n).toBe(0);
  });

  it('exports structured support and engagement evidence without notes or names', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie, true, true);
    const child = await addChild(app, cookie, 'Zanele');

    const profile = {
      name: 'Zanele',
      year: 6,
      learningIntelligence: {
        schemaVersion: 1,
        curriculum: null,
        supportPreferences: [{
          strategy: 'worked-examples',
          source: 'parent',
          value: 'prefer',
          at: 10,
          note: 'private parent note',
        }],
        supportOutcomes: [{
          strategy: 'worked-examples',
          at: 20,
          delta: 0.9,
          weight: 0.5,
          source: 'observed-learning',
          subject: 'maths',
          skillId: 'fractions-y6',
        }],
        engagement: [{
          kind: 'stopped-session',
          at: 30,
          subject: 'maths',
          skillId: 'fractions-y6',
          value: 4,
        }],
        intents: [],
      },
    };
    const save = await app.inject({
      method: 'PUT',
      url: `/api/children/${child.id}`,
      headers: { cookie },
      payload: { profile, version: 1 },
    });
    expect(save.statusCode).toBe(200);

    for (const path of [
      '/api/admin/support-preferences.csv',
      '/api/admin/support-outcomes.csv',
      '/api/admin/engagement.csv',
    ]) {
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(404);
    }

    const headers = { 'x-admin-token': 'admin-secret' };
    const prefs = (await app.inject({
      method: 'GET', url: '/api/admin/support-preferences.csv', headers,
    })).body;
    const outcomes = (await app.inject({
      method: 'GET', url: '/api/admin/support-outcomes.csv', headers,
    })).body;
    const engagement = (await app.inject({
      method: 'GET', url: '/api/admin/engagement.csv', headers,
    })).body;

    expect(prefs).toContain('worked-examples');
    expect(prefs).toContain('parent');
    expect(prefs).not.toContain('private parent note');
    expect(outcomes).toContain('observed-learning');
    expect(outcomes).toContain('fractions-y6');
    expect(engagement).toContain('stopped-session');

    for (const csv of [prefs, outcomes, engagement]) {
      expect(csv).not.toContain(child.id);
      expect(csv).not.toContain('Zanele');
      expect(csv).not.toContain('parent@example.com');
    }
  });

  it('exports research data pseudonymised, with no names or real ids, and only with the admin token', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    await consent(app, cookie);
    const child = await addChild(app, cookie, 'Zanele');
    await app.inject({
      method: 'POST',
      url: `/api/children/${child.id}/events`,
      headers: { cookie },
      payload: {
        events: [event({
          eventVersion: 1,
          sessionId: 'm-export',
          sessionPosition: 1,
          missionLength: 8,
          planReason: 'continue',
          helpEvent: null,
          diagnostic: true,
          dueReview: false,
          curriculumId: 'au-ac-v9',
          canonicalNodeId: 'math.fractions.add-subtract-equivalent',
          evidenceStrength: 'direct',
          teacherTargetNodeId: 'math.fractions.add-subtract-equivalent',
          teacherRouteReason: 'target',
          pKnownBefore: 0.6,
          pKnownAfter: 0.7,
          abilityBefore: 0.2,
          abilityAfter: 0.4,
          masteredAfter: false,
        })],
      },
    });
    expect((await app.inject({ method: 'GET', url: '/api/admin/events.csv' })).statusCode).toBe(404);
    const csv = (await app.inject({ method: 'GET', url: '/api/admin/events.csv', headers: { 'x-admin-token': 'admin-secret' } })).body;
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv.split('\n')[0]).toContain('session_id');
    expect(csv.split('\n')[0]).toContain('mission_length');
    expect(csv.split('\n')[0]).toContain('canonical_node_id');
    expect(csv.split('\n')[0]).toContain('p_known_before');
    expect(csv).toContain('math.fractions.add-subtract-equivalent');
    expect(csv).not.toContain(child.id);
    expect(csv).not.toContain('Zanele');
    expect(csv).not.toContain('parent@example.com');
  });
});

describe('deletion and retention', () => {
  it('deleting a child or the account removes all their data', async () => {
    const { db, app } = setup(new FakeTutor(['What do the ones add up to?']));
    const { cookie } = await signUp(app);
    await consent(app, cookie);
    const child = await addChild(app, cookie);
    await app.inject({ method: 'POST', url: `/api/children/${child.id}/events`, headers: { cookie }, payload: { events: [event()] } });
    await app.inject({ method: 'POST', url: `/api/children/${child.id}/tutor`, headers: { cookie }, payload: { question, history: [], message: 'help' } });
    await app.inject({ method: 'DELETE', url: `/api/children/${child.id}`, headers: { cookie } });
    for (const t of ['children', 'events', 'tutor_messages']) expect((db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n, t).toBe(0);
    await addChild(app, cookie);
    await app.inject({ method: 'DELETE', url: '/api/account', headers: { cookie } });
    for (const t of ['parents', 'sessions', 'consents', 'children']) expect((db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n, t).toBe(0);
  });

  it('prunes old events and expired sessions', () => {
    const db: DB = openDb(':memory:');
    db.prepare("INSERT INTO parents (id, email, password_hash, created_at) VALUES ('p', 'e@x.co', 'h', 0)").run();
    db.prepare("INSERT INTO children VALUES ('c', 'p', '{}', 1, 0, 0)").run();
    db.prepare("INSERT INTO events (child_id, at, skill_id, level, item_key, correct, hinted, rapid, time_ms, predicted) VALUES ('c', 0, 's', 1, 'k', 1, 0, 0, 1, 0.5)").run();
    db.prepare("INSERT INTO sessions VALUES ('t', 'p', 0, 5)").run();
    pruneOldData(db, 400 * 86_400_000, 365);
    expect((db.prepare('SELECT COUNT(*) n FROM events').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) n FROM sessions').get() as { n: number }).n).toBe(0);
  });
});

describe('AI tutor', () => {
  async function tutorSetup(replies: string[], aiTutor = true, limit = 60) {
    const fake = new FakeTutor(replies);
    const { db, app } = setup(fake, { tutorDailyLimit: limit });
    const { cookie } = await signUp(app);
    await consent(app, cookie, aiTutor, false);
    const child = await addChild(app, cookie);
    const ask = (message: string, given?: string) => app.inject({
      method: 'POST', url: `/api/children/${child.id}/tutor`, headers: { cookie },
      payload: { question, given, history: [], message },
    });
    return { fake, db, app, cookie, child, ask };
  }

  it('is off without credentials, and needs the parent to switch it on', async () => {
    const { app } = setup(null);
    const { cookie } = await signUp(app);
    await consent(app, cookie);
    const child = await addChild(app, cookie);
    const off = await app.inject({ method: 'POST', url: `/api/children/${child.id}/tutor`, headers: { cookie }, payload: { question, history: [], message: 'hi' } });
    expect(off.statusCode).toBe(503);
    const { ask } = await tutorSetup([], false);
    expect((await ask('hi')).statusCode).toBe(403);
  });

  it('passes a good reply through, with the answer kept out of the child\'s view', async () => {
    const { ask, fake } = await tutorSetup(['What do 7 and 8 add up to? What do you do with the tens?']);
    const res = await ask('I got 75', '75');
    expect(res.json()).toEqual({ reply: 'What do 7 and 8 add up to? What do you do with the tens?', flagged: null });
    expect(fake.calls[0].system).toMatch(/Never state the final answer/);
    expect(fake.calls[0].messages[0].content).toContain('Correct answer: 85');
  });

  it('never lets the answer through: retries once, then uses a safe hint', async () => {
    const { ask, fake } = await tutorSetup(['The answer is 85!', 'It is 85, well done.']);
    const res = (await ask('just tell me')).json();
    expect(res.flagged).toBe('answer-leak');
    expect(res.reply).not.toMatch(/\b85\b/);
    expect(fake.calls).toHaveLength(2);
  });

  it('catches wrong sums in replies', async () => {
    const { ask } = await tutorSetup(['Well, 7 + 8 = 16, so carry the 1.', 'Also 7 + 8 = 14.']);
    const res = (await ask('help')).json();
    expect(res.flagged).toBe('wrong-maths');
    expect(findWrongSum('7 + 8 = 15 and 3 × 4 = 12')).toBeNull();
    expect(findWrongSum('12 ÷ 4 = 4')).toBe('12 ÷ 4 = 4');
  });

  it('removes contact details before anything is sent, and logs chats for parents', async () => {
    const { ask, fake, app, cookie, child } = await tutorSetup(['Let\'s look at the ones column.']);
    await ask('my email is kid@example.com and number 07700 900123, see www.site.com');
    const sent = fake.calls[0].messages.at(-1)!.content;
    expect(sent).not.toContain('kid@example.com');
    expect(sent).not.toContain('07700');
    expect(sent).not.toContain('www.site.com');
    expect(scrub('x'.repeat(1000)).length).toBe(400);
    const log = (await app.inject({ method: 'GET', url: `/api/children/${child.id}/tutor`, headers: { cookie } })).json();
    expect(log).toHaveLength(2);
  });

  it('never sends worrying messages to the AI: gives a kind fixed reply and flags it for the parent', async () => {
    const { ask, fake, app, cookie } = await tutorSetup(['What do the ones add up to?']);
    const res = (await ask('i want to hurt myself')).json();
    expect(res.flagged).toBe('safety:wellbeing');
    expect(res.reply).toMatch(/trusted|trust/);
    expect(res.reply).toContain('0800 1111');
    expect(fake.calls).toHaveLength(0);
    expect((await ask('add me on snapchat')).json().flagged).toBe('safety:contact');
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json().safetyFlags).toBe(2);
    // Ordinary maths talk is not flagged.
    const ok = (await ask('I added 7 and 8 and got 15 so I wrote 15')).json();
    expect(ok.flagged).toBeNull();
    expect(fake.calls).toHaveLength(1);
  });

  it('gives the tutor the reading passage from our own content, not from the request', () => {
    const q = { ...question, skillId: 'reading-y6', passageId: 'great-fire', prompt: 'Where did the fire start?', answer: 'In a bakery on Pudding Lane' };
    expect(contextFor({ question: q, history: [], message: 'help' })).toContain('The Great Fire of London');
    expect(contextFor({ question: q, history: [], message: 'help' })).toContain('Thomas Farriner');
    expect(contextFor({ question: { ...q, passageId: 'nope' }, history: [], message: 'help' })).not.toContain('The text the question is about');
  });

  it('tells the model to say it is an AI', async () => {
    const { ask, fake } = await tutorSetup(['Let\'s look at the ones.']);
    await ask('are you a real person?');
    expect(fake.calls[0].system).toMatch(/you are an AI, not a person/);
  });

  it('limits tutor use per day', async () => {
    const { ask } = await tutorSetup([], true, 2);
    expect((await ask('a')).statusCode).toBe(200);
    expect((await ask('b')).statusCode).toBe(200);
    expect((await ask('c')).statusCode).toBe(429);
  });
});

describe('email verification and password reset', () => {
  it('needs a confirmed email before adding a child', async () => {
    const { app, mailer } = setup();
    const { cookie } = await signUp(app, 'new@example.com', false);
    await consent(app, cookie);
    const blocked = await app.inject({ method: 'POST', url: '/api/children', headers: { cookie }, payload: { profile: { name: 'Ava' } } });
    expect(blocked.statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json().emailVerified).toBe(false);
    const token = tokenFrom(mailer.lastLink('new@example.com'));
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } })).statusCode).toBe(400); // single use
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json().emailVerified).toBe(true);
    await addChild(app, cookie);
  });

  it('can resend the verification email', async () => {
    const { app, mailer } = setup();
    const { cookie } = await signUp(app, 'new@example.com', false);
    await app.inject({ method: 'POST', url: '/api/auth/verify/resend', headers: { cookie } });
    expect(mailer.sent.filter((m) => m.to === 'new@example.com')).toHaveLength(2);
  });

  it('forgot-password gives the same answer whether or not the account exists, and only emails real accounts', async () => {
    const { app, mailer } = setup();
    await signUp(app);
    const known = await app.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email: 'parent@example.com' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email: 'nobody@example.com' } });
    expect(known.body).toBe(unknown.body);
    await new Promise((r) => setTimeout(r, 0));
    expect(mailer.sent.some((m) => m.to === 'nobody@example.com')).toBe(false);
    expect(mailer.lastLink('parent@example.com')).toMatch(/^https:\/\/app\.test\/\?reset=/);
  });

  it('resets the password with a single-use link and signs out every other device', async () => {
    const { app, mailer } = setup();
    const { cookie: oldCookie } = await signUp(app);
    await app.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email: 'parent@example.com' } });
    await new Promise((r) => setTimeout(r, 0));
    const token = tokenFrom(mailer.lastLink('parent@example.com'));
    const weak = await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'a brand new password' } });
    expect(res.statusCode).toBe(200);
    expect(res.cookies.some((c) => c.name === 'sz_session')).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: oldCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'another new password' } })).statusCode).toBe(400);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'parent@example.com', password: 'a brand new password' } });
    expect(login.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(mailer.sent.at(-1)!.subject).toMatch(/password was changed/);
  });

  it('reset links expire after an hour', async () => {
    let t = 1_000_000;
    const { app, mailer } = setup(null, { now: () => t });
    await signUp(app);
    await app.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email: 'parent@example.com' } });
    await new Promise((r) => setTimeout(r, 0));
    const token = tokenFrom(mailer.lastLink('parent@example.com'));
    t += 61 * 60_000;
    expect((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'a brand new password' } })).statusCode).toBe(400);
  });

  it('changes the password when signed in, only with the current password', async () => {
    const { app } = setup();
    const { cookie } = await signUp(app);
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/password', headers: { cookie }, payload: { current: 'nope nope nope', password: 'a brand new password' } });
    expect(wrong.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/password', headers: { cookie }, payload: { current: PASSWORD, password: 'a brand new password' } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401); // old session signed out
  });

  it('emails the parent when a chat is flagged, at most once an hour per child', async () => {
    let t = 5_000_000;
    const fake = new FakeTutor([]);
    const { app, mailer } = setup(fake, { now: () => t });
    const { cookie } = await signUp(app);
    await consent(app, cookie);
    const child = await addChild(app, cookie, 'Zola');
    const ask = (message: string) => app.inject({ method: 'POST', url: `/api/children/${child.id}/tutor`, headers: { cookie }, payload: { question, history: [], message } });
    await ask('i want to die');
    await ask('nobody cares about me');
    await new Promise((r) => setTimeout(r, 0));
    const alerts = () => mailer.sent.filter((m) => m.subject.includes('AI tutor chat'));
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].text).toContain('Zola');
    expect(alerts()[0].text).toContain('0800 1111');
    expect(alerts()[0].text).not.toContain('i want to die'); // the message itself isn't put in the email
    t += 61 * 60_000;
    await ask('i want to hurt myself');
    await new Promise((r) => setTimeout(r, 0));
    expect(alerts()).toHaveLength(2);
  });
});

describe('checkpoint export', () => {
  it('exports checkpoint answers pseudonymised, only for research-consented families', async () => {
    const { app } = setup();
    const yes = await signUp(app, 'yes@example.com');
    await consent(app, yes.cookie, false, true);
    const no = await signUp(app, 'no@example.com');
    await consent(app, no.cookie, false, false);
    const checkpoint = { subject: 'maths', form: 'A', at: 1, answers: [{ skillId: 'algebra', level: 2, questionId: 'q', correct: true, timeMs: 900 }] };
    for (const { cookie } of [yes, no]) {
      const child = await addChild(app, cookie, 'Kai');
      await app.inject({ method: 'PUT', url: `/api/children/${child.id}`, headers: { cookie }, payload: { profile: { name: 'Kai', year: 6, checkpoints: [checkpoint] }, version: 1 } });
    }
    expect((await app.inject({ method: 'GET', url: '/api/admin/checkpoints.csv' })).statusCode).toBe(404);
    const csv = (await app.inject({ method: 'GET', url: '/api/admin/checkpoints.csv', headers: { 'x-admin-token': 'admin-secret' } })).body.split('\n');
    expect(csv).toHaveLength(2); // header + one answer, from the consenting family only
    expect(csv[1]).toMatch(/^[0-9a-f]{16},6,maths,A,1,1,algebra,2,1,900$/);
    expect(csv.join('\n')).not.toContain('Kai');
  });
});
