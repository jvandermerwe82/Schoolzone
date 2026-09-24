import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { makeQuestion } from '../content';
import { recordAnswer } from './tutor';
import { dayStreak, playerLevel, xpForAnswer, xpForLevel } from './xp';

describe('XP and levels', () => {
  it('rewards unaided correct answers most, and rushed guesses not at all', () => {
    expect(xpForAnswer({ correct: true, hinted: false, rapid: false, level: 3 })).toBe(20);
    expect(xpForAnswer({ correct: true, hinted: true, rapid: false, level: 3 })).toBe(10);
    expect(xpForAnswer({ correct: false, hinted: false, rapid: false, level: 3 })).toBe(1);
    expect(xpForAnswer({ correct: false, hinted: false, rapid: true, level: 5 })).toBe(0);
  });

  it('levels need 100 more XP each time', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(playerLevel(0)).toEqual({ level: 1, into: 0, needed: 100 });
    expect(playerLevel(350)).toEqual({ level: 3, into: 50, needed: 300 });
  });

  it('adds XP to the profile with every answer', () => {
    let s = 1; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const p = newProfile('Ava', '🦊', 6);
    const q = makeQuestion('algebra', 3, [], rng);
    const r = recordAnswer(p, q, true, 20_000, Date.now(), { given: q.answer });
    expect(r.xp).toBeGreaterThanOrEqual(20);
    expect(r.profile.xp).toBe(r.xp);
  });

  it('counts a streak of practice days up to today', () => {
    const day = 86_400_000;
    const now = Date.parse('2026-09-24T18:00:00');
    const p = { ...newProfile('Ava', '🦊', 6), history: [0, 1, 2, 4].map((d) => ({ at: now - d * day, skillId: 'addition', level: 1 as const, correct: true, timeMs: 1, predicted: 0.5 })) };
    expect(dayStreak(p, now)).toBe(3);
    expect(dayStreak({ ...p, history: p.history.slice(1) }, now)).toBe(2); // not yet today: yesterday's streak still counts
    expect(dayStreak({ ...p, history: [] }, now)).toBe(0);
  });
});
