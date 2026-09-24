import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { initialSkillState } from './model';
import { planNext } from './tutor';

describe('curriculum-locked practice planning', () => {
  it('serves only the verified levels for a structured teacher objective', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['fractions-y6'] = {
      ...initialSkillState(6, 6),
      ability: 4,
      attempts: 10,
      correct: 10,
      recent: [1, 1, 1, 1],
    };
    const plan = planNext(
      profile,
      'maths',
      {
        focus: 'fractions-y6',
        answered: 0,
        allowedLevels: [2],
        strictFocus: true,
      },
      100,
      () => 0.5,
    );
    expect(plan.skillId).toBe('fractions-y6');
    expect(plan.level).toBe(2);
  });

  it('does not stretch outside a verified curriculum route even after a clean run', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['fractions-y6'] = {
      ...initialSkillState(6, 6),
      ability: 4,
      attempts: 4,
      correct: 4,
      recent: [1, 1, 1, 1],
    };
    profile.history = Array.from({ length: 4 }, (_, i) => ({
      at: i,
      skillId: 'fractions-y6',
      level: 2 as const,
      correct: true,
      timeMs: 3000,
      predicted: 0.9,
    }));

    const plan = planNext(
      profile,
      'maths',
      {
        focus: 'fractions-y6',
        answered: 4,
        allowedLevels: [2],
        strictFocus: true,
      },
      100,
      () => 0.5,
    );
    expect(plan.level).toBe(2);
  });

  it('keeps a strict teacher route on focus instead of inserting an unrelated spaced review', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['number-sense'] = {
      ...initialSkillState(6, 1),
      pKnown: 0.99,
      ability: 3,
      attempts: 20,
      correct: 20,
      masteredAt: 1,
      nextReviewAt: 1,
    };

    const plan = planNext(
      profile,
      'maths',
      {
        focus: 'fractions-y6',
        answered: 3,
        allowedLevels: [2, 3],
        strictFocus: true,
      },
      100,
      () => 0.5,
    );
    expect(plan.skillId).toBe('fractions-y6');
    expect([2, 3]).toContain(plan.level);
  });
});
