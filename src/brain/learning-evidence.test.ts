import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { recordAnswer } from './tutor';
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
