import { describe, expect, it } from 'vitest';
import { initialSkillState } from '../src/brain/model';
import type { Profile } from '../src/brain/types';
import { newProfile } from '../src/storage';
import { ADMIN, setup, THURSDAY } from './testkit';

const mastered = { ...initialSkillState(6, 6), ability: 3, pKnown: 0.99, attempts: 20, correct: 19, masteredAt: 1 };

/** A profile with a mastered skill, a mistake pattern and a stuck episode. */
function busyProfile(name: string): Profile {
  const p = newProfile(name, '🦊', 6);
  return {
    ...p,
    skills: { algebra: mastered },
    misconceptions: { 'add-no-carry': { strength: 0.8, seen: 3, lastSeen: THURSDAY, fixedAt: null, skills: ['addition'] } },
    help: {
      ...p.help,
      episode: {
        skillId: 'fractions-y6', stuckLevel: 3, misconception: null, phase: 'hint', tried: [], helpedBy: null, lastLevel: 2,
        prereqSkill: null, prereqCorrect: 0, prereqWrong: 0, startedAt: THURSDAY - 3600_000, attempts: 2,
      },
    },
    history: [{ at: THURSDAY - 1000, skillId: 'algebra', level: 3, correct: true, timeMs: 5000, predicted: 0.7 }],
  };
}

async function classWith() {
  const t = setup();
  const { id: schoolId, code, teacher } = await t.approvedSchool();
  const sam = await t.pupil(code, 'Sam');
  const ava = await t.pupil(code, 'Ava');
  // Sam's parent saves real progress and shares it; Ava's parent doesn't share.
  await t.app.inject({ method: 'PUT', url: `/api/children/${sam.id}`, headers: { cookie: sam.cookie }, payload: { profile: busyProfile('Sam'), version: 1 } });
  await t.app.inject({ method: 'PATCH', url: `/api/children/${sam.id}/school`, headers: { cookie: sam.cookie }, payload: { shareProgress: true } });
  const view = async (cookie = teacher.cookie) => t.app.inject({ method: 'GET', url: `/api/schools/${schoolId}/class`, headers: { cookie } });
  return { ...t, schoolId, teacher, sam, ava, view };
}

describe('teacher class view', () => {
  it('shows only pupils whose parents chose to share, and nothing private', async () => {
    const { view } = await classWith();
    const res = await view();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ school: { name: 'Oakfield Primary' }, joined: 2, notSharing: 1 });
    expect(body.pupils).toHaveLength(1);
    const sam = body.pupils[0];
    expect(sam).toMatchObject({ name: 'Sam', avatar: '🦊', answeredThisWeek: 1 });
    expect(sam.stuck).toMatchObject({ skill: 'Fractions (Year 6)', level: 3 });
    expect(sam.mistakes).toEqual(['Forgets to carry when adding']);
    expect(sam.skills.algebra).toBe('mastered');
    const text = JSON.stringify(body);
    expect(text).not.toContain('Ava');
    for (const secret of ['history', 'rewards', 'badges', 'tutor', 'email']) expect(text).not.toContain(`"${secret}"`);
  });

  it('adds up the class: skills that need work and common mistakes', async () => {
    const { view } = await classWith();
    const { summary } = (await view()).json();
    const algebra = summary.skills.find((s: { skillId: string }) => s.skillId === 'algebra');
    expect(algebra).toMatchObject({ mastered: 1, learning: 0 });
    expect(summary.mistakes).toEqual([{ name: 'Forgets to carry when adding', pupils: 1 }]);
    expect(summary.skills.every((s: { skillId: string }) => s.skillId)).toBe(true);
  });

  it('only the school\'s own teacher can see it, and stopping sharing hides the pupil straight away', async () => {
    const { app, view, sam, signUp } = await classWith();
    const stranger = await signUp();
    expect((await view(stranger.cookie)).statusCode).toBe(404);
    expect((await view(sam.cookie)).statusCode).toBe(404);
    await app.inject({ method: 'PATCH', url: `/api/children/${sam.id}/school`, headers: { cookie: sam.cookie }, payload: { shareProgress: false } });
    expect((await view()).json().pupils).toEqual([]);
  });

  it('is off until an admin approves the school', async () => {
    const { app, signUp } = setup();
    const teacher = await signUp();
    const { id } = (await app.inject({ method: 'POST', url: '/api/schools', headers: { cookie: teacher.cookie }, payload: { name: 'New School' } })).json();
    expect((await app.inject({ method: 'GET', url: `/api/schools/${id}/class`, headers: { cookie: teacher.cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/admin/schools', headers: ADMIN })).statusCode).toBe(200);
  });
});

describe('homework', () => {
  it('the teacher sets a topic every pupil in the school sees, and can clear it', async () => {
    const { app, schoolId, teacher, ava } = await classWith();
    const set = await app.inject({ method: 'PUT', url: `/api/schools/${schoolId}/homework`, headers: { cookie: teacher.cookie }, payload: { skillId: 'fractions-y6', note: 'Ready for Friday\'s quiz!' } });
    expect(set.statusCode).toBe(200);
    // Ava doesn't share progress, but still sees the homework.
    const seen = (await app.inject({ method: 'GET', url: `/api/children/${ava.id}/school`, headers: { cookie: ava.cookie } })).json();
    expect(seen.homework).toMatchObject({ skillId: 'fractions-y6', note: 'Ready for Friday\'s quiz!' });
    await app.inject({ method: 'DELETE', url: `/api/schools/${schoolId}/homework`, headers: { cookie: teacher.cookie } });
    expect((await app.inject({ method: 'GET', url: `/api/children/${ava.id}/school`, headers: { cookie: ava.cookie } })).json().homework).toBeNull();
  });

  it('the teacher assigns a structured Australian objective with priority and due date', async () => {
    const { app, schoolId, teacher, ava } = await classWith();
    const dueAt = THURSDAY + 2 * 86_400_000;
    const set = await app.inject({
      method: 'PUT',
      url: `/api/schools/${schoolId}/homework`,
      headers: { cookie: teacher.cookie },
      payload: {
        objectiveId: 'au6-fractions-add-subtract',
        note: 'Focus for Friday',
        priority: 1,
        dueAt,
      },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().homework).toMatchObject({
      version: 2,
      objectiveId: 'au6-fractions-add-subtract',
      canonicalNodeId: 'math.fractions.add-subtract-equivalent',
      practiceSkillId: 'fractions-y6',
      priority: 1,
      dueAt,
    });

    // Homework is delivered even when the parent has not opted into teacher progress sharing.
    const seen = (await app.inject({
      method: 'GET',
      url: `/api/children/${ava.id}/school`,
      headers: { cookie: ava.cookie },
    })).json();
    expect(seen.homework).toMatchObject({
      objective: 'Add and subtract fractions using equivalence',
      curriculumRefs: ['au-ac-v9:AC9M6N05'],
    });
  });

  it('rejects unknown structured objectives and invalid due dates', async () => {
    const { app, schoolId, teacher } = await classWith();
    const put = (payload: object) => app.inject({
      method: 'PUT',
      url: `/api/schools/${schoolId}/homework`,
      headers: { cookie: teacher.cookie },
      payload,
    });
    expect((await put({ objectiveId: 'not-real' })).statusCode).toBe(400);
    expect((await put({ objectiveId: 'au5-reading', dueAt: THURSDAY - 86_400_000 })).statusCode).toBe(400);
  });

  it('rejects unknown topics, contact details, links and worrying notes, and other people', async () => {
    const { app, schoolId, teacher, ava } = await classWith();
    const put = (payload: object, cookie = teacher.cookie) => app.inject({ method: 'PUT', url: `/api/schools/${schoolId}/homework`, headers: { cookie }, payload });
    expect((await put({ skillId: 'nope' })).statusCode).toBe(400);
    expect((await put({ skillId: 'algebra', note: 'Email me at miss@example.com' })).statusCode).toBe(400);
    expect((await put({ skillId: 'algebra', note: 'See www.example.com' })).statusCode).toBe(400);
    expect((await put({ skillId: 'algebra', note: 'Don\'t tell your parents about this' })).statusCode).toBe(400);
    expect((await put({ skillId: 'algebra', note: 'x'.repeat(141) })).statusCode).toBe(400);
    expect((await put({ skillId: 'algebra' }, ava.cookie)).statusCode).toBe(404);
    expect((await put({ skillId: 'algebra', note: 'Practise solving for n.' })).statusCode).toBe(200);
  });
});
