import { describe, expect, it } from 'vitest';
import {
  currentSupportPolicy,
  evaluateSupportLabGate,
  historyOnlySupportPolicy,
  oracleSupportPolicy,
  roundRobinSupportPolicy,
  runSupportBenchmark,
  runSupportLearner,
  CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
  parameterizedSupportPolicy,
  supportPreferenceBenchmarks,
  supportRoutingChallengers,
  supportWeightChallengers,
} from './support-learning';
import { syntheticPopulation } from './synthetic';

describe('Brain Lab support learning', () => {
  it('replays the same hidden learner deterministically', () => {
    const learner = syntheticPopulation(1)[0];
    expect(runSupportLearner(learner, currentSupportPolicy, 12, 50))
      .toEqual(runSupportLearner(learner, currentSupportPolicy, 12, 50));
  });

  it('gives the oracle zero regret', () => {
    const benchmark = runSupportBenchmark('oracle', oracleSupportPolicy, {
      population: syntheticPopulation(25),
      trialsPerLearner: 15,
      seed: 51,
    });
    expect(benchmark.meanRegret).toBeCloseTo(0, 10);
    expect(benchmark.preferredSelectionRate).toBe(1);
  });

  it('keeps a round-robin baseline well below the oracle', () => {
    const population = syntheticPopulation(25);
    const oracle = runSupportBenchmark('oracle', oracleSupportPolicy, {
      population,
      trialsPerLearner: 20,
      seed: 52,
    });
    const roundRobin = runSupportBenchmark('round-robin', roundRobinSupportPolicy, {
      population,
      trialsPerLearner: 20,
      seed: 52,
    });
    expect(roundRobin.final5PreferredRate).toBeLessThan(oracle.final5PreferredRate);
    expect(roundRobin.meanRegret).toBeGreaterThan(oracle.meanRegret);
  });

  it('passes the locked support-learning regression gate', () => {
    const benchmark = runSupportBenchmark('current', currentSupportPolicy, {
      population: syntheticPopulation(100),
      trialsPerLearner: 20,
      seed: 20260925,
    });
    expect(evaluateSupportLabGate(benchmark)).toEqual({
      pass: true,
      failures: [],
    });
  });

  it('reproduces the production support selector with the current lab config', () => {
    const learner = syntheticPopulation(1)[0];
    expect(
      runSupportLearner(learner, currentSupportPolicy, 15, 541),
    ).toEqual(
      runSupportLearner(
        learner,
        parameterizedSupportPolicy(CURRENT_SUPPORT_ROUTING_LAB_CONFIG),
        15,
        541,
      ),
    );
  });

  it('can compare tunable routing challengers on the same cohort', () => {
    const population = syntheticPopulation(25);
    const current = runSupportBenchmark('current', currentSupportPolicy, {
      population,
      trialsPerLearner: 15,
      seed: 55,
    });
    const challengers = supportRoutingChallengers(population, current, {
      trialsPerLearner: 15,
      seed: 55,
    });
    expect(challengers.length).toBeGreaterThan(5);
    expect(challengers[0].benchmark).toEqual(
      runSupportBenchmark('current-routing', parameterizedSupportPolicy(CURRENT_SUPPORT_ROUTING_LAB_CONFIG), {
        population,
        trialsPerLearner: 15,
        seed: 55,
      }),
    );
  });

  it('can compare faster confidence challengers without changing the production baseline', () => {
    const population = syntheticPopulation(25);
    const current = runSupportBenchmark('current', currentSupportPolicy, {
      population,
      trialsPerLearner: 15,
      seed: 54,
    });
    const challengers = supportWeightChallengers(population, current, {
      trialsPerLearner: 15,
      seed: 54,
    });
    expect(challengers.map((item) => item.outcomeWeightScale)).toEqual([1.25, 1.5, 1.75, 2]);
    expect(challengers.every((item) => item.benchmark.learnerCount === current.learnerCount)).toBe(true);
  });

  it('benchmarks learner/parent priors on the same hidden cohort', () => {
    const population = syntheticPopulation(25);
    const current = runSupportBenchmark('current', currentSupportPolicy, {
      population,
      trialsPerLearner: 15,
      seed: 56,
    });
    const priors = supportPreferenceBenchmarks(population, current, {
      trialsPerLearner: 15,
      seed: 56,
    });
    expect(priors.map((item) => item.prior.name)).toEqual([
      'conservative-prior',
      'typical-prior',
      'strong-prior',
    ]);
    expect(priors.every((item) => item.benchmark.learnerCount === current.learnerCount)).toBe(true);
  });

  it('can compare current support intelligence to historical success memory alone', () => {
    const population = syntheticPopulation(25);
    const current = runSupportBenchmark('current', currentSupportPolicy, {
      population,
      trialsPerLearner: 20,
      seed: 53,
    });
    const history = runSupportBenchmark('history-only', historyOnlySupportPolicy, {
      population,
      trialsPerLearner: 20,
      seed: 53,
    });
    expect(Number.isFinite(current.final5PreferredRate)).toBe(true);
    expect(Number.isFinite(history.final5PreferredRate)).toBe(true);
    expect(current.learnerCount).toBe(history.learnerCount);
  });
});
