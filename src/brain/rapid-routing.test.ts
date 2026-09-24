import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { nextStrategy } from './help';
import { recordSupportOutcome } from './learning-intelligence';
import { supportRoutingScore } from './support-routing';

const DAY = 86_400_000;

describe('rapid learning routing integration', () => {
  it('uses two strong exact-skill outcomes as a small rapid tie-breaker', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (let i = 0; i < 2; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: 100 + i,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
        subject: 'maths',
        skillId: 'fractions',
      });
    }
    profile.learningIntelligence = state;

    const score = supportRoutingScore(profile, 'worked-example', 0.5, {
      subject: 'maths',
      skillId: 'fractions',
      now: 101,
    });
    expect(score.observedApplied).toBe(true);
    expect(score.observedRapid).toBe(true);
    expect(score.observedExactSkillCount).toBe(2);
    expect(score.observed).toBeGreaterThan(0);
  });

  it('does not fast-track the same observations into an unrelated subject', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    for (let i = 0; i < 2; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: 100 + i,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
        subject: 'english',
        skillId: 'reading-y6',
      });
    }
    profile.learningIntelligence = state;

    const score = supportRoutingScore(profile, 'worked-example', 0.5, {
      subject: 'maths',
      skillId: 'fractions',
      now: 101,
    });
    expect(score.observedRapid).toBe(false);
    expect(score.observedExactSkillCount).toBe(0);
    expect(score.observed).toBe(0);
  });

  it('identifies a strong exact-skill support method within two observations when base history is neutral', () => {
    const profile = newProfile('Ava', '🦊', 5);
    let state = profile.learningIntelligence!;
    state = recordSupportOutcome(state, {
      strategy: 'worked-examples',
      at: 10,
      delta: 1,
      weight: 1,
      source: 'observed-learning',
      subject: 'maths',
      skillId: 'fractions',
    });
    state = recordSupportOutcome(state, {
      strategy: 'worked-examples',
      at: 11,
      delta: 1,
      weight: 1,
      source: 'observed-learning',
      subject: 'maths',
      skillId: 'fractions',
    });
    profile.learningIntelligence = state;

    expect(nextStrategy(profile, {
      skillId: 'fractions',
      stuckLevel: 4,
      tried: [],
    }, 11).strategy).toBe('worked-example');
  });

  it('changes its mind when recent exact-skill evidence contradicts stale history', () => {
    const profile = newProfile('Ava', '🦊', 5);
    const now = 100 * DAY;
    let state = profile.learningIntelligence!;

    // Old history said worked examples were excellent.
    for (let i = 0; i < 5; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: now - (80 + i) * DAY,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
        subject: 'maths',
        skillId: 'fractions',
      });
    }

    // Recent evidence says hints now work and worked examples do not.
    for (let i = 0; i < 2; i++) {
      state = recordSupportOutcome(state, {
        strategy: 'worked-examples',
        at: now - i * 1000,
        delta: -1,
        weight: 1,
        source: 'observed-learning',
        subject: 'maths',
        skillId: 'fractions',
      });
      state = recordSupportOutcome(state, {
        strategy: 'graduated-hints',
        at: now - i * 1000,
        delta: 1,
        weight: 1,
        source: 'observed-learning',
        subject: 'maths',
        skillId: 'fractions',
      });
    }
    profile.learningIntelligence = state;

    expect(nextStrategy(profile, {
      skillId: 'fractions',
      stuckLevel: 4,
      tried: [],
    }, now).strategy).toBe('hint');
  });
});
