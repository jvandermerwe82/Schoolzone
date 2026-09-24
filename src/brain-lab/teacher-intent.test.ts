import { describe, expect, it } from 'vitest';
import {
  compareTeacherIntentPolicies,
  evaluateTeacherIntentLabGate,
  runTeacherIntentBenchmark,
  teacherDualEvidenceChallengers,
  teacherEvidenceChallengers,
  teacherHybridEvidenceChallengers,
  teacherRecoveryEvidenceChallengers,
  runTeacherIntentLearner,
  teacherIntentPopulation,
  teacherIntentScenarios,
} from './teacher-intent';

describe('Brain Lab teacher-intent efficiency', () => {
  it('discovers real one-hop executable prerequisite scenarios from production routing', () => {
    const scenarios = teacherIntentScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    expect(scenarios.every((scenario) => scenario.target.routeStrength === 'direct')).toBe(true);
    expect(scenarios.every((scenario) => scenario.prerequisiteNodeId !== scenario.target.canonicalNodeId)).toBe(true);
  });

  it('builds a deterministic hidden learner cohort', () => {
    expect(teacherIntentPopulation(30)).toEqual(teacherIntentPopulation(30));
    expect(new Set(teacherIntentPopulation(30).map((learner) => learner.scenario.target.id)).size).toBeGreaterThanOrEqual(2);
  });

  it('replays the same learner and policy deterministically', () => {
    const learner = teacherIntentPopulation(1)[0];
    expect(runTeacherIntentLearner(learner, 'route-aware', { seed: 101 }))
      .toEqual(runTeacherIntentLearner(learner, 'route-aware', { seed: 101 }));
  });

  it('repairs the prerequisite and returns to the teacher target', () => {
    const learner = {
      ...teacherIntentPopulation(1)[0],
      prerequisiteKnowledge: 0.15,
      targetKnowledge: 0.25,
      prerequisiteLearnRate: 0.30,
      targetLearnRate: 0.18,
      slipRate: 0,
    };
    const run = runTeacherIntentLearner(learner, 'route-aware', {
      horizonQuestions: 24,
      seed: 102,
    });
    expect(run.prerequisiteAttempts).toBeGreaterThan(0);
    expect(run.prerequisiteEvidenceReadyAt).not.toBeNull();
    expect(run.returnedToTargetAfterRepair).toBe(true);
    expect(run.targetAttempts).toBeGreaterThan(0);
  });

  it('keeps the direct-drill baseline on the target instead of repairing the prerequisite', () => {
    const learner = teacherIntentPopulation(1)[0];
    const run = runTeacherIntentLearner(learner, 'direct-target', {
      horizonQuestions: 12,
      seed: 103,
    });
    expect(run.prerequisiteAttempts).toBe(0);
    expect(run.targetAttempts).toBeGreaterThan(0);
  });

  it('compares route-aware learning with direct target drilling on the same cohort', () => {
    const population = teacherIntentPopulation(80);
    const comparison = compareTeacherIntentPolicies({
      population,
      horizonQuestions: 24,
      seed: 104,
    });
    expect(comparison.routeAware.learnerCount).toBe(comparison.directTarget.learnerCount);
    expect(comparison.routeAware.returnToTargetRate).toBeGreaterThan(0.9);
    expect(comparison.routeAware.prerequisiteRepairRate).toBeGreaterThan(0.5);
    expect(comparison.routeAware.meanPrematureTargetAttempts)
      .toBeLessThan(comparison.directTarget.meanPrematureTargetAttempts);
  });

  it('compares recency-aware evidence without allowing unsafe readiness', () => {
    const population = teacherIntentPopulation(60);
    const lifetime = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions: 48,
      seed: 106,
    });
    const challengers = teacherEvidenceChallengers(population, lifetime, {
      horizonQuestions: 48,
      seed: 106,
    });

    expect(challengers.map((item) => item.evidencePolicy)).toEqual([
      'recent-6',
      'recent-8',
      'recent-10',
    ]);
    for (const challenger of challengers) {
      expect(challenger.benchmark.completionReadinessPrecision).toBeGreaterThanOrEqual(0);
      expect(challenger.benchmark.completionReadinessPrecision).toBeLessThanOrEqual(1);
      expect(challenger.benchmark.prerequisiteReadinessPrecision).toBeGreaterThanOrEqual(0);
      expect(challenger.benchmark.prerequisiteReadinessPrecision).toBeLessThanOrEqual(1);
    }
  });

  it('tests guarded recency only after substantial lifetime evidence', () => {
    const population = teacherIntentPopulation(60);
    const lifetime = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions: 48,
      seed: 107,
    });
    const challengers = teacherHybridEvidenceChallengers(population, lifetime, {
      horizonQuestions: 48,
      seed: 107,
    });

    expect(challengers.map((item) => item.evidencePolicy)).toEqual([
      'recent-8-after-8',
      'recent-8-after-10',
      'recent-10-after-10',
    ]);
    expect(challengers.every((item) => item.benchmark.prerequisiteReadinessPrecision >= 0.95)).toBe(true);
  });

  it('tests strict recovery streaks as an alternative to blanket recency', () => {
    const population = teacherIntentPopulation(60);
    const lifetime = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions: 48,
      seed: 108,
    });
    const challengers = teacherRecoveryEvidenceChallengers(population, lifetime, {
      horizonQuestions: 48,
      seed: 108,
    });

    expect(challengers.map((item) => item.evidencePolicy)).toEqual([
      'recovery-7-of-8',
      'recovery-8-of-8',
      'recovery-9-of-10',
    ]);
    expect(challengers.every((item) => item.benchmark.prerequisiteReadinessPrecision >= 0.95)).toBe(true);
  });

  it('cross-checks recovery evidence against the core Brain skill state', () => {
    const population = teacherIntentPopulation(60);
    const lifetime = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions: 48,
      seed: 109,
    });
    const challengers = teacherDualEvidenceChallengers(population, lifetime, {
      horizonQuestions: 48,
      seed: 109,
    });

    expect(challengers.map((item) => item.evidencePolicy)).toEqual([
      'recent-8-skill-ready',
      'recovery-7-of-8-skill-ready',
      'recent-8-skill-mastered',
    ]);
    expect(challengers.every((item) => item.benchmark.prerequisiteReadinessPrecision >= 0.95)).toBe(true);
  });

  it('passes the locked teacher-intent routing regression gate', () => {
    const population = teacherIntentPopulation(120);
    const comparison24 = compareTeacherIntentPolicies({
      population,
      horizonQuestions: 24,
      seed: 20260925,
    });
    const routeAware48 = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions: 48,
      seed: 20260925,
    });
    expect(evaluateTeacherIntentLabGate(comparison24, routeAware48)).toEqual({
      pass: true,
      failures: [],
    });
  });

  it('reports completion and learner-friction metrics separately', () => {
    const benchmark = runTeacherIntentBenchmark('route-aware', {
      population: teacherIntentPopulation(40),
      horizonQuestions: 24,
      seed: 105,
    });
    expect(benchmark.completionRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.completionRate).toBeLessThanOrEqual(1);
    expect(benchmark.wrongAnswerRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.wrongAnswerRate).toBeLessThanOrEqual(1);
    expect(benchmark.meanTargetAttempts).toBeGreaterThan(0);
  });
});
