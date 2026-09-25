import { describe, expect, it } from 'vitest';
import {
  compareScaffoldFadePolicies,
  runScaffoldEpisode,
  runScaffoldFadeBenchmark,
  scaffoldFadePopulation,
} from './scaffold-fading';

describe('Brain Lab scaffold fading and independence', () => {
  it('creates a deterministic cohort with varied transfer rates', () => {
    const a = scaffoldFadePopulation(30);
    const b = scaffoldFadePopulation(30);
    expect(a).toEqual(b);
    expect(new Set(a.map((learner) => learner.supportTransferRate)).size)
      .toBeGreaterThanOrEqual(4);
  });

  it('replays the same learner and policy identically', () => {
    const learner = scaffoldFadePopulation(1)[0];
    expect(runScaffoldEpisode(learner, 'current', { seed: 301 }))
      .toEqual(runScaffoldEpisode(learner, 'current', { seed: 301 }));
  });

  it('current policy fades to unaided work once support gets the learner moving', () => {
    const learner = {
      ...scaffoldFadePopulation(1)[0],
      supportBoost: 0.6,
      supportTransferRate: 0.4,
      slipRate: 0,
    };
    const run = runScaffoldEpisode(learner, 'current', {
      seed: 302,
      maxTurns: 12,
    });
    expect(run.supportQuestions).toBeGreaterThan(0);
    expect(run.unaidedQuestions).toBeGreaterThan(0);
    expect(run.firstFadeTurn).not.toBeNull();
  });

  it('persistent support delays the first fade compared with current policy', () => {
    const learner = {
      ...scaffoldFadePopulation(1)[0],
      supportBoost: 0.7,
      supportTransferRate: 0.35,
      slipRate: 0,
    };
    const current = runScaffoldEpisode(learner, 'current', {
      seed: 303,
      maxTurns: 14,
    });
    const three = runScaffoldEpisode(learner, 'three-supported', {
      seed: 303,
      maxTurns: 14,
    });
    expect(three.supportQuestions).toBeGreaterThanOrEqual(current.supportQuestions);
    if (current.firstFadeTurn !== null && three.firstFadeTurn !== null) {
      expect(three.firstFadeTurn).toBeGreaterThanOrEqual(current.firstFadeTurn);
    }
  });

  it('reports post-resolution independent performance separately from resolution', () => {
    const benchmark = runScaffoldFadeBenchmark('current', {
      population: scaffoldFadePopulation(40),
      maxTurns: 18,
      postResolutionProbes: 4,
      seed: 304,
    });
    expect(benchmark.resolutionRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.resolutionRate).toBeLessThanOrEqual(1);
    expect(benchmark.postResolutionSuccessRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.postResolutionSuccessRate).toBeLessThanOrEqual(1);
    expect(benchmark.immediateRelapseRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.immediateRelapseRate).toBeLessThanOrEqual(1);
  });

  it('compares current fading with two- and three-supported challengers', () => {
    const comparison = compareScaffoldFadePolicies({
      population: scaffoldFadePopulation(40),
      maxTurns: 18,
      postResolutionProbes: 4,
      seed: 305,
    });
    expect(comparison.current.learnerCount).toBe(40);
    expect(comparison.twoSupported.learnerCount).toBe(40);
    expect(comparison.threeSupported.learnerCount).toBe(40);
  });
});
