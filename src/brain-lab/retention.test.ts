import { REVIEW_INTERVAL_MULTIPLIER } from '../brain/model';
import { describe, expect, it } from 'vitest';
import {
  evaluateRetentionLabGate,
  hiddenRecallProbability,
  retentionPopulation,
  retentionScheduleChallengers,
  runRetentionBenchmark,
  runRetentionLearner,
} from './retention';

describe('Brain Lab retention and spaced review', () => {
  it('uses a monotonic hidden forgetting curve', () => {
    expect(hiddenRecallProbability(0, 3)).toBeGreaterThan(hiddenRecallProbability(2, 3));
    expect(hiddenRecallProbability(2, 3)).toBeGreaterThan(hiddenRecallProbability(6, 3));
  });

  it('creates a deterministic population with different forgetting speeds', () => {
    const a = retentionPopulation(24);
    const b = retentionPopulation(24);
    expect(a).toEqual(b);
    expect(new Set(a.map((learner) => learner.initialHalfLifeDays)).size).toBeGreaterThan(3);
  });

  it('replays the same learner deterministically', () => {
    const learner = retentionPopulation(1)[0];
    expect(runRetentionLearner(learner, { horizonDays: 45, seed: 90 }))
      .toEqual(runRetentionLearner(learner, { horizonDays: 45, seed: 90 }));
  });

  it('uses fewer reviews than daily drilling over a 60-day horizon', () => {
    const run = runRetentionLearner(retentionPopulation(1)[0], {
      horizonDays: 60,
      seed: 91,
    });
    expect(run.reviews).toBeGreaterThan(0);
    expect(run.reviews).toBeLessThan(60);
  });

  it('strengthens review intervals for learners who retain successfully', () => {
    const fast = {
      ...retentionPopulation(1)[0],
      initialHalfLifeDays: 12,
      successGrowth: 2.4,
    };
    const run = runRetentionLearner(fast, {
      horizonDays: 60,
      seed: 92,
    });
    expect(run.finalReviewIntervalDays).toBeGreaterThanOrEqual(8);
  });

  it('reproduces the production schedule when the explicit multiplier matches production', () => {
    const population = retentionPopulation(20);
    expect(runRetentionBenchmark({
      population,
      horizonDays: 45,
      seed: 94,
    })).toEqual(runRetentionBenchmark({
      population,
      horizonDays: 45,
      seed: 94,
      intervalMultiplier: REVIEW_INTERVAL_MULTIPLIER,
    }));
  });

  it('compares review schedules using both retention and total maintenance burden', () => {
    const population = retentionPopulation(20);
    const current = runRetentionBenchmark({
      population,
      horizonDays: 45,
      seed: 95,
    });
    const challengers = retentionScheduleChallengers(population, current, {
      horizonDays: 45,
      seed: 95,
    });
    expect(challengers.map((item) => item.intervalMultiplier)).toEqual([1.5, 1.75, 2, 2.25]);
    expect(
      challengers.find((item) => item.intervalMultiplier === REVIEW_INTERVAL_MULTIPLIER)?.benchmark,
    ).toEqual(current);
  });

  it('passes the locked retention regression gate', () => {
    const benchmark = runRetentionBenchmark({
      population: retentionPopulation(80),
      horizonDays: 60,
      seed: 20260925,
    });
    expect(evaluateRetentionLabGate(benchmark)).toEqual({
      pass: true,
      failures: [],
    });
  });

  it('reports retention quality and review burden separately', () => {
    const benchmark = runRetentionBenchmark({
      population: retentionPopulation(40),
      horizonDays: 60,
      seed: 93,
    });
    expect(benchmark.meanDailyRecallProbability).toBeGreaterThan(0);
    expect(benchmark.meanDailyRecallProbability).toBeLessThanOrEqual(1);
    expect(benchmark.retentionCoverage70).toBeGreaterThanOrEqual(0);
    expect(benchmark.retentionCoverage70).toBeLessThanOrEqual(1);
    expect(benchmark.meanReviewsPerLearner).toBeGreaterThan(0);
    expect(benchmark.reviewSuccessRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.reviewSuccessRate).toBeLessThanOrEqual(1);
  });
});
