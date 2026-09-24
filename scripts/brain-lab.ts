import {
  adaptive80Policy,
  compareBenchmarks,
  currentBrainPolicy,
  evaluateBrainLabGate,
  runBenchmark,
  staticMidlevelPolicy,
} from '../src/brain-lab/benchmark';
import { syntheticPopulation } from '../src/brain-lab/synthetic';

const population = syntheticPopulation(84);
const options = { population, answersPerLearner: 30, seed: 20260925 };

const current = runBenchmark('current', currentBrainPolicy, options);
const adaptive = runBenchmark('adaptive-80', adaptive80Policy, options);
const baseline = runBenchmark('static-mid', staticMidlevelPolicy, options);
const gate = evaluateBrainLabGate(current);

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  population: population.length,
  gate,
  current,
  comparisons: {
    vsAdaptive80: compareBenchmarks(current, adaptive).delta,
    vsStaticMid: compareBenchmarks(current, baseline).delta,
  },
}, null, 2) + '\n');

if (!gate.pass) process.exitCode = 1;
