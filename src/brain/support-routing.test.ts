import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import {
  emptyLearningIntelligence,
  recordSupportOutcome,
  setSupportPreference,
} from './learning-intelligence';
import {
  ROUTING_MIN_EVIDENCE,
  supportRoutingScore,
} from './support-routing';

describe('confidence-gated support routing', () => {
  it('leaves the existing deterministic score unchanged with no new evidence', () => {
    const profile = newProfile('Ava', '🦊', 5);
    expect(supportRoutingScore(profile, 'worked-example', 0.5)).toMatchObject({
      base: 0.5,
      learnerPreference: 0,
      parentPreference: 0,
      observed: 0,
      total: 0.5,
      observedApplied: false,
    });
  });

  it('uses preferences only as small bounded modifiers', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence ?? emptyLearningIntelligence();
    state = setSupportPreference(state, {
      strategy: 'worked-examples',
      source: 'learner',
      value: 'prefer',
      at: 1,
    });
    state = setSupportPreference(state, {
      strategy: 'worked-examples',
      source: 'parent',
      value: 'prefer',
      at: 2,
    });
    profile.learningIntelligence = state;
    const score = supportRoutingScore(profile, 'worked-example', 0.5);
    expect(score.total).toBeCloseTo(0.56);
    // A stated preference cannot overturn a strategy with a much stronger proven history.
    expect(score.total).toBeLessThan(0.9);
  });

  it('gives the learner voice more weight than a conflicting parent preference', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    state = setSupportPreference(state, {
      strategy: 'graduated-hints',
      source: 'learner',
      value: 'avoid',
      at: 1,
    });
    state = setSupportPreference(state, {
      strategy: 'graduated-hints',
      source: 'parent',
      value: 'prefer',
      at: 2,
    });
    profile.learningIntelligence = state;
    const score = supportRoutingScore(profile, 'hint', 0.5);
    expect(score.learnerPreference).toBeLessThan(0);
    expect(score.parentPreference).toBeGreaterThan(0);
    expect(score.total).toBeLessThan(0.5);
  });

  it('ignores observed support outcomes until repeated evidence crosses the gates', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (let i = 0; i < ROUTING_MIN_EVIDENCE - 1; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: i,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
      });
    }
    profile.learningIntelligence = state;
    const score = supportRoutingScore(profile, 'worked-example', 0.5);
    expect(score.observedEvidenceCount).toBe(ROUTING_MIN_EVIDENCE - 1);
    expect(score.observedApplied).toBe(false);
    expect(score.observed).toBe(0);
  });

  it('allows repeated high-confidence outcomes to break a close tie', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (let i = 0; i < 4; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: i,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
      });
    }
    profile.learningIntelligence = state;
    const worked = supportRoutingScore(profile, 'worked-example', 0.5);
    const similar = supportRoutingScore(profile, 'similar', 0.5);
    expect(worked.observedApplied).toBe(true);
    expect(worked.observed).toBeGreaterThan(0);
    expect(worked.total).toBeGreaterThan(similar.total);
  });

  it('does not hard-ban a strategy the learner prefers not to use', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = setSupportPreference(profile.learningIntelligence!, {
      strategy: 'worked-examples',
      source: 'learner',
      value: 'avoid',
      at: 1,
    });
    const score = supportRoutingScore(profile, 'worked-example', 0.9);
    expect(score.total).toBeGreaterThan(0.8);
  });
});
