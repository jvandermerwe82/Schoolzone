import { describe, expect, it } from 'vitest';
import { pruneOldData } from './db';
import { DAILY_POINTS_CAP, londonDay, MIN_SCHOOL_PUPILS, pointsFor, rank, weekStart } from './leaderboard';
import { ADMIN, PASSWORD, setup } from './testkit';

describe('scoring rules', () => {
  it('rewards effort: correct 10, with a hint 5, a real try 2, a rushed guess 0', () => {
    expect(pointsFor({ correct: true, hinted: false, rapid: false })).toBe(10);
    expect(pointsFor({ correct: true, hinted: true, rapid: false })).toBe(5);
    expect(pointsFor({ correct: false, hinted: false, rapid: false })).toBe(2);
    expect(pointsFor({ correct: true, hinted: false, rapid: true })).toBe(0);
  });

  it('ranks ties equally', () => {
    expect(rank([{ score: 5 }, { score: 9 }, { score: 9 }, { score: 1 }]).map((r) => r.rank)).toEqual([1, 1, 3, 4]);
  });

  it('uses UK dates, with weeks starting on Monday', () => {
    expect(londonDay(Date.UTC(2026, 8, 23, 23, 30))).toBe('2026-09-24'); // 00:30 BST
    expect(londonDay(Date.UTC(2026, 11, 31, 23, 30))).toBe('2026-12-31'); // GMT in winter
    expect(weekStart('2026-09-24')).toBe('2026-09-21');
    expect(weekStart('2026-09-21')).toBe('2026-09-21');
    expect(weekStart('2026-09-27')).toBe('2026-09-21');
  });
});

describe('schools', () => {
  it('only go live after an admin approves them; the code is hidden until then', async () => {
    const { app, db, mailer, signUp, addChild, join } = setup();
    const teacher = await signUp('teacher@oakfield.sch.uk');
    const res = await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie: teacher.cookie }, payload: { name: '  Oakfield   Primary ' } });
    expect(res.statusCode).toBe(201);
    const { id } = res.json() as { id: string };
    expect(mailer.sent.at(-1)).toMatchObject({ to: 'admin@schoolzone.test' });
    expect(mailer.sent.at(-1)!.text).toContain('teacher@oakfield.sch.uk');

    let mine = (await app.inject({ method: 'GET', url: '/api/schools', headers: { cookie: teacher.cookie } })).json();
    expect(mine).toEqual([{ id, name: 'Oakfield Primary', status: 'pending', pupils: 0, joinCode: null }]);
    const { join_code: code } = db.prepare('SELECT join_code FROM schools WHERE id = ?').get(id) as { join_code: string };
    const parent = await signUp();
    const child = await addChild(parent.cookie, 'Ava');
    expect((await join(parent.cookie, child, code)).statusCode).toBe(404);

    expect((await app.inject({ method: 'GET', url: '/api/admin/schools' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/admin/schools/${id}/approve`, headers: { 'x-admin-token': 'wrong' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/admin/schools/${id}/approve`, headers: ADMIN })).statusCode).toBe(200);
    expect(mailer.sent.at(-1)).toMatchObject({ to: 'teacher@oakfield.sch.uk' });

    mine = (await app.inject({ method: 'GET', url: '/api/schools', headers: { cookie: teacher.cookie } })).json();
    expect(mine[0].joinCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    // Codes work in any case, with or without the dash.
    expect((await join(parent.cookie, child, mine[0].joinCode.toLowerCase().replace('-', ' '))).statusCode).toBe(201);
  });

  it('need a confirmed email and a real name, and a teacher can register at most three', async () => {
    const { app, signUp } = setup();
    const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'new@example.com', password: PASSWORD } });
    const unverified = `sz_session=${res.cookies.find((c) => c.name === 'sz_session')!.value}`;
    expect((await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie: unverified }, payload: { name: 'Oakfield' } })).statusCode).toBe(403);
    const { cookie } = await signUp();
    expect((await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie }, payload: { name: ' x ' } })).statusCode).toBe(400);
    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie }, payload: { name: `School ${i}` } })).statusCode).toBe(201);
    }
    expect((await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie }, payload: { name: 'School 4' } })).statusCode).toBe(429);
  });

  it('a new join code stops the old one working, but pupils who joined stay in', async () => {
    const { app, approvedSchool, pupil, signUp, addChild, join } = setup();
    const { id, code, teacher } = await approvedSchool();
    const kid = await pupil(code, 'Ava');
    const res = await app.inject({ method: 'POST', url: `/api/schools/${id}/code`, headers: { cookie: teacher.cookie } });
    const fresh = (res.json() as { joinCode: string }).joinCode;
    expect(fresh).not.toBe(code);
    const other = await signUp();
    const child = await addChild(other.cookie, 'Ben');
    expect((await join(other.cookie, child, code)).statusCode).toBe(404);
    expect((await join(other.cookie, child, fresh)).statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: `/api/children/${kid.id}/school`, headers: { cookie: kid.cookie } })).json())
      .toMatchObject({ school: { name: 'Oakfield Primary' } });
    // Only the teacher who registered it can change the code.
    expect((await app.inject({ method: 'POST', url: `/api/schools/${id}/code`, headers: { cookie: other.cookie } })).statusCode).toBe(404);
  });
});

describe('points', () => {
  it('are counted by the server, only for children in a school, and capped per day', async () => {
    const { answers, board, approvedSchool, pupil, signUp, addChild, db } = setup();
    const { code } = await approvedSchool();
    const outsider = await signUp();
    const lone = await addChild(outsider.cookie, 'Zed');
    await answers(outsider.cookie, lone, 5);
    expect(db.prepare('SELECT COUNT(*) AS n FROM points').get()).toEqual({ n: 0 });

    const kid = await pupil(code, 'Ava', true);
    await answers(kid.cookie, kid.id, 3); // 30
    await answers(kid.cookie, kid.id, 2, { correct: false }); // 4
    await answers(kid.cookie, kid.id, 2, { rapid: true }); // 0
    await answers(kid.cookie, kid.id, 2, { hinted: true }); // 10
    expect((await board(kid.cookie, kid.id)).me.score).toBe(44);
    await answers(kid.cookie, kid.id, 100);
    expect((await board(kid.cookie, kid.id)).me.score).toBe(DAILY_POINTS_CAP);
  });

  it('start again each week (Monday, UK time)', async () => {
    const { answers, board, approvedSchool, pupil, clock } = setup();
    const { code } = await approvedSchool();
    const kid = await pupil(code, 'Ava', true);
    await answers(kid.cookie, kid.id, 5);
    clock.t = Date.UTC(2026, 8, 27, 22); // Sunday 11pm BST: same week
    await answers(kid.cookie, kid.id, 1);
    expect((await board(kid.cookie, kid.id)).me.score).toBe(60);
    clock.t = Date.UTC(2026, 8, 27, 23, 30); // Monday 00:30 BST: new week
    const b = await board(kid.cookie, kid.id);
    expect(b.weekStart).toBe('2026-09-28');
    expect(b.me.score).toBe(0);
  });

  it('old weekly points are pruned', async () => {
    const { answers, approvedSchool, pupil, clock, db } = setup();
    const { code } = await approvedSchool();
    const kid = await pupil(code, 'Ava');
    await answers(kid.cookie, kid.id, 1);
    pruneOldData(db, clock.t + 30 * 86_400_000, 365);
    expect(db.prepare('SELECT COUNT(*) AS n FROM points').get()).toEqual({ n: 0 });
  });
});

describe('leaderboards', () => {
  it('never show real names; pupils appear only when a parent switches it on', async () => {
    const { app, answers, board, approvedSchool, pupil } = setup();
    const { code } = await approvedSchool();
    const ava = await pupil(code, 'Ava');
    const ben = await pupil(code, 'Ben', true);
    await answers(ava.cookie, ava.id, 3);
    await answers(ben.cookie, ben.id, 2);

    let b = await board(ava.cookie, ava.id);
    expect(b.me.onBoard).toBe(false);
    expect(b.me.score).toBe(30);
    expect(b.pupils).toHaveLength(1);
    expect(b.pupils[0]).toMatchObject({ rank: 1, score: 20, me: false, avatar: '🦊' });
    expect(b.pupils[0].codeName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+/);
    expect(JSON.stringify(b)).not.toMatch(/Ava|Ben/);

    await app.inject({ method: 'PATCH', url: `/api/children/${ava.id}/school`, headers: { cookie: ava.cookie }, payload: { onBoard: true } });
    b = await board(ava.cookie, ava.id);
    expect(b.pupils.map((p: { me: boolean; rank: number }) => [p.rank, p.me])).toEqual([[1, true], [2, false]]);
    expect(b.me.rank).toBe(1);
    expect(JSON.stringify(b)).not.toMatch(/Ava|Ben/);
  });

  it('a parent can pick a new code name; code names are unique in a school', async () => {
    const { app, approvedSchool, pupil } = setup();
    const { code } = await approvedSchool();
    const kid = await pupil(code, 'Ava');
    const before = (await app.inject({ method: 'GET', url: `/api/children/${kid.id}/school`, headers: { cookie: kid.cookie } })).json().codeName;
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) {
      const res = await app.inject({ method: 'PATCH', url: `/api/children/${kid.id}/school`, headers: { cookie: kid.cookie }, payload: { newCodeName: true } });
      changed = res.json().codeName !== before;
    }
    expect(changed).toBe(true);
  });

  it(`schools appear only with at least ${MIN_SCHOOL_PUPILS} pupils, ranked by average points per pupil`, async () => {
    const { answers, board, approvedSchool, pupil } = setup();
    const big = await approvedSchool('Big School');
    const small = await approvedSchool('Small School');
    const bigKids = [];
    for (let i = 0; i < MIN_SCHOOL_PUPILS; i++) bigKids.push(await pupil(big.code, `B${i}`));
    for (const [i, k] of bigKids.entries()) await answers(k.cookie, k.id, i + 1); // 10..50, average 30
    const lonely = await pupil(small.code, 'S0');
    await answers(lonely.cookie, lonely.id, 20);

    const b = await board(lonely.cookie, lonely.id);
    expect(b.schools).toEqual([{ name: 'Big School', pupils: 5, score: 30, rank: 1, mine: false }]);
    expect(b.school).toMatchObject({ name: 'Small School', pupils: 1, rank: null, score: null, minPupils: MIN_SCHOOL_PUPILS });
    const fromBig = await board(bigKids[0].cookie, bigKids[0].id);
    expect(fromBig.schools[0].mine).toBe(true);
    expect(fromBig.school.rank).toBe(1);
  });

  it('all time ranks XP', async () => {
    const { board, approvedSchool, pupil } = setup();
    const { code } = await approvedSchool();
    const a = await pupil(code, 'Ava', true, 500);
    await pupil(code, 'Ben', true, 900);
    const b = await board(a.cookie, a.id, 'all');
    expect(b.pupils.map((p: { score: number }) => p.score)).toEqual([900, 500]);
    expect(b.me).toMatchObject({ score: 500, rank: 2 });
  });

  it('a child not in a school still sees the school board, and families can\'t see each other\'s children', async () => {
    const { app, board, signUp, addChild, approvedSchool, pupil } = setup();
    const { code } = await approvedSchool();
    const kid = await pupil(code, 'Ava');
    const other = await signUp();
    const lone = await addChild(other.cookie, 'Zed');
    expect(await board(other.cookie, lone)).toMatchObject({ school: null, schools: [] });
    expect((await app.inject({ method: 'GET', url: `/api/children/${kid.id}/leaderboard`, headers: { cookie: other.cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/children/${kid.id}/school`, headers: { cookie: other.cookie }, payload: { code } })).statusCode).toBe(404);
  });

  it('leaving a school, or deleting the child, removes their membership and points', async () => {
    const { app, db, answers, approvedSchool, pupil } = setup();
    const { code } = await approvedSchool();
    const a = await pupil(code, 'Ava');
    const b = await pupil(code, 'Ben');
    await answers(a.cookie, a.id, 1);
    await answers(b.cookie, b.id, 1);
    await app.inject({ method: 'DELETE', url: `/api/children/${a.id}/school`, headers: { cookie: a.cookie } });
    await app.inject({ method: 'DELETE', url: `/api/children/${b.id}`, headers: { cookie: b.cookie } });
    expect(db.prepare('SELECT COUNT(*) AS n FROM memberships').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM points').get()).toEqual({ n: 0 });
  });

  it('limits join-code guessing', async () => {
    const { join, signUp, addChild } = setup();
    const { cookie } = await signUp();
    const id = await addChild(cookie, 'Ava');
    for (let i = 0; i < 10; i++) expect((await join(cookie, id, 'AAAA-AAAA')).statusCode).toBe(404);
    expect((await join(cookie, id, 'AAAA-AAAA')).statusCode).toBe(429);
  });
});
