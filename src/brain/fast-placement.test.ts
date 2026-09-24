import { describe, expect, it } from 'vitest';
import { initialSkillState } from './model';
import { FAST_PLACEMENT_MAX_ATTEMPTS, planNext } from './tutor';
import { newProfile } from '../storage';
import type { AnswerRecord, Profile } from './types';

const answer = (patch: Partial<AnswerRecord> = {}): AnswerRecord => ({
  at: 1,
  skillId: 'number-sense',
  level: 3,
  correct: true,
  timeMs: 3000,
  predicted: 0.8,
  ...patch,
});

const advanced = (): Profile => {
  const profile = newProfile('Ava', '🦊', 6);
  profile.skills['number-sense'] = {
    ...initialSkillState(6, 1),
    ability: 1.5,
    attempts: 2,
    correct: 2,
    recent: [1, 1],
  };
  profile.history = [answer({ at: 1 }), answer({ at: 2 })];
  return profile;
};

describe('fast academic placement', () => {
  it('stretches one level earlier after two clean early answers', () => {
    const profile = advanced();
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 2 }, 3, () => 0.5);
    expect(plan.skillId).toBe('number-sense');
    expect(plan.level).toBe(4);
    expect(plan.message).toMatch(/what you already know/i);
  });

  it('does not fast-track after a hinted answer', () => {
    const profile = advanced();
    profile.history[1] = answer({ at: 2, hinted: true });
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 2 }, 3, () => 0.5);
    expect(plan.level).toBe(3);
  });

  it('does not fast-track after a rapid guess', () => {
    const profile = advanced();
    profile.history[1] = answer({ at: 2, rapid: true });
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 2 }, 3, () => 0.5);
    expect(plan.level).toBe(3);
  });

  it('turns fast placement off after the initial placement window', () => {
    const profile = advanced();
    profile.skills['number-sense'].attempts = FAST_PLACEMENT_MAX_ATTEMPTS + 1;
    profile.history = [
      answer({ at: 1, correct: false }),
      answer({ at: 2 }),
      answer({ at: 3, hinted: true }),
      answer({ at: 4 }),
      answer({ at: 5 }),
    ];
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 5 }, 6, () => 0.5);
    expect(plan.level).toBe(3);
  });

  it('never stretches when the model thinks the next level is implausible', () => {
    const profile = advanced();
    profile.skills['number-sense'].ability = -3;
    profile.history = [answer({ level: 1, at: 1 }), answer({ level: 1, at: 2 })];
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 2 }, 3, () => 0.5);
    expect(plan.level).toBe(1);
  });
});
