import { describe, expect, it } from 'vitest';
import { emptyHelp } from '../brain/help';
import { emptyLearningIntelligence, setCurriculumContext } from '../brain/learning-intelligence';
import { guessRate, predictCorrect } from '../brain/model';
import { planNext, skillState } from '../brain/tutor';
import { DEFAULT_SETTINGS, type AnswerRecord, type Profile } from '../brain/types';
import { classifyAttempt, DELAYED_CHECK_MIN_GAP_MS, isIndependentRecord } from './evidence-mode';
import { SCENARIO_A, SCENARIO_B, FIXTURE_START } from './scenarios';
import {
  explainAnswer, selectCanonicalNode, selectConceptGraph, selectContractVersions, selectDecision,
  selectReviews, selectRoute, selectSupport, snapshotSkill,
} from './selectors';
import { runTrace } from './trace';

const NODE = 'math.fractions.add-subtract-related';

const blank = (): Profile => ({
  id: 'synthetic:test', name: 'Synthetic learner T', avatar: '', year: 5, createdAt: 0, skills: {}, history: [],
  recentQuestionIds: [], misconceptions: {}, help: emptyHelp(), badges: {}, rewards: {}, rewardsSetUp: true,
  currency: '$', xp: 0, checkpoints: [], settings: { ...DEFAULT_SETTINGS }, sats: [],
  learningIntelligence: setCurriculumContext(emptyLearningIntelligence(), {
    jurisdiction: 'AU', curriculumId: 'au-ac-v9', curriculumVersion: '9.0', yearLevel: '5',
  }),
});

const direct = (i: number, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({
  at: 1_000 + i * 60_000, skillId: 'fractions-y6', level: 2, correct: true, timeMs: 9_000, predicted: 0.7,
  curriculumEvidence: [{ curriculumId: 'au-ac-v9', canonicalNodeId: NODE, strength: 'direct' }],
  ...extra,
});

const withHistory = (history: AnswerRecord[]): Profile => ({ ...blank(), history });

describe('canonical node view: independent versus assisted evidence', () => {
  it('flags a "mastered" status that rests entirely on helped answers', () => {
    const profile = withHistory(Array.from({ length: 7 }, (_, i) => direct(i, { hinted: true })));
    const view = selectCanonicalNode(profile, NODE)!;
    // The authoritative engine rule still says mastered. We do not change it, we label it.
    expect(view.status).toBe('mastered');
    expect(view.independentDirect).toBe(0);
    expect(view.assistedDirect).toBe(7);
    expect(view.reliesOnAssistedEvidence).toBe(true);
    expect(view.caveat).toMatch(/with help/i);
  });

  it('treats an answer given during a help strategy as assisted even when no hint was opened', () => {
    const profile = withHistory(Array.from({ length: 7 }, (_, i) => direct(i, { strategy: 'similar' })));
    const view = selectCanonicalNode(profile, NODE)!;
    expect(view.independentDirect).toBe(0);
    expect(view.assistedDirect).toBe(7);
    expect(view.reliesOnAssistedEvidence).toBe(true);
  });

  it('does not flag strong evidence that is independent', () => {
    const profile = withHistory(Array.from({ length: 6 }, (_, i) => direct(i)));
    const view = selectCanonicalNode(profile, NODE)!;
    expect(view.status).toBe('mastered');
    expect(view.independentDirect).toBe(6);
    expect(view.reliesOnAssistedEvidence).toBe(false);
    expect(view.caveat).toBeNull();
  });

  it('keeps rapid guesses out of both counts', () => {
    const view = selectCanonicalNode(withHistory([direct(0), direct(1, { correct: false, rapid: true })]), NODE)!;
    expect(view.directEvidence).toBe(2);
    expect(view.independentDirect + view.assistedDirect).toBe(1);
  });

  it('reports not-started with no evidence, and returns null for an unknown node', () => {
    expect(selectCanonicalNode(blank(), NODE)!.status).toBe('not-started');
    expect(selectCanonicalNode(blank(), 'math.nope')).toBeNull();
  });

  it('carries the verified curriculum code and the practice skill coverage note', () => {
    const view = selectCanonicalNode(blank(), NODE)!;
    expect(view.curriculumCode).toBe('AC9M5N05');
    expect(view.practice?.skillId).toBe('fractions-y6');
    expect(view.practice?.coverage).toBe('partial');
    expect(view.practice?.coverageNote).toBeTruthy();
  });
});

describe('concept graph and route', () => {
  it('lays out prerequisites with real status and marks which concepts have a practice route', () => {
    const graph = selectConceptGraph(blank(), NODE, NODE, 3);
    const byId = new Map(graph.nodes.map((n) => [n.nodeId, n]));
    expect(byId.get(NODE)!.depth).toBe(0);
    expect(byId.get(NODE)!.isTarget).toBe(true);
    expect(byId.get('math.fractions.compare-order-related')!.depth).toBe(1);
    expect(byId.get('math.fractions.compare-order-related')!.hasExecutableRoute).toBe(false);
    expect(byId.get('math.number.factors-multiples-divisibility')!.hasExecutableRoute).toBe(true);
    for (const edge of graph.edges) {
      // Shortest distance from the goal can shrink by at most one step along an edge.
      expect(byId.get(edge.from)!.depth).toBeLessThanOrEqual(byId.get(edge.to)!.depth + 1);
    }
    expect(new Set(graph.nodes.map((n) => n.nodeId)).size).toBe(graph.nodes.length);
  });

  it('sends a learner with no foundation evidence to the foundation first, and straight to the goal once it is secure', () => {
    const fresh = selectRoute(blank(), SCENARIO_A.homework);
    expect(fresh.reason).toBe('prerequisite');
    expect(fresh.activeNodeId).not.toBe(fresh.targetNodeId);
    expect(fresh.steps.map((s) => s.kind)).toEqual(['foundation', 'target', 'check']);

    const ready = selectRoute(SCENARIO_A.profile(), SCENARIO_A.homework);
    expect(ready.reason).toBe('target');
    expect(ready.steps.map((s) => s.kind)).toEqual(['target', 'check']);
    expect(ready.practiceSkillId).toBe('fractions-y6');
    expect(ready.practiceLevels).toEqual([2]);
    expect(ready.learnerLine).toContain(ready.targetTitle);
    expect(ready.learnerLine).not.toContain('—');
  });
});

describe('decision view', () => {
  it('lays out every level with the predicted success the engine would use', () => {
    const profile = SCENARIO_A.profile();
    const plan = planNext(profile, 'maths', { focus: 'fractions-y6', answered: 0, allowedLevels: [2], strictFocus: true }, FIXTURE_START, () => 0.5);
    const view = selectDecision(profile, plan, { allowedLevels: [2] });
    expect(view.levelOptions).toHaveLength(5);
    expect(view.levelOptions.filter((l) => l.chosen).map((l) => l.level)).toEqual([plan.level]);
    expect(view.levelOptions.filter((l) => l.allowed).map((l) => l.level)).toEqual([2]);
    for (const option of view.levelOptions) {
      const { ability } = skillState(profile, 'fractions-y6');
      expect(option.predicted).toBeCloseTo(predictCorrect(ability, option.level, guessRate(option.level, undefined), 0), 10);
    }
    expect(view.learnerMessage).toBe(plan.message);
    expect(view.why.length).toBeGreaterThan(0);
  });
});

describe('misconception view: a slip is not a diagnosis', () => {
  const step = (n: number) => runTrace(SCENARIO_A).entries.filter((e) => e.kind === 'answer')[n];

  it('shows one match as a possible slip and two as a repeated pattern', () => {
    const afterOne = step(2);
    const afterTwo = step(3);
    if (afterOne.kind !== 'answer' || afterTwo.kind !== 'answer') throw new Error('expected answer steps');
    const one = afterOne.misconceptionsAfter.find((m) => m.id === 'frac-add-across')!;
    const two = afterTwo.misconceptionsAfter.find((m) => m.id === 'frac-add-across')!;
    expect(one.status).toBe('possible-slip');
    expect(one.evidenceLabel).toMatch(/slip/i);
    expect(two.status).toBe('active-pattern');
    expect(two.seen).toBe(2);
  });

  it('shows the pattern as cleared once correct answers weaken it', () => {
    const last = runTrace(SCENARIO_A).entries.filter((e) => e.kind === 'answer').at(-1)!;
    if (last.kind !== 'answer') throw new Error('expected answer step');
    expect(last.misconceptionsAfter.find((m) => m.id === 'frac-add-across')!.status).toBe('cleared');
  });
});

describe('support view: stated is not measured', () => {
  it('keeps stated preferences and measured results in separate fields', () => {
    const profile = SCENARIO_B.profile();
    const rows = new Map(selectSupport(profile, 'fractions-y6', FIXTURE_START).rows.map((r) => [r.strategy, r]));
    const worked = rows.get('worked-example')!;
    expect(worked.stated.learner).toBe('prefer');
    expect(worked.observed.evidenceCount).toBe(0);
    expect(worked.observed.strength).toBe('none');

    const hints = rows.get('hint')!;
    expect(hints.stated.learner).toBeNull();
    expect(hints.observed.evidenceCount).toBe(4);
    expect(hints.observed.strength).toBe('repeated');
    expect(hints.observed.usedInRouting).toBe(true);
    expect(hints.observed.score).toBeLessThan(0);
  });

  it('says plainly that support results are observational', () => {
    expect(selectSupport(blank(), 'fractions-y6').caution).toMatch(/neither proves/i);
  });
});

describe('review view', () => {
  it('lists scheduled reviews and what is due', () => {
    const profile = SCENARIO_A.profile();
    const soon = selectReviews(profile, FIXTURE_START);
    expect(soon.items.length).toBeGreaterThan(0);
    expect(soon.dueCount).toBe(0);
    expect(selectReviews(profile, FIXTURE_START + 60 * 86_400_000).dueCount).toBe(soon.items.length);
  });
});

describe('attempt labelling', () => {
  it('never promotes a helped answer to independent, whatever the gap or reason', () => {
    for (const hinted of [true, false]) {
      for (const strategy of ['similar', 'worked-example', 'hint', 'smaller-steps', 'prerequisite', null] as const) {
        for (const planReason of ['new', 'continue', 'review', 'help', 'climb'] as const) {
          for (const gap of [null, 1_000, DELAYED_CHECK_MIN_GAP_MS, 10 * DELAYED_CHECK_MIN_GAP_MS]) {
            const info = classifyAttempt({ hinted, strategy, planReason, msSincePreviousAttempt: gap });
            if (hinted || strategy) {
              expect(info.mode, JSON.stringify({ hinted, strategy, planReason, gap })).toBe('assisted-practice');
              expect(info.independent).toBe(false);
            }
          }
        }
      }
    }
  });

  it('distinguishes the four kinds of unassisted-or-assisted attempt', () => {
    expect(classifyAttempt({ hinted: false, planReason: 'continue', msSincePreviousAttempt: 1_000 }).mode).toBe('unaided-demonstration');
    expect(classifyAttempt({ hinted: false, planReason: 'review', msSincePreviousAttempt: 1_000 }).mode).toBe('due-review');
    expect(classifyAttempt({ hinted: false, planReason: 'continue', msSincePreviousAttempt: DELAYED_CHECK_MIN_GAP_MS }).mode).toBe('independent-delayed-check');
    expect(classifyAttempt({ hinted: true, planReason: 'continue' }).mode).toBe('assisted-practice');
  });

  it('climbing back up with no help is unaided, not assisted', () => {
    expect(classifyAttempt({ hinted: false, strategy: 'climb', planReason: 'climb', msSincePreviousAttempt: 1_000 }).mode).toBe('unaided-demonstration');
  });

  it('does not count rapid guesses as independent attempts', () => {
    expect(isIndependentRecord({ ...direct(0), rapid: true })).toBe(false);
    expect(isIndependentRecord(direct(0))).toBe(true);
    expect(isIndependentRecord(direct(0, { strategy: 'hint' }))).toBe(false);
  });
});

describe('explanations and contract versions', () => {
  it('explains a helped answer without calling it proof', () => {
    const before = snapshotSkill(SCENARIO_A.profile(), 'fractions-y6');
    const rows = explainAnswer({
      predicted: 0.6, before, after: before, correct: true, helped: true, rapid: false, misconceptionId: null,
      attempt: classifyAttempt({ hinted: true }), strategy: 'worked-example',
    });
    const text = rows.map((r) => `${r.field} ${r.meaning}`).join(' ');
    expect(text).toMatch(/never count as independent/i);
    expect(text).not.toContain('—');
  });

  it('reports only contract versions that really exist and admits there is no single Brain version', () => {
    const versions = selectContractVersions();
    expect(versions.curriculum.id).toBe('au-ac-v9');
    expect(versions.learningIntelligence).toBeGreaterThan(0);
    expect(versions.note).toMatch(/no single Brain policy version/i);
  });
});
