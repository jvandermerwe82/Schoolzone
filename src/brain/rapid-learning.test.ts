import { describe, expect, it } from 'vitest';
import type { SupportOutcome } from './learning-intelligence';
import {
  contextualSupportSummary,
  RAPID_EXACT_MIN_COUNT,
  SUPPORT_RECENCY_HALF_LIFE_DAYS,
} from './rapid-learning';

const DAY = 86_400_000;

const outcome = (
  delta: number,
  at: number,
  subject = 'maths',
  skillId = 'fractions',
): SupportOutcome => ({
  strategy: 'worked-examples',
  at,
  delta,
  weight: 1,
  source: 'observed-learning',
  subject,
  skillId,
});

describe('rapid contextual support learning', () => {
  it('can learn an exact-skill support pattern after two strong observations', () => {
    const outcomes = [
      outcome(1, 10),
      outcome(0.9, 20),
    ];
    const summary = contextualSupportSummary(outcomes, 'worked-examples', {
      subject: 'maths',
      skillId: 'fractions',
      now: 20,
    });
    expect(summary.exactSkillCount).toBe(RAPID_EXACT_MIN_COUNT);
    expect(summary.rapidEligible).toBe(true);
    expect(summary.score).toBeGreaterThan(0.9);
  });

  it('does not fast-track two observations from another subject', () => {
    const outcomes = [
      outcome(1, 10, 'english', 'reading-y6'),
      outcome(1, 20, 'english', 'reading-y6'),
    ];
    const summary = contextualSupportSummary(outcomes, 'worked-examples', {
      subject: 'maths',
      skillId: 'fractions',
      now: 20,
    });
    expect(summary.exactSkillCount).toBe(0);
    expect(summary.rapidEligible).toBe(false);
    expect(summary.effectiveWeight).toBeLessThan(0.3);
  });

  it('lets recent evidence overturn stale evidence when the learner changes', () => {
    const now = 100 * DAY;
    const old = [
      outcome(1, now - 5 * SUPPORT_RECENCY_HALF_LIFE_DAYS * DAY),
      outcome(1, now - 4 * SUPPORT_RECENCY_HALF_LIFE_DAYS * DAY),
      outcome(1, now - 4 * SUPPORT_RECENCY_HALF_LIFE_DAYS * DAY),
    ];
    const recent = [
      outcome(-1, now - DAY),
      outcome(-1, now),
    ];
    const summary = contextualSupportSummary([...old, ...recent], 'worked-examples', {
      subject: 'maths',
      skillId: 'fractions',
      now,
    });
    expect(summary.score).toBeLessThan(-0.7);
    expect(summary.rapidEligible).toBe(true);
  });

  it('transfers same-subject evidence more strongly than unrelated-subject evidence', () => {
    const maths = contextualSupportSummary([
      outcome(1, 10, 'maths', 'decimals'),
    ], 'worked-examples', { subject: 'maths', skillId: 'fractions', now: 10 });
    const english = contextualSupportSummary([
      outcome(1, 10, 'english', 'reading-y6'),
    ], 'worked-examples', { subject: 'maths', skillId: 'fractions', now: 10 });
    expect(maths.effectiveWeight).toBeGreaterThan(english.effectiveWeight);
  });

  it('does not apply recency decay unless a current time is explicitly supplied', () => {
    const summary = contextualSupportSummary([
      outcome(1, 1),
    ], 'worked-examples', { subject: 'maths', skillId: 'fractions' });
    expect(summary.effectiveWeight).toBe(1);
  });
});
