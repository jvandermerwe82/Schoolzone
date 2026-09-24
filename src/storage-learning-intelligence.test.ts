import { describe, expect, it } from 'vitest';
import { newProfile, normalizeProfile } from './storage';

describe('learning intelligence profile migration', () => {
  it('adds an empty v1 intelligence state to old profiles without changing academic history', () => {
    const old = {
      id: 'old-child',
      name: 'Sam',
      avatar: '🦊',
      year: 5,
      createdAt: 1,
      history: [{ at: 2, skillId: 'fractions', level: 3 as const, correct: true, timeMs: 1000, predicted: 0.7 }],
      skills: {},
    };
    const migrated = normalizeProfile(old);
    expect(migrated.history).toEqual(old.history);
    expect(migrated.learningIntelligence).toEqual({
      schemaVersion: 1,
      curriculum: null,
      supportPreferences: [],
      supportOutcomes: [],
      engagement: [],
      intents: [],
    });
  });

  it('new profiles start without invented curriculum, support or engagement claims', () => {
    const profile = newProfile('Ava', '🦊', 5);
    expect(profile.learningIntelligence).toEqual({
      schemaVersion: 1,
      curriculum: null,
      supportPreferences: [],
      supportOutcomes: [],
      engagement: [],
      intents: [],
    });
  });

  it('preserves an existing intelligence state during normalisation', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = {
      ...profile.learningIntelligence!,
      curriculum: { jurisdiction: 'AU', curriculumId: 'au-ac-v9', curriculumVersion: '9.0', yearLevel: '5' },
      supportPreferences: [{
        strategy: 'read-aloud',
        source: 'learner',
        value: 'prefer',
        at: 10,
      }],
    };
    expect(normalizeProfile(profile).learningIntelligence).toEqual(profile.learningIntelligence);
  });
});
