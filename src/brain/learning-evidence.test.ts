import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { recordAnswer } from './tutor';
import { sessionPolicy } from './session-policy';
import type { Question } from './types';

const question: Question = {
  skillId: 'fractions',
  level: 3,
  id: 'fractions:test',
  prompt: 'What is 3/4 of 20?',
  answer: '15',
  explanation: '',
};

describe('recordAnswer learning-support evidence', () => {
  it('records help use while preserving the existing academic learner update', () => {
    const profile = newProfile('Ava', '🦊', 5);
    const result = recordAnswer(profile, question, true, 4000, 1000, {
      given: '15',
      hinted: true,
    });
    expect(result.profile.skills.fractions.attempts).toBe(1);
    expect(result.profile.learningIntelligence?.engagement.some((signal) => signal.kind === 'requested-help')).toBe(true);
    expect(result.profile.learningIntelligence?.supportOutcomes[0]).toMatchObject({
      strategy: 'graduated-hints',
      source: 'observed-learning',
    });
  });
});


describe('session-position learning evidence', () => {
  it('stores where rapid guessing occurs and uses repeated late signals for the next mission policy', () => {
    let profile = newProfile('Ava', '🦊', 5);
    const positions = [7, 8, 8];
    for (let i = 0; i < positions.length; i++) {
      const result = recordAnswer(profile, question, false, 300, 10_000 + i, {
        given: '1',
        sessionPosition: positions[i],
      });
      profile = result.profile;
    }

    const rapid = profile.learningIntelligence?.engagement.filter((signal) => signal.kind === 'rapid-guess') ?? [];
    expect(rapid.map((signal) => signal.value)).toEqual(positions);
    expect(sessionPolicy(profile, 'maths', 10_100)).toMatchObject({
      missionLength: 7,
      source: 'observed-fatigue',
    });
  });
});
