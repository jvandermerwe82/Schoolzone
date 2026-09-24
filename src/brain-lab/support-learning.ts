import { nextStrategy, STRATEGIES } from '../brain/help';
import {
  emptyLearningIntelligence,
  recordSupportOutcome,
  type LearningIntelligenceState,
  type SupportStrategyId,
} from '../brain/learning-intelligence';
import type { Profile, StrategyId } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';
import { syntheticPopulation } from './synthetic';
import type { HiddenLearner } from './types';

const SUPPORT_FOR_HELP: Record<StrategyId, SupportStrategyId> = {
  similar: 'similar-problem',
  'worked-example': 'worked-examples',
  hint: 'graduated-hints',
  'smaller-steps': 'smaller-steps',
  prerequisite: 'prerequisite-refresh',
};

export interface SupportLabStep {
  trial: number;
  selected: StrategyId;
  preferred: StrategyId;
  success: boolean;
  successProbability: number;
  oracleProbability: number;
  regret: number;
}

export interface SupportLearnerRun {
  learner: HiddenLearner;
  steps: SupportLabStep[];
  preferredSelectionRate: number;
  preferredSelectionRateAfter5: number;
  final5PreferredRate: number;
  meanRegret: number;
  trialsToStablePreference: number | null;
}

export interface SupportBenchmark {
  policy: string;
  learnerCount: number;
  trialsPerLearner: number;
  preferredSelectionRate: number;
  preferredSelectionRateAfter5: number;
  final5PreferredRate: number;
  meanRegret: number;
  medianTrialsToStablePreference: number | null;
  stablePreferenceRate: number;
}

export type SupportPolicy = (
  profile: Profile,
  learner: HiddenLearner,
  trial: number,
  now: number,
) => StrategyId;

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const successProbability = (learner: HiddenLearner, strategy: StrategyId): number => {
  const preferred = 0.42 + learner.preferredSupportBoost * 1.8;
  const other = 0.28 + learner.otherSupportBoost * 1.5;
  const p = strategy === learner.preferredStrategy ? preferred : other;
  return Math.max(0.05, Math.min(0.95, p * (1 - learner.carelessRate)));
};

const creditHistory = (
  profile: Profile,
  strategy: StrategyId,
  success: boolean,
): Profile => {
  const current = profile.help.strategies[strategy] ?? { tried: 0, helped: 0 };
  return {
    ...profile,
    help: {
      ...profile.help,
      strategies: {
        ...profile.help.strategies,
        [strategy]: {
          tried: current.tried + 1,
          helped: current.helped + (success ? 1 : 0),
        },
      },
    },
  };
};

const creditIntelligence = (
  state: LearningIntelligenceState,
  strategy: StrategyId,
  success: boolean,
  now: number,
  weightScale = 1,
): LearningIntelligenceState =>
  recordSupportOutcome(state, {
    strategy: SUPPORT_FOR_HELP[strategy],
    at: now,
    delta: success ? 0.9 : -0.6,
    weight: (success ? 0.5 : 0.35) * weightScale,
    source: 'observed-learning',
    subject: 'maths',
    skillId: 'fractions-y6',
  });

export const currentSupportPolicy: SupportPolicy = (profile, _learner, _trial, now) =>
  nextStrategy(
    profile,
    { skillId: 'fractions-y6', stuckLevel: 4, tried: [] },
    now,
  ).strategy;

/** Same historical success-rate learner, but without the newer support-outcome memory. */
export const historyOnlySupportPolicy: SupportPolicy = (profile, _learner, _trial, now) => {
  const intelligence = profile.learningIntelligence ?? emptyLearningIntelligence();
  const stripped: Profile = {
    ...profile,
    learningIntelligence: {
      ...intelligence,
      supportOutcomes: [],
      supportPreferences: [],
    },
  };
  return nextStrategy(
    stripped,
    { skillId: 'fractions-y6', stuckLevel: 4, tried: [] },
    now,
  ).strategy;
};

export const roundRobinSupportPolicy: SupportPolicy = (_profile, _learner, trial) =>
  STRATEGIES[trial % STRATEGIES.length];

export const oracleSupportPolicy: SupportPolicy = (_profile, learner) =>
  learner.preferredStrategy;

const stablePreferenceAt = (
  steps: readonly SupportLabStep[],
  window = 5,
  required = 4,
): number | null => {
  for (let index = 0; index <= steps.length - window; index++) {
    const slice = steps.slice(index, index + window);
    const preferred = slice.filter((step) => step.selected === step.preferred).length;
    if (preferred >= required) return index + 1;
  }
  return null;
};

export function runSupportLearner(
  learner: HiddenLearner,
  policy: SupportPolicy,
  trials = 20,
  seed = 1,
  recordIntelligence = true,
  outcomeWeightScale = 1,
): SupportLearnerRun {
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber, 0x51f15e));
  let profile = newProfile(learner.id, '🧪', learner.year);
  const steps: SupportLabStep[] = [];

  for (let trial = 0; trial < trials; trial++) {
    const now = trial * 60_000;
    const selected = policy(profile, learner, trial, now);
    const probability = successProbability(learner, selected);
    const oracleProbability = successProbability(learner, learner.preferredStrategy);
    const success = rng() < probability;

    steps.push({
      trial: trial + 1,
      selected,
      preferred: learner.preferredStrategy,
      success,
      successProbability: probability,
      oracleProbability,
      regret: oracleProbability - probability,
    });

    profile = creditHistory(profile, selected, success);
    if (recordIntelligence) {
      profile = {
        ...profile,
        learningIntelligence: creditIntelligence(
          profile.learningIntelligence ?? emptyLearningIntelligence(),
          selected,
          success,
          now,
          outcomeWeightScale,
        ),
      };
    }
  }

  const after5 = steps.slice(5);
  const final5 = steps.slice(-5);
  return {
    learner,
    steps,
    preferredSelectionRate: mean(steps.map((step) => step.selected === step.preferred ? 1 : 0)),
    preferredSelectionRateAfter5: mean(after5.map((step) => step.selected === step.preferred ? 1 : 0)),
    final5PreferredRate: mean(final5.map((step) => step.selected === step.preferred ? 1 : 0)),
    meanRegret: mean(steps.map((step) => step.regret)),
    trialsToStablePreference: stablePreferenceAt(steps),
  };
}

export function runSupportBenchmark(
  policyName: string,
  policy: SupportPolicy,
  options: {
    population?: HiddenLearner[];
    trialsPerLearner?: number;
    seed?: number;
    recordIntelligence?: boolean;
    outcomeWeightScale?: number;
  } = {},
): SupportBenchmark {
  const population = options.population ?? syntheticPopulation(100);
  const trialsPerLearner = options.trialsPerLearner ?? 20;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runSupportLearner(
      learner,
      policy,
      trialsPerLearner,
      mixSeed(seed, index + 1),
      options.recordIntelligence ?? true,
      options.outcomeWeightScale ?? 1,
    ));
  const stable = runs
    .map((run) => run.trialsToStablePreference)
    .filter((value): value is number => value !== null);

  return {
    policy: policyName,
    learnerCount: runs.length,
    trialsPerLearner,
    preferredSelectionRate: mean(runs.map((run) => run.preferredSelectionRate)),
    preferredSelectionRateAfter5: mean(runs.map((run) => run.preferredSelectionRateAfter5)),
    final5PreferredRate: mean(runs.map((run) => run.final5PreferredRate)),
    meanRegret: mean(runs.map((run) => run.meanRegret)),
    medianTrialsToStablePreference: median(stable),
    stablePreferenceRate: runs.length === 0 ? 0 : stable.length / runs.length,
  };
}


export const SUPPORT_LAB_THRESHOLDS = {
  minFinal5PreferredRate: 0.8,
  maxMeanRegret: 0.18,
  maxMedianTrialsToStablePreference: 4,
  minStablePreferenceRate: 0.8,
} as const;

export interface SupportLabGate {
  pass: boolean;
  failures: string[];
}

export function evaluateSupportLabGate(
  benchmark: SupportBenchmark,
): SupportLabGate {
  const failures: string[] = [];

  if (benchmark.final5PreferredRate < SUPPORT_LAB_THRESHOLDS.minFinal5PreferredRate) {
    failures.push(
      `final-5 preferred rate ${benchmark.final5PreferredRate.toFixed(3)} is below ${SUPPORT_LAB_THRESHOLDS.minFinal5PreferredRate}`,
    );
  }
  if (benchmark.meanRegret > SUPPORT_LAB_THRESHOLDS.maxMeanRegret) {
    failures.push(
      `mean support regret ${benchmark.meanRegret.toFixed(3)} exceeds ${SUPPORT_LAB_THRESHOLDS.maxMeanRegret}`,
    );
  }
  if (
    benchmark.medianTrialsToStablePreference === null
    || benchmark.medianTrialsToStablePreference > SUPPORT_LAB_THRESHOLDS.maxMedianTrialsToStablePreference
  ) {
    failures.push(
      `median trials to stable preference ${benchmark.medianTrialsToStablePreference ?? 'none'} exceeds ${SUPPORT_LAB_THRESHOLDS.maxMedianTrialsToStablePreference}`,
    );
  }
  if (benchmark.stablePreferenceRate < SUPPORT_LAB_THRESHOLDS.minStablePreferenceRate) {
    failures.push(
      `stable preference rate ${benchmark.stablePreferenceRate.toFixed(3)} is below ${SUPPORT_LAB_THRESHOLDS.minStablePreferenceRate}`,
    );
  }

  return { pass: failures.length === 0, failures };
}


export interface SupportWeightChallenger {
  name: string;
  outcomeWeightScale: number;
  benchmark: SupportBenchmark;
  deltaVsCurrent: {
    final5PreferredRate: number;
    meanRegret: number;
    medianTrialsToStablePreference: number | null;
    stablePreferenceRate: number;
  };
}

export function supportWeightChallengers(
  population: HiddenLearner[],
  current: SupportBenchmark,
  options: { trialsPerLearner?: number; seed?: number } = {},
): SupportWeightChallenger[] {
  const trialsPerLearner = options.trialsPerLearner ?? 20;
  const seed = options.seed ?? 20260925;
  return [1.25, 1.5, 1.75, 2].map((outcomeWeightScale) => {
    const benchmark = runSupportBenchmark(
      `current-weight-${outcomeWeightScale}`,
      currentSupportPolicy,
      { population, trialsPerLearner, seed, outcomeWeightScale },
    );
    return {
      name: benchmark.policy,
      outcomeWeightScale,
      benchmark,
      deltaVsCurrent: {
        final5PreferredRate: benchmark.final5PreferredRate - current.final5PreferredRate,
        meanRegret: current.meanRegret - benchmark.meanRegret,
        medianTrialsToStablePreference:
          benchmark.medianTrialsToStablePreference === null
          || current.medianTrialsToStablePreference === null
            ? null
            : current.medianTrialsToStablePreference - benchmark.medianTrialsToStablePreference,
        stablePreferenceRate: benchmark.stablePreferenceRate - current.stablePreferenceRate,
      },
    };
  });
}
