import { describe, expect, it } from 'vitest';
import {
  currentSupportPolicy,
  historyOnlySupportPolicy,
  oracleSupportPolicy,
  roundRobinSupportPolicy,
  runSupportBenchmark,
  runSupportLearner,
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
