import { describe, expect, it } from 'vitest';
import { guessRate, initialSkillState, predictCorrect } from './model';
import {
  chooseDiagnosticLevel,
  chooseLevel,
  DIAGNOSTIC_MIN_SUCCESS,
  planNext,
} from './tutor';
import { newProfile } from '../storage';
import type { AnswerRecord } from './types';

const information = (p: number) => p * (1 - p);

const answer = (patch: Partial<AnswerRecord> = {}): AnswerRecord => ({
  at: 1,
  skillId: 'number-sense',
  level: 3,
  correct: true,
  timeMs: 3000,
  predicted: 0.8,
  ...patch,
});

describe('information-efficient early diagnosis', () => {
  it('chooses a more informative safe probe for an older learner confirming a foundation skill', () => {
    const state = initialSkillState(6, 1); // ability prior is capped at +1.5
    const normal = chooseLevel(state, 0.8);
    const diagnostic = chooseDiagnosticLevel(state);
    const pNormal = predictCorrect(state.ability, normal, guessRate(normal));
    const pDiagnostic = predictCorrect(state.ability, diagnostic, guessRate(diagnostic));

    expect(diagnostic).toBeGreaterThan(normal);
    expect(pDiagnostic).toBeGreaterThanOrEqual(DIAGNOSTIC_MIN_SUCCESS);
    expect(information(pDiagnostic)).toBeGreaterThan(information(pNormal));
  });

  it('keeps a same-year learner inside the safe diagnostic probability band', () => {
    const state = initialSkillState(6, 6);
    const level = chooseDiagnosticLevel(state);
    const predicted = predictCorrect(state.ability, level, guessRate(level));
    expect(predicted).toBeGreaterThanOrEqual(DIAGNOSTIC_MIN_SUCCESS);
    expect(predicted).toBeLessThanOrEqual(0.85);
  });

  it('marks an older learner confirming a foundation skill as diagnostic', () => {
    const profile = newProfile('Ava', '🦊', 6);
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 0 }, 0, () => 0.5);
    expect(plan.skillId).toBe('number-sense');
    expect(plan.diagnostic).toBe(true);
    expect(plan.message).toMatch(/best starting point/i);
  });

  it('does not probe aggressively when the prior ability is not already strong', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['number-sense'] = {
      ...initialSkillState(6, 1),
      ability: 0.5,
    };
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 0 }, 0, () => 0.5);
    expect(plan.diagnostic).not.toBe(true);
  });

  it('stops diagnostic probing immediately after hinted evidence', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['number-sense'] = {
      ...initialSkillState(6, 1),
      attempts: 1,
      correct: 1,
      recent: [0.5],
    };
    profile.history = [answer({ hinted: true })];
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 1 }, 2, () => 0.5);
    expect(plan.diagnostic).not.toBe(true);
  });

  it('stops diagnostic probing after a rapid guess', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.skills['number-sense'] = {
      ...initialSkillState(6, 1),
      attempts: 1,
      correct: 0,
      recent: [0],
    };
    profile.history = [answer({ correct: false, rapid: true })];
    const plan = planNext(profile, 'maths', { focus: 'number-sense', answered: 1 }, 2, () => 0.5);
    expect(plan.diagnostic).not.toBe(true);
  });

  it('never uses diagnostic probing inside a curriculum-locked teacher route', () => {
    const profile = newProfile('Ava', '🦊', 6);
    const plan = planNext(
      profile,
      'maths',
      {
        focus: 'fractions-y6',
        answered: 0,
        allowedLevels: [2],
        strictFocus: true,
      },
      0,
      () => 0.5,
    );
    expect(plan.level).toBe(2);
    expect(plan.diagnostic).not.toBe(true);
  });
});
