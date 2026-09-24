import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import {
  preferredAcademicSupport,
  setPreferredAcademicSupport,
  shouldPromptLearnerSupportPrior,
} from './QuickSupportPrior';
import { recordSupportOutcome, setSupportPreference, supportPreference } from '../brain/learning-intelligence';

describe('quick academic support prior', () => {
  it('keeps learner and parent starting clues separate', () => {
    let profile = newProfile('Ava', '🦊', 5);
    profile = setPreferredAcademicSupport(profile, 'learner', 'worked-examples', 1);
    profile = setPreferredAcademicSupport(profile, 'parent', 'smaller-steps', 2);

    expect(preferredAcademicSupport(profile, 'learner')).toBe('worked-examples');
    expect(preferredAcademicSupport(profile, 'parent')).toBe('smaller-steps');
  });

  it('shows the learner prompt only during the early learning window', () => {
    const profile = newProfile('Ava', '🦊', 5);
    expect(shouldPromptLearnerSupportPrior(profile)).toBe(true);

    const withPrior = setPreferredAcademicSupport(profile, 'learner', 'worked-examples', 1);
    expect(shouldPromptLearnerSupportPrior(withPrior)).toBe(false);

    const experienced = {
      ...profile,
      history: Array.from({ length: 10 }, (_, i) => ({
        at: i,
        skillId: 'number-sense',
        level: 1 as const,
        correct: true,
        timeMs: 1000,
        predicted: 0.8,
      })),
    };
    expect(shouldPromptLearnerSupportPrior(experienced)).toBe(false);
  });

  it('replaces only the same source positive prior', () => {
    let profile = newProfile('Ava', '🦊', 5);
    profile = setPreferredAcademicSupport(profile, 'learner', 'worked-examples', 1);
    profile = setPreferredAcademicSupport(profile, 'learner', 'graduated-hints', 2);

    expect(preferredAcademicSupport(profile, 'learner')).toBe('graduated-hints');
    expect(supportPreference(profile.learningIntelligence!, 'worked-examples', 'learner')).toBeNull();
  });

  it('preserves explicit avoid preferences and measured outcomes', () => {
    let profile = newProfile('Ava', '🦊', 5);
    let state = setSupportPreference(profile.learningIntelligence!, {
      strategy: 'smaller-steps',
      source: 'learner',
      value: 'avoid',
      at: 1,
    });
    state = recordSupportOutcome(state, {
      strategy: 'worked-examples',
      at: 2,
      delta: 0.9,
      weight: 0.5,
      source: 'observed-learning',
    });
    profile = { ...profile, learningIntelligence: state };

    profile = setPreferredAcademicSupport(profile, 'learner', 'worked-examples', 3);

    expect(supportPreference(profile.learningIntelligence!, 'smaller-steps', 'learner')?.value).toBe('avoid');
    expect(profile.learningIntelligence?.supportOutcomes).toHaveLength(1);
  });

  it('allows not sure without erasing measured evidence', () => {
    let profile = newProfile('Ava', '🦊', 5);
    profile = setPreferredAcademicSupport(profile, 'parent', 'worked-examples', 1);
    profile.learningIntelligence = recordSupportOutcome(profile.learningIntelligence!, {
      strategy: 'worked-examples',
      at: 2,
      delta: 1,
      weight: 1,
      source: 'observed-learning',
    });

    profile = setPreferredAcademicSupport(profile, 'parent', null, 3);
    expect(preferredAcademicSupport(profile, 'parent')).toBeNull();
    expect(profile.learningIntelligence?.supportOutcomes).toHaveLength(1);
  });
});
