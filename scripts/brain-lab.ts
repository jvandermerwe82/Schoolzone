import {
  adaptive80Policy,
  compareBenchmarks,
  currentBrainPolicy,
  evaluateBrainLabGate,
  runBenchmark,
  staticMidlevelPolicy,
} from '../src/brain-lab/benchmark';
import {
  currentSupportPolicy,
  evaluateSupportLabGate,
  historyOnlySupportPolicy,
  oracleSupportPolicy,
  roundRobinSupportPolicy,
  runSupportBenchmark,
  supportRoutingChallengers,
  supportWeightChallengers,
} from '../src/brain-lab/support-learning';
import { syntheticPopulation } from '../src/brain-lab/synthetic';

const population = syntheticPopulation(84);
const options = { population, answersPerLearner: 30, seed: 20260925 };

const current = runBenchmark('current', currentBrainPolicy, options);
const adaptive = runBenchmark('adaptive-80', adaptive80Policy, options);
const baseline = runBenchmark('static-mid', staticMidlevelPolicy, options);
const gate = evaluateBrainLabGate(current);

const supportPopulation = syntheticPopulation(100);
const supportOptions = {
  population: supportPopulation,
  trialsPerLearner: 20,
  seed: 20260925,
};
const supportCurrent = runSupportBenchmark('current', currentSupportPolicy, supportOptions);
const supportHistory = runSupportBenchmark('history-only', historyOnlySupportPolicy, supportOptions);
const supportRoundRobin = runSupportBenchmark('round-robin', roundRobinSupportPolicy, supportOptions);
const supportOracle = runSupportBenchmark('oracle', oracleSupportPolicy, supportOptions);
const supportGate = evaluateSupportLabGate(supportCurrent);
const supportSpeedChallengers = supportWeightChallengers(
  supportPopulation,
  supportCurrent,
  { trialsPerLearner: 20, seed: 20260925 },
);
const supportRoutingGrid = supportRoutingChallengers(
  supportPopulation,
  supportCurrent,
  { trialsPerLearner: 20, seed: 20260925 },
);

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  population: population.length,
  gate,
  current,
  supportLearning: {
    population: supportPopulation.length,
    gate: supportGate,
    current: supportCurrent,
    historyOnly: supportHistory,
    roundRobin: supportRoundRobin,
    oracle: supportOracle,
    weightSpeedChallengers: supportSpeedChallengers,
    routingSpeedChallengers: supportRoutingGrid,
    currentVsHistory: {
      final5PreferredRate:
        supportCurrent.final5PreferredRate - supportHistory.final5PreferredRate,
      meanRegret:
        supportHistory.meanRegret - supportCurrent.meanRegret,
      stablePreferenceRate:
        supportCurrent.stablePreferenceRate - supportHistory.stablePreferenceRate,
      medianTrialsToStablePreference:
        supportCurrent.medianTrialsToStablePreference === null
        || supportHistory.medianTrialsToStablePreference === null
          ? null
          : supportHistory.medianTrialsToStablePreference
            - supportCurrent.medianTrialsToStablePreference,
    },
  },
  comparisons: {
    vsAdaptive80: compareBenchmarks(current, adaptive).delta,
    vsStaticMid: compareBenchmarks(current, baseline).delta,
  },
}, null, 2) + '\n');

if (!gate.pass || !supportGate.pass) process.exitCode = 1;
