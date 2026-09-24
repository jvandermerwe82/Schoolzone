import {
  adaptive80Policy,
  compareBenchmarks,
  currentBrainPolicy,
  evaluateBrainLabGate,
  reliabilityWeightedAbilityAdjuster,
  runBenchmark,
  staticMidlevelPolicy,
  unaidedOnlyAbilityAdjuster,
} from '../src/brain-lab/benchmark';
import { syntheticPopulation } from '../src/brain-lab/synthetic';

const population = syntheticPopulation(84);
const options = { population, answersPerLearner: 30, seed: 20260925 };

const current = runBenchmark('current', currentBrainPolicy, options);
const adaptive = runBenchmark('adaptive-80', adaptive80Policy, options);
const baseline = runBenchmark('static-mid', staticMidlevelPolicy, options);

const challengers = {
  cleanAbility: runBenchmark('current+clean-ability', currentBrainPolicy, {
    ...options,
    abilityAdjuster: unaidedOnlyAbilityAdjuster,
  }),
  hinted25: runBenchmark('current+hinted25', currentBrainPolicy, {
    ...options,
    abilityAdjuster: reliabilityWeightedAbilityAdjuster(0.25, 0),
  }),
  hinted50: runBenchmark('current+hinted50', currentBrainPolicy, {
    ...options,
    abilityAdjuster: reliabilityWeightedAbilityAdjuster(0.5, 0),
  }),
  hinted25Rapid10: runBenchmark('current+hinted25+rapid10', currentBrainPolicy, {
    ...options,
    abilityAdjuster: reliabilityWeightedAbilityAdjuster(0.25, 0.1),
  }),
};

const gate = evaluateBrainLabGate(current);

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  population: population.length,
  gate,
  current,
  challengers: Object.fromEntries(
    Object.entries(challengers).map(([name, benchmark]) => [
      name,
      {
        benchmark,
        vsCurrent: compareBenchmarks(benchmark, current).delta,
      },
    ]),
  ),
  comparisons: {
    vsAdaptive80: compareBenchmarks(current, adaptive).delta,
    vsStaticMid: compareBenchmarks(current, baseline).delta,
  },
}, null, 2) + '\n');

if (!gate.pass) process.exitCode = 1;
