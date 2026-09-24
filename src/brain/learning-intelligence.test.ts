import { describe, expect, it } from 'vitest';
import {
  activeLearningIntents,
  clearSupportPreference,
  emptyLearningIntelligence,
  recordEngagementSignal,
  recordLearningEvidenceFromAnswer,
  recordSupportOutcome,
  setCurriculumContext,
  setSupportPreference,
  supportPreference,
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


describe('answer-derived support learning', () => {
  it('records rapid guessing as behaviour without inventing a support conclusion', () => {
    const state = recordLearningEvidenceFromAnswer(emptyLearningIntelligence(), {
      at: 10,
      correct: false,
      hinted: false,
      rapid: true,
      skillId: 'fractions',
      subject: 'maths',
    });
    expect(state.engagement.map((signal) => signal.kind)).toContain('rapid-guess');
    expect(state.supportOutcomes).toEqual([]);
  });

  it('records low-weight positive evidence when a child succeeds after using a hint', () => {
    const state = recordLearningEvidenceFromAnswer(emptyLearningIntelligence(), {
      at: 10,
      correct: true,
      hinted: true,
      rapid: false,
      event: null,
      skillId: 'fractions',
      subject: 'maths',
    });
    expect(state.engagement.map((signal) => signal.kind)).toContain('requested-help');
    expect(state.supportOutcomes).toEqual([
      expect.objectContaining({
        strategy: 'graduated-hints',
        delta: 0.2,
        weight: 0.15,
        source: 'observed-learning',
      }),
    ]);
  });

  it('credits the actual strategy after a successful climb resolves a stuck episode', () => {
    const state = recordLearningEvidenceFromAnswer(emptyLearningIntelligence(), {
      at: 10,
      correct: true,
      hinted: false,
      rapid: false,
      strategy: 'climb',
      helpedBy: 'worked-example',
      event: 'resolved',
      skillId: 'fractions',
      subject: 'maths',
    });
    expect(state.engagement.map((signal) => signal.kind)).toContain('persisted-after-error');
    expect(state.supportOutcomes[0]).toMatchObject({
      strategy: 'worked-examples',
      delta: 0.9,
      weight: 0.5,
    });
  });

  it('records a strategy switch as negative evidence rather than a diagnosis', () => {
    const state = recordLearningEvidenceFromAnswer(emptyLearningIntelligence(), {
      at: 10,
      correct: false,
      hinted: false,
      rapid: false,
      strategy: 'similar',
      event: 'switched',
      skillId: 'fractions',
      subject: 'maths',
    });
    expect(state.supportOutcomes[0]).toMatchObject({
      strategy: 'similar-problem',
      delta: -0.6,
      weight: 0.35,
    });
  });
});


describe('support preference provenance', () => {
  it('keeps learner and parent preferences separate even when they disagree', () => {
    let state = emptyLearningIntelligence();
    state = setSupportPreference(state, {
      strategy: 'shorter-missions',
      source: 'learner',
      value: 'prefer',
      at: 1,
    });
    state = setSupportPreference(state, {
      strategy: 'shorter-missions',
      source: 'parent',
      value: 'avoid',
      at: 2,
    });
    expect(supportPreference(state, 'shorter-missions', 'learner')?.value).toBe('prefer');
    expect(supportPreference(state, 'shorter-missions', 'parent')?.value).toBe('avoid');
  });

  it('clearing one source never erases another source or measured outcome evidence', () => {
    let state = emptyLearningIntelligence();
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
    state = recordSupportOutcome(state, {
      strategy: 'worked-examples',
      at: 3,
      delta: 0.8,
      weight: 0.5,
      source: 'observed-learning',
    });

    state = clearSupportPreference(state, 'worked-examples', 'learner');
    expect(supportPreference(state, 'worked-examples', 'learner')).toBeNull();
    expect(supportPreference(state, 'worked-examples', 'parent')?.value).toBe('prefer');
    expect(state.supportOutcomes).toHaveLength(1);
  });
});
