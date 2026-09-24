import { describe, expect, it } from 'vitest';
import {
  productionRuns,
  shadowAbilityBenchmark,
  shadowAbilityGrid,
} from './dual-ability';
import { syntheticPopulation } from './synthetic';

describe('dual-state shadow ability lab', () => {
  it('replays one production trajectory and evaluates multiple shadow estimators without mutating it', () => {
    const runs = productionRuns(syntheticPopulation(12), 12, 44);
    const before = JSON.stringify(runs);
    const grid = shadowAbilityGrid(runs);
    expect(grid).toHaveLength(8);
    expect(JSON.stringify(runs)).toBe(before);
    expect(grid.every((benchmark) => benchmark.learnerCount === 12)).toBe(true);
  });

  it('is deterministic for the same hidden cohort and reliability weights', () => {
    const runs = productionRuns(syntheticPopulation(12), 15, 45);
    const weights = { name: 'test', hintedWeight: 0.5, rapidWeight: 0.1 };
    expect(shadowAbilityBenchmark(runs, weights))
      .toEqual(shadowAbilityBenchmark(runs, weights));
  });

  it('keeps shadow metrics independent from production routing decisions', () => {
    const runs = productionRuns(syntheticPopulation(12), 15, 46);
    const clean = shadowAbilityBenchmark(runs, {
      name: 'clean',
      hintedWeight: 0,
      rapidWeight: 0,
    });
    const weighted = shadowAbilityBenchmark(runs, {
      name: 'weighted',
      hintedWeight: 0.5,
      rapidWeight: 0.1,
    });
    expect(clean.answersPerLearner).toBe(weighted.answersPerLearner);
    expect(clean.learnerCount).toBe(weighted.learnerCount);
    expect(Number.isFinite(clean.finalAbilityMae)).toBe(true);
    expect(Number.isFinite(weighted.finalAbilityMae)).toBe(true);
  });

  it('reports a learning curve rather than only a final score', () => {
    const runs = productionRuns(syntheticPopulation(12), 30, 47);
    const result = shadowAbilityBenchmark(runs, {
      name: 'weighted',
      hintedWeight: 0.5,
      rapidWeight: 0.1,
    });
    expect(result.learningCurve.map((point) => point.afterAnswers)).toEqual([2, 5, 10, 20, 30]);
  });
});
