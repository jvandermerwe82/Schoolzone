import { describe, expect, it } from 'vitest';
import {
  adaptive80Policy,
  compareBenchmarks,
  currentBrainPolicy,
  evaluateBrainLabGate,
  runBenchmark,
  runSyntheticLearner,
  staticMidlevelPolicy,
  unaidedOnlyAbilityAdjuster,
} from './benchmark';
import { syntheticPopulation } from './synthetic';

describe('SchoolZone Brain Lab', () => {
  it('creates a deterministic heterogeneous hidden learner population', () => {
    const a = syntheticPopulation(21);
    const b = syntheticPopulation(21);
    expect(a).toEqual(b);
    expect(new Set(a.map((learner) => learner.skillId)).size).toBeGreaterThanOrEqual(3);
    expect(Math.min(...a.map((learner) => learner.trueAbility))).toBeLessThan(0);
    expect(Math.max(...a.map((learner) => learner.trueAbility))).toBeGreaterThan(1);
  });

  it('replays the same learner/policy/seed identically', () => {
    const learner = syntheticPopulation(1)[0];
    expect(runSyntheticLearner(learner, currentBrainPolicy, 15, 99))
      .toEqual(runSyntheticLearner(learner, currentBrainPolicy, 15, 99));
  });

  it('produces learning curves and a bounded final ability error', () => {
    const benchmark = runBenchmark('current', currentBrainPolicy, {
      population: syntheticPopulation(42),
      answersPerLearner: 30,
      seed: 7,
    });
    expect(benchmark.finalAbilityMae).toBeLessThan(1.25);
    expect(benchmark.stableEstimateRate).toBeGreaterThan(0.25);
    expect(benchmark.learningCurve.at(-1)?.abilityMae).toBeCloseTo(benchmark.finalAbilityMae, 10);
  });

  it('keeps aggregate prediction calibration within a useful range', () => {
    const benchmark = runBenchmark('current', currentBrainPolicy, {
      population: syntheticPopulation(42),
      answersPerLearner: 30,
      seed: 11,
    });
    expect(benchmark.calibrationGap).toBeLessThan(0.2);
    expect(benchmark.meanPredictionBrier).toBeLessThan(0.35);
  });

  it('passes the locked Brain Lab learning-speed regression gate', () => {
    const benchmark = runBenchmark('current', currentBrainPolicy, {
      population: syntheticPopulation(84),
      answersPerLearner: 30,
      seed: 20260925,
    });
    const gate = evaluateBrainLabGate(benchmark);
    expect(gate.failures).toEqual([]);
    expect(gate.pass).toBe(true);
    expect(gate.learningGain).toBeGreaterThanOrEqual(0.5);
  });

  it('supports champion/challenger comparisons on the identical population', () => {
    const population = syntheticPopulation(42);
    const champion = runBenchmark('current', currentBrainPolicy, {
      population,
      answersPerLearner: 24,
      seed: 15,
    });
    const challenger = runBenchmark('static-mid', staticMidlevelPolicy, {
      population,
      answersPerLearner: 24,
      seed: 15,
    });
    const comparison = compareBenchmarks(champion, challenger);
    expect(comparison.champion.learnerCount).toBe(comparison.challenger.learnerCount);
    expect(Number.isFinite(comparison.delta.finalAbilityMae)).toBe(true);
    expect(Number.isFinite(comparison.delta.meanPredictionBrier)).toBe(true);
  });

  it('can run a model challenger without changing production code', () => {
    const population = syntheticPopulation(21);
    const current = runBenchmark('current', currentBrainPolicy, {
      population,
      answersPerLearner: 15,
      seed: 33,
    });
    const challenger = runBenchmark('clean-ability', currentBrainPolicy, {
      population,
      answersPerLearner: 15,
      seed: 33,
      abilityAdjuster: unaidedOnlyAbilityAdjuster,
    });
    expect(challenger.learnerCount).toBe(current.learnerCount);
    expect(Number.isFinite(challenger.finalAbilityMae)).toBe(true);
  });

  it('can benchmark an isolated adaptive policy without changing production code', () => {
    const benchmark = runBenchmark('adaptive-80', adaptive80Policy, {
      population: syntheticPopulation(21),
      answersPerLearner: 15,
      seed: 21,
    });
    expect(benchmark.policy).toBe('adaptive-80');
    expect(benchmark.learnerCount).toBe(21);
  });
});
