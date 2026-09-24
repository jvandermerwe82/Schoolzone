import {
  adaptive80Policy,
  compareBenchmarks,
  currentBrainPolicy,
  evaluateBrainLabGate,
  runBenchmark,
  staticMidlevelPolicy,
} from '../src/brain-lab/benchmark';
import {
  blendedAbilityGrid,
  productionRuns,
  shadowAbilityGrid,
} from '../src/brain-lab/dual-ability';
import { syntheticPopulation } from '../src/brain-lab/synthetic';

const population = syntheticPopulation(84);
const answersPerLearner = 30;
const seed = 20260925;
const options = { population, answersPerLearner, seed };

const current = runBenchmark('current', currentBrainPolicy, options);
const adaptive = runBenchmark('adaptive-80', adaptive80Policy, options);
const baseline = runBenchmark('static-mid', staticMidlevelPolicy, options);
const gate = evaluateBrainLabGate(current);

const runs = productionRuns(population, answersPerLearner, seed);
const shadowGrid = shadowAbilityGrid(runs);
const blendedGrid = blendedAbilityGrid(runs);
const score = (benchmark: (typeof shadowGrid)[number]) => ({
  benchmark,
  vsCurrentAbilityMae: current.finalAbilityMae - benchmark.finalAbilityMae,
  vsCurrentMedianStable:
    benchmark.medianAnswersToStableEstimate === null
    || current.medianAnswersToStableEstimate === null
      ? null
      : current.medianAnswersToStableEstimate - benchmark.medianAnswersToStableEstimate,
  vsCurrentStableCoverage: benchmark.stableEstimateRate - current.stableEstimateRate,
});
const dualAbility = shadowGrid
  .map(score)
  .sort((a, b) => b.vsCurrentAbilityMae - a.vsCurrentAbilityMae);
const blendedAbility = blendedGrid
  .map(score)
  .sort((a, b) => b.vsCurrentAbilityMae - a.vsCurrentAbilityMae);

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  population: population.length,
  gate,
  current,
  dualAbility: {
    note: 'Shadow independent-ability estimates do not affect production routing or prediction metrics.',
    candidates: dualAbility,
    blendedCandidates: blendedAbility,
  },
  comparisons: {
    vsAdaptive80: compareBenchmarks(current, adaptive).delta,
    vsStaticMid: compareBenchmarks(current, baseline).delta,
  },
}, null, 2) + '\n');

if (!gate.pass) process.exitCode = 1;
