/** Shared setup for server tests: families, schools and answers, against an in-memory database. */
import { expect } from 'vitest';
import { buildApp, CONSENT_VERSION } from './app';
import { openDb } from './db';
import { MemoryMailer } from './mailer';

export const PASSWORD = 'correct horse battery';
export const ADMIN = { 'x-admin-token': 'admin-secret' };
// Thursday 24 September 2026, midday UK time (BST, UTC+1).
export const THURSDAY = Date.UTC(2026, 8, 24, 11);

export function setup() {
  const db = openDb(':memory:');
  const mailer = new MemoryMailer();
  const clock = { t: THURSDAY };
  const app = buildApp({ db, mailer, adminToken: 'admin-secret', adminEmail: 'admin@schoolzone.test', appUrl: 'https://app.test', now: () => clock.t });
  let n = 0;

  const signUp = async (email = `parent${++n}@example.com`) => {
    // A different address per family, as in real life (sign-ups are rate-limited per address).
    const res = await app.inject({ method: 'POST', url: '/api/auth/signup', remoteAddress: `10.0.0.${n}`, payload: { email, password: PASSWORD } });
    const cookie = `sz_session=${res.cookies.find((c) => c.name === 'sz_session')!.value}`;
    const token = new URL(mailer.lastLink(email)!).searchParams.get('verify')!;
    await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
    await app.inject({ method: 'POST', url: '/api/consent', headers: { cookie }, payload: { version: CONSENT_VERSION, dataProcessing: true, aiTutor: false, research: false } });
    return { cookie, email };
  };
  const addChild = async (cookie: string, name: string, xp = 0) => {
    const res = await app.inject({ method: 'POST', url: '/api/children', headers: { cookie }, payload: { profile: { name, year: 6, avatar: '🦊', xp } } });
    return (res.json() as { id: string }).id;
  };
  /** A teacher registers a school and an admin approves it. Returns the join code. */
  const approvedSchool = async (name = 'Oakfield Primary') => {
    const teacher = await signUp();
    const res = await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie: teacher.cookie }, payload: { name } });
    const { id } = res.json() as { id: string };
    await app.inject({ method: 'POST', url: `/api/admin/schools/${id}/approve`, headers: ADMIN });
    const list = (await app.inject({ method: 'GET', url: '/api/schools', headers: { cookie: teacher.cookie } })).json() as { joinCode: string }[];
    return { id, code: list[0].joinCode, teacher };
  };
  const join = (cookie: string, childId: string, code: string) =>
    app.inject({ method: 'POST', url: `/api/children/${childId}/school`, headers: { cookie }, payload: { code } });
  const answers = (cookie: string, childId: string, n: number, over: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST', url: `/api/children/${childId}/events`, headers: { cookie },
      payload: {
        events: Array.from({ length: n }, () => ({
          at: 1, skillId: 'addition', level: 4, itemKey: 'addition:L4', correct: true, hinted: false, rapid: false,
          timeMs: 5000, predicted: 0.8, misconception: null, strategy: null, ...over,
        })),
      },
    });
  const board = async (cookie: string, childId: string, period = 'week') =>
    (await app.inject({ method: 'GET', url: `/api/children/${childId}/leaderboard?period=${period}`, headers: { cookie } })).json();
  /** A family with one child in the school, optionally shown on the pupil board. */
  const pupil = async (code: string, name: string, onBoard = false, xp = 0) => {
    const { cookie } = await signUp();
    const id = await addChild(cookie, name, xp);
    expect((await join(cookie, id, code)).statusCode).toBe(201);
    if (onBoard) await app.inject({ method: 'PATCH', url: `/api/children/${id}/school`, headers: { cookie }, payload: { onBoard: true } });
    return { cookie, id };
  };
  return { db, app, mailer, clock, signUp, addChild, approvedSchool, join, answers, board, pupil };
}

