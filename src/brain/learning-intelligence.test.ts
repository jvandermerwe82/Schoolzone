import { describe, expect, it } from 'vitest';
import {
  activeLearningIntents,
  emptyLearningIntelligence,
  summariseSupportStrategy,
  type LearningIntent,
  type SupportOutcome,
} from './learning-intelligence';

describe('learning intelligence', () => {
  it('starts empty without inventing learner claims', () => {
    expect(emptyLearningIntelligence()).toEqual({
      schemaVersion: 1,
      curriculum: null,
      supportPreferences: [],
      supportOutcomes: [],
      engagement: [],
      intents: [],
    });
  });

  it('aggregates only outcomes for the requested support strategy', () => {
    const outcomes: SupportOutcome[] = [
      { strategy: 'worked-examples', at: 10, delta: 1, weight: 1, source: 'observed-learning' },
      { strategy: 'worked-examples', at: 20, delta: 0.5, weight: 1, source: 'observed-learning' },
      { strategy: 'read-aloud', at: 30, delta: -1, weight: 1, source: 'observed-learning' },
    ];
    const summary = summariseSupportStrategy(outcomes, 'worked-examples');
    expect(summary.score).toBeCloseTo(0.75);
    expect(summary.evidenceCount).toBe(2);
    expect(summary.totalWeight).toBe(2);
    expect(summary.lastObservedAt).toBe(20);
  });

  it('clamps malformed deltas and weights at the contract boundary', () => {
    const summary = summariseSupportStrategy([
      { strategy: 'shorter-missions', at: 1, delta: 4, weight: 3, source: 'teacher-feedback' },
      { strategy: 'shorter-missions', at: 2, delta: -4, weight: -2, source: 'parent-feedback' },
    ], 'shorter-missions');
    expect(summary.score).toBe(1);
    expect(summary.totalWeight).toBe(1);
    expect(summary.confidence).toBeGreaterThan(0);
    expect(summary.confidence).toBeLessThan(1);
  });

  it('returns zero confidence when there is no measured evidence', () => {
    const summary = summariseSupportStrategy([], 'read-aloud');
    expect(summary.score).toBe(0);
    expect(summary.confidence).toBe(0);
    expect(summary.evidenceCount).toBe(0);
    expect(summary.lastObservedAt).toBeNull();
  });

  it('orders active intent by priority, due date and assignment time', () => {
    const base = {
      source: 'teacher' as const,
      objective: 'Fractions',
      skillIds: ['fractions'],
      curriculumRefs: [],
      status: 'active' as const,
    };
    const intents: LearningIntent[] = [
      { ...base, id: 'later', priority: 2, assignedAt: 10, dueAt: 100 },
      { ...base, id: 'urgent-late', priority: 1, assignedAt: 20, dueAt: 80 },
      { ...base, id: 'urgent-soon', priority: 1, assignedAt: 30, dueAt: 60 },
      { ...base, id: 'done', priority: 1, assignedAt: 1, dueAt: 1, status: 'completed' },
    ];
    expect(activeLearningIntents(intents).map((intent) => intent.id)).toEqual([
      'urgent-soon',
      'urgent-late',
      'later',
    ]);
  });
});
