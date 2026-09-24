import { describe, expect, it } from 'vitest';
import {
  activeLearningIntents,
  emptyLearningIntelligence,
  recordEngagementSignal,
  recordSupportOutcome,
  setCurriculumContext,
  setSupportPreference,
  summariseSupportStrategy,
  upsertLearningIntent,
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


describe('learning intelligence recording', () => {
  it('keeps preferences separate by source and replaces only the same source/strategy pair', () => {
    let state = emptyLearningIntelligence();
    state = setSupportPreference(state, { strategy: 'read-aloud', source: 'parent', value: 'prefer', at: 1 });
    state = setSupportPreference(state, { strategy: 'read-aloud', source: 'learner', value: 'avoid', at: 2 });
    state = setSupportPreference(state, { strategy: 'read-aloud', source: 'parent', value: 'neutral', at: 3 });
    expect(state.supportPreferences).toHaveLength(2);
    expect(state.supportPreferences.find((p) => p.source === 'parent')?.value).toBe('neutral');
    expect(state.supportPreferences.find((p) => p.source === 'learner')?.value).toBe('avoid');
  });

  it('sanitises support outcomes before storing them', () => {
    const state = recordSupportOutcome(emptyLearningIntelligence(), {
      strategy: 'shorter-missions',
      at: 1,
      delta: 9,
      weight: -4,
      source: 'observed-learning',
    });
    expect(state.supportOutcomes[0]).toMatchObject({ delta: 1, weight: 0 });
  });

  it('records engagement as observation only and bounds malformed numeric values', () => {
    const state = recordEngagementSignal(emptyLearningIntelligence(), {
      kind: 'continued-voluntarily',
      at: 1,
      value: Number.POSITIVE_INFINITY,
    });
    expect(state.engagement).toEqual([{ kind: 'continued-voluntarily', at: 1, value: 0 }]);
  });

  it('deduplicates intent skills and curriculum refs when updating an intent', () => {
    const state = upsertLearningIntent(emptyLearningIntelligence(), {
      id: 'teacher-1',
      source: 'teacher',
      objective: ' Fractions this week ',
      skillIds: ['fractions', 'fractions'],
      curriculumRefs: ['au-ac-v9:AC9M6N05', 'au-ac-v9:AC9M6N05'],
      priority: 1,
      assignedAt: 10,
      dueAt: null,
      status: 'active',
    });
    expect(state.intents[0].objective).toBe('Fractions this week');
    expect(state.intents[0].skillIds).toEqual(['fractions']);
    expect(state.intents[0].curriculumRefs).toEqual(['au-ac-v9:AC9M6N05']);
  });

  it('sets curriculum context only when explicitly requested', () => {
    const state = setCurriculumContext(emptyLearningIntelligence(), {
      jurisdiction: 'AU',
      curriculumId: 'au-ac-v9',
      curriculumVersion: '9.0',
      yearLevel: '5',
    });
    expect(state.curriculum?.jurisdiction).toBe('AU');
  });
});
