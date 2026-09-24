import { describe, expect, it } from 'vitest';
import {
  evaluateMisconceptionLabGate,
  misconceptionPopulation,
  runMisconceptionBenchmark,
  runMisconceptionLearner,
} from './misconception-learning';

describe('Brain Lab misconception learning', () => {
  it('creates a balanced deterministic hidden/control cohort', () => {
    const a = misconceptionPopulation(30);
    const b = misconceptionPopulation(30);
    expect(a).toEqual(b);
    expect(a.filter((learner) => learner.hasMisconception)).toHaveLength(15);
    expect(new Set(a.map((learner) => learner.scenario.id)).size).toBe(3);
  });

  it('replays the same misconception learner identically', () => {
    const learner = misconceptionPopulation(1)[0];
    expect(runMisconceptionLearner(learner, { seed: 77 }))
      .toEqual(runMisconceptionLearner(learner, { seed: 77 }));
  });

  it('activates only after repeated matching evidence, not the first matching error', () => {
    const learner = {
      ...misconceptionPopulation(1)[0],
      applyRate: 1,
      genericSlipRate: 0,
    };
    const run = runMisconceptionLearner(learner, {
      detectionExposures: 2,
      recoveryExposures: 0,
      seed: 78,
    });
    expect(run.steps[0].strength).toBeCloseTo(0.4);
    expect(run.steps[0].active).toBe(false);
    expect(run.steps[1].strength).toBeGreaterThan(0.5);
    expect(run.steps[1].active).toBe(true);
    expect(run.firstActiveExposure).toBe(2);
  });

  it('clears an active misconception after clean contradictory evidence', () => {
    const learner = {
      ...misconceptionPopulation(1)[0],
      applyRate: 1,
      accidentalBugRate: 0,
      genericSlipRate: 0,
    };
    const run = runMisconceptionLearner(learner, {
      detectionExposures: 3,
      recoveryExposures: 3,
      seed: 79,
    });
    expect(run.activeByDetectionEnd).toBe(true);
    expect(run.fixedByEnd).toBe(true);
    expect(run.activeAtEnd).toBe(false);
  });

  it('separates hidden misconception detection from control false positives', () => {
    const benchmark = runMisconceptionBenchmark({
      population: misconceptionPopulation(60),
      seed: 80,
    });
    expect(benchmark.detectionRecall).toBeGreaterThan(0.5);
    expect(benchmark.detectionPrecision).toBeGreaterThan(0.8);
    expect(benchmark.falsePositiveRate).toBeLessThan(0.2);
  });

  it('passes the locked misconception-learning regression gate', () => {
    const benchmark = runMisconceptionBenchmark({
      population: misconceptionPopulation(120),
      seed: 20260925,
    });
    expect(evaluateMisconceptionLabGate(benchmark)).toEqual({
      pass: true,
      failures: [],
    });
  });

  it('reports both detection and recovery speed', () => {
    const benchmark = runMisconceptionBenchmark({
      population: misconceptionPopulation(60),
      seed: 81,
    });
    expect(benchmark.medianDetectionExposure).not.toBeNull();
    expect(benchmark.medianRecoveryExposuresToClear).not.toBeNull();
    expect(benchmark.recoveryResolutionRate).toBeGreaterThan(0.5);
  });
});
