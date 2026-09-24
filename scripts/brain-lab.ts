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
  supportPreferenceBenchmarks,
} from '../src/brain-lab/support-learning';
import { syntheticPopulation } from '../src/brain-lab/synthetic';
import {
  evaluateMisconceptionLabGate,
  runMisconceptionBenchmark,
} from '../src/brain-lab/misconception-learning';
import {
  evaluateRetentionLabGate,
  retentionPopulation,
  retentionScheduleChallengers,
  runRetentionBenchmark,
} from '../src/brain-lab/retention';
import {
  compareTeacherIntentPolicies,
  evaluateTeacherIntentLabGate,
  runTeacherIntentBenchmark,
  teacherDualEvidenceChallengers,
  teacherEvidenceChallengers,
  teacherHybridEvidenceChallengers,
  teacherRecoveryEvidenceChallengers,
  teacherIntentHorizonCurve,
  teacherIntentPopulation,
} from '../src/brain-lab/teacher-intent';

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
const supportPreferencePriors = supportPreferenceBenchmarks(
  supportPopulation,
  supportCurrent,
  { trialsPerLearner: 20, seed: 20260925 },
);

const misconceptionLearning = runMisconceptionBenchmark({ seed: 20260925 });
const misconceptionGate = evaluateMisconceptionLabGate(misconceptionLearning);

const retentionPopulationLocked = retentionPopulation(80);
const retentionLearning = runRetentionBenchmark({
  population: retentionPopulationLocked,
  seed: 20260925,
});
const retentionChallengers = retentionScheduleChallengers(
  retentionPopulationLocked,
  retentionLearning,
  { seed: 20260925 },
);
const retentionGate = evaluateRetentionLabGate(retentionLearning);
const teacherIntentPopulationLocked = teacherIntentPopulation(120);
const teacherIntent = compareTeacherIntentPolicies({
  population: teacherIntentPopulationLocked,
  horizonQuestions: 24,
  seed: 20260925,
});
const teacherIntentCurve = teacherIntentHorizonCurve(
  teacherIntentPopulationLocked,
  [12, 24, 36, 48],
  20260925,
);
const teacherIntentLifetime48 = runTeacherIntentBenchmark('route-aware', {
  population: teacherIntentPopulationLocked,
  horizonQuestions: 48,
  seed: 20260925,
});
const teacherIntentEvidence = teacherEvidenceChallengers(
  teacherIntentPopulationLocked,
  teacherIntentLifetime48,
  { horizonQuestions: 48, seed: 20260925 },
);
const teacherIntentHybridEvidence = teacherHybridEvidenceChallengers(
  teacherIntentPopulationLocked,
  teacherIntentLifetime48,
  { horizonQuestions: 48, seed: 20260925 },
);
const teacherIntentRecoveryEvidence = teacherRecoveryEvidenceChallengers(
  teacherIntentPopulationLocked,
  teacherIntentLifetime48,
  { horizonQuestions: 48, seed: 20260925 },
);
const teacherIntentDualEvidence = teacherDualEvidenceChallengers(
  teacherIntentPopulationLocked,
  teacherIntentLifetime48,
  { horizonQuestions: 48, seed: 20260925 },
);
const teacherIntentGate = evaluateTeacherIntentLabGate(
  teacherIntent,
  teacherIntentLifetime48,
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
    preferencePriors: supportPreferencePriors,
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
  misconceptionLearning: {
    gate: misconceptionGate,
    ...misconceptionLearning,
  },
  retentionLearning: {
    gate: retentionGate,
    current: retentionLearning,
    scheduleChallengers: retentionChallengers,
  },
  teacherIntent: {
    gate: teacherIntentGate,
    current: teacherIntent,
    horizonCurve: teacherIntentCurve,
    lifetime48: teacherIntentLifetime48,
    evidenceChallengers: teacherIntentEvidence,
    guardedEvidenceChallengers: teacherIntentHybridEvidence,
    recoveryEvidenceChallengers: teacherIntentRecoveryEvidence,
    dualEvidenceChallengers: teacherIntentDualEvidence,
  },
  comparisons: {
    vsAdaptive80: compareBenchmarks(current, adaptive).delta,
    vsStaticMid: compareBenchmarks(current, baseline).delta,
  },
}, null, 2) + '\n');

if (
  !gate.pass
  || !supportGate.pass
  || !misconceptionGate.pass
  || !retentionGate.pass
  || !teacherIntentGate.pass
) process.exitCode = 1;
