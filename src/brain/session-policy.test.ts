import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { recordEngagementSignal, setSupportPreference } from './learning-intelligence';
import {
  DEFAULT_MISSION_LENGTH,
  sessionPolicy,
} from './session-policy';

const NOW = 100 * 86_400_000;

describe('adaptive session policy', () => {
  it('defaults to 10 questions without evidence', () => {
    expect(sessionPolicy(newProfile('Ava', '🦊', 5), 'maths', NOW)).toMatchObject({
      missionLength: DEFAULT_MISSION_LENGTH,
      source: 'default',
    });
  });

  it('applies the learner shorter-mission preference immediately', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = setSupportPreference(profile.learningIntelligence!, {
      strategy: 'shorter-missions',
      source: 'learner',
      value: 'prefer',
      at: NOW,
    });
    expect(sessionPolicy(profile, 'maths', NOW)).toMatchObject({
      missionLength: 6,
      source: 'learner-preference',
    });
  });

  it('gives learner preference priority over a conflicting parent preference', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    state = setSupportPreference(state, {
      strategy: 'shorter-missions',
      source: 'parent',
      value: 'prefer',
      at: NOW,
    });
    state = setSupportPreference(state, {
      strategy: 'shorter-missions',
      source: 'learner',
      value: 'avoid',
      at: NOW,
    });
    profile.learningIntelligence = state;
    expect(sessionPolicy(profile, 'maths', NOW).missionLength).toBe(10);
  });

  it('learns a shorter same-subject mission from repeated early stops', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (const [i, position] of [5, 6, 5].entries()) {
      state = recordEngagementSignal(state, {
        kind: 'stopped-session',
        at: NOW - i * 1000,
        subject: 'maths',
        value: position,
      });
    }
    profile.learningIntelligence = state;
    expect(sessionPolicy(profile, 'maths', NOW)).toMatchObject({
      missionLength: 5,
      source: 'observed-fatigue',
    });
  });

  it('learns a shorter mission when rapid guesses repeatedly appear late', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (const [i, position] of [8, 8, 7].entries()) {
      state = recordEngagementSignal(state, {
        kind: 'rapid-guess',
        at: NOW - i * 1000,
        subject: 'maths',
        value: position,
      });
    }
    profile.learningIntelligence = state;
    expect(sessionPolicy(profile, 'maths', NOW)).toMatchObject({
      missionLength: 7,
      source: 'observed-fatigue',
    });
  });

  it('does not shorten maths because of English-only fatigue evidence', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (const [i, position] of [5, 5, 6].entries()) {
      state = recordEngagementSignal(state, {
        kind: 'stopped-session',
        at: NOW - i * 1000,
        subject: 'english',
        value: position,
      });
    }
    profile.learningIntelligence = state;
    expect(sessionPolicy(profile, 'maths', NOW).missionLength).toBe(10);
  });

  it('ignores stale engagement signals', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (let i = 0; i < 4; i++) {
      state = recordEngagementSignal(state, {
        kind: 'stopped-session',
        at: NOW - 100 * 86_400_000,
        subject: 'maths',
        value: 5,
      });
    }
    profile.learningIntelligence = state;
    expect(sessionPolicy(profile, 'maths', NOW).missionLength).toBe(10);
  });
});
