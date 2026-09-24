import { describe, expect, it } from 'vitest';
import {
  compareSessionRegulation,
  runSessionLearner,
  runSessionRegulationBenchmark,
  sessionRegulationPopulation,
} from './session-regulation';

describe('Brain Lab adaptive session regulation', () => {
  it('creates a deterministic cohort with varied fatigue thresholds', () => {
    const a = sessionRegulationPopulation(30);
    const b = sessionRegulationPopulation(30);
    expect(a).toEqual(b);
    expect(new Set(a.map((learner) => learner.fatigueAfter)).size).toBeGreaterThanOrEqual(5);
  });

  it('replays the same learner and policy identically', () => {
    const learner = sessionRegulationPopulation(1)[0];
    expect(runSessionLearner(learner, 'adaptive', { missions: 10, seed: 201 }))
      .toEqual(runSessionLearner(learner, 'adaptive', { missions: 10, seed: 201 }));
  });

  it('learns a shorter mission for a strongly fatigue-sensitive learner', () => {
    const learner = {
      ...sessionRegulationPopulation(1)[0],
      fatigueAfter: 5,
      fatigueRapidIncrease: 0.25,
      stopHazardAfterFatigue: 0.45,
    };
    const run = runSessionLearner(learner, 'adaptive', {
      missions: 12,
      seed: 202,
    });
    expect(run.finalPlannedMissionLength).toBeLessThan(10);
    expect(run.finalPlannedMissionLength).toBeGreaterThanOrEqual(5);
  });

  it('keeps the fixed baseline at ten questions', () => {
    const learner = sessionRegulationPopulation(1)[0];
    const run = runSessionLearner(learner, 'fixed-10', {
      missions: 8,
      seed: 203,
    });
    expect(run.missions.every((mission) => mission.plannedLength === 10)).toBe(true);
  });

  it('compares both policies on the same cohort', () => {
    const population = sessionRegulationPopulation(40);
    const comparison = compareSessionRegulation({
      population,
      missionsPerLearner: 10,
      seed: 204,
    });
    expect(comparison.adaptive.learnerCount).toBe(comparison.fixed10.learnerCount);
    expect(Number.isFinite(comparison.delta.usefulLearningRate)).toBe(true);
    expect(Number.isFinite(comparison.delta.rapidGuessRate)).toBe(true);
  });

  it('reports learning quality and workload separately', () => {
    const benchmark = runSessionRegulationBenchmark('adaptive', {
      population: sessionRegulationPopulation(40),
      missionsPerLearner: 10,
      seed: 205,
    });
    expect(benchmark.usefulLearningRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.usefulLearningRate).toBeLessThanOrEqual(1);
    expect(benchmark.rapidGuessRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.rapidGuessRate).toBeLessThanOrEqual(1);
    expect(benchmark.meanQuestionsAnswered).toBeGreaterThan(0);
  });
});
