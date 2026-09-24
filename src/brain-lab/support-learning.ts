import { nextStrategy, strategyScore, STRATEGIES, weakPrerequisite } from '../brain/help';
import {
  emptyLearningIntelligence,
  recordSupportOutcome,
  setSupportPreference,
  supportPreference,
  type LearningIntelligenceState,
  type SupportStrategyId,
} from '../brain/learning-intelligence';
import { contextualSupportSummary } from '../brain/rapid-learning';
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

export interface SupportPreferencePriorConfig {
  name: string;
  learnerProvideRate: number;
  learnerAccuracy: number;
  parentProvideRate: number;
  parentAccuracy: number;
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


const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const statedStrategy = (
  learner: HiddenLearner,
  accuracy: number,
  rng: () => number,
): StrategyId => {
  if (rng() < clamp01(accuracy)) return learner.preferredStrategy;
  const alternatives = STRATEGIES.filter((strategy) => strategy !== learner.preferredStrategy);
  return alternatives[Math.floor(rng() * alternatives.length)];
};

const seedSupportPreferences = (
  profile: Profile,
  learner: HiddenLearner,
  prior: SupportPreferencePriorConfig | undefined,
  rng: () => number,
): Profile => {
  if (!prior) return profile;
  let state = profile.learningIntelligence ?? emptyLearningIntelligence();

  if (rng() < clamp01(prior.learnerProvideRate)) {
    const strategy = statedStrategy(learner, prior.learnerAccuracy, rng);
    state = setSupportPreference(state, {
      strategy: SUPPORT_FOR_HELP[strategy],
      source: 'learner',
      value: 'prefer',
      at: 0,
    });
  }

  if (rng() < clamp01(prior.parentProvideRate)) {
    const strategy = statedStrategy(learner, prior.parentAccuracy, rng);
    state = setSupportPreference(state, {
      strategy: SUPPORT_FOR_HELP[strategy],
      source: 'parent',
      value: 'prefer',
      at: 0,
    });
  }

  return { ...profile, learningIntelligence: state };
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
  preferencePrior?: SupportPreferencePriorConfig,
): SupportLearnerRun {
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber, 0x51f15e));
  let profile = newProfile(learner.id, '🧪', learner.year);
  const preferenceRng = seededRng(mixSeed(seed, idNumber, 0x70726566));
  profile = seedSupportPreferences(profile, learner, preferencePrior, preferenceRng);
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
    preferencePrior?: SupportPreferencePriorConfig;
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
      options.preferencePrior,
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


export interface SupportRoutingLabConfig {
  name: string;
  rapidMinCount: number;
  rapidMinConfidence: number;
  rapidMinScore: number;
  rapidCap: number;
  matureMinEvidence: number;
  matureMinConfidence: number;
  matureCap: number;
  learnerPreferenceWeight: number;
  parentPreferenceWeight: number;
}

export const CURRENT_SUPPORT_ROUTING_LAB_CONFIG: SupportRoutingLabConfig = {
  name: 'current-routing',
  rapidMinCount: 2,
  rapidMinConfidence: 0.25,
  rapidMinScore: 0.6,
  rapidCap: 0.05,
  matureMinEvidence: 3,
  matureMinConfidence: 0.3,
  matureCap: 0.08,
  learnerPreferenceWeight: 0.04,
  parentPreferenceWeight: 0.02,
};

const observedLabAdjustment = (
  profile: Profile,
  strategy: StrategyId,
  now: number,
  config: SupportRoutingLabConfig,
): number => {
  const intelligence = profile.learningIntelligence ?? emptyLearningIntelligence();
  const summary = contextualSupportSummary(
    intelligence.supportOutcomes,
    SUPPORT_FOR_HELP[strategy],
    { subject: 'maths', skillId: 'fractions-y6', now },
  );
  const mature = summary.evidenceCount >= config.matureMinEvidence
    && summary.confidence >= config.matureMinConfidence;
  const rapid = !mature
    && summary.exactSkillCount >= config.rapidMinCount
    && summary.confidence >= config.rapidMinConfidence
    && Math.abs(summary.score) >= config.rapidMinScore;
  const cap = mature ? config.matureCap : rapid ? config.rapidCap : 0;
  return cap === 0
    ? 0
    : Math.max(-cap, Math.min(cap, summary.score * summary.confidence * cap));
};

/**
 * Lab-only replica of the production selector with tunable evidence gates.
 * No learner/parent preferences are present in the synthetic support cohort,
 * so the current config should reproduce currentSupportPolicy exactly.
 */
export function parameterizedSupportPolicy(
  config: SupportRoutingLabConfig,
): SupportPolicy {
  return (profile, _learner, _trial, now) => {
    const prereq = weakPrerequisite(profile, 'fractions-y6');
    const usable = STRATEGIES.filter(
      (strategy) => strategy !== 'prerequisite' || !!prereq,
    );
    const intelligence = profile.learningIntelligence ?? emptyLearningIntelligence();
    const preferenceAdjustment = (strategy: StrategyId) => {
      const support = SUPPORT_FOR_HELP[strategy];
      const learnerPref = supportPreference(intelligence, support, 'learner')?.value;
      const parentPref = supportPreference(intelligence, support, 'parent')?.value;
      const learner = learnerPref === 'prefer'
        ? config.learnerPreferenceWeight
        : learnerPref === 'avoid'
          ? -config.learnerPreferenceWeight
          : 0;
      const parent = parentPref === 'prefer'
        ? config.parentPreferenceWeight
        : parentPref === 'avoid'
          ? -config.parentPreferenceWeight
          : 0;
      return learner + parent;
    };
    return [...usable].sort((a, b) => {
      const aScore = strategyScore(profile.help, a)
        + preferenceAdjustment(a)
        + observedLabAdjustment(profile, a, now, config);
      const bScore = strategyScore(profile.help, b)
        + preferenceAdjustment(b)
        + observedLabAdjustment(profile, b, now, config);
      return bScore - aScore || STRATEGIES.indexOf(a) - STRATEGIES.indexOf(b);
    })[0];
  };
}

export const SUPPORT_SPEED_CONFIGS: readonly SupportRoutingLabConfig[] = [
  CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
  { ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG, name: 'rapid-cap-075', rapidCap: 0.075 },
  { ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG, name: 'rapid-cap-100', rapidCap: 0.10 },
  { ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG, name: 'rapid-cap-150', rapidCap: 0.15 },
  {
    ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
    name: 'one-shot-cap-020',
    rapidMinCount: 1,
    rapidMinConfidence: 0.10,
    rapidCap: 0.02,
  },
  {
    ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
    name: 'one-shot-cap-040',
    rapidMinCount: 1,
    rapidMinConfidence: 0.10,
    rapidCap: 0.04,
  },
  {
    ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
    name: 'one-shot-cap-060',
    rapidMinCount: 1,
    rapidMinConfidence: 0.10,
    rapidCap: 0.06,
  },
  {
    ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
    name: 'mature-cap-100',
    matureCap: 0.10,
  },
  {
    ...CURRENT_SUPPORT_ROUTING_LAB_CONFIG,
    name: 'mature-cap-120',
    matureCap: 0.12,
  },
] as const;

export interface SupportRoutingChallengerResult {
  config: SupportRoutingLabConfig;
  benchmark: SupportBenchmark;
  deltaVsCurrent: {
    final5PreferredRate: number;
    meanRegret: number;
    medianTrialsToStablePreference: number | null;
    stablePreferenceRate: number;
  };
}

export function supportRoutingChallengers(
  population: HiddenLearner[],
  current: SupportBenchmark,
  options: { trialsPerLearner?: number; seed?: number } = {},
): SupportRoutingChallengerResult[] {
  const trialsPerLearner = options.trialsPerLearner ?? 20;
  const seed = options.seed ?? 20260925;
  return SUPPORT_SPEED_CONFIGS.map((config) => {
    const benchmark = runSupportBenchmark(
      config.name,
      parameterizedSupportPolicy(config),
      { population, trialsPerLearner, seed },
    );
    return {
      config,
      benchmark,
      deltaVsCurrent: {
        final5PreferredRate: benchmark.final5PreferredRate - current.final5PreferredRate,
        meanRegret: current.meanRegret - benchmark.meanRegret,
        medianTrialsToStablePreference:
          benchmark.medianTrialsToStablePreference === null
          || current.medianTrialsToStablePreference === null
            ? null
            : current.medianTrialsToStablePreference
              - benchmark.medianTrialsToStablePreference,
        stablePreferenceRate: benchmark.stablePreferenceRate - current.stablePreferenceRate,
      },
    };
  });
}


export const SUPPORT_PREFERENCE_PRIORS: readonly SupportPreferencePriorConfig[] = [
  {
    name: 'conservative-prior',
    learnerProvideRate: 0.8,
    learnerAccuracy: 0.65,
    parentProvideRate: 0.8,
    parentAccuracy: 0.60,
  },
  {
    name: 'typical-prior',
    learnerProvideRate: 0.8,
    learnerAccuracy: 0.75,
    parentProvideRate: 0.8,
    parentAccuracy: 0.65,
  },
  {
    name: 'strong-prior',
    learnerProvideRate: 0.8,
    learnerAccuracy: 0.85,
    parentProvideRate: 0.8,
    parentAccuracy: 0.75,
  },
] as const;

export interface SupportPreferenceBenchmarkResult {
  prior: SupportPreferencePriorConfig;
  benchmark: SupportBenchmark;
  deltaVsNoPrior: {
    final5PreferredRate: number;
    meanRegret: number;
    medianTrialsToStablePreference: number | null;
    stablePreferenceRate: number;
  };
}

export function supportPreferenceBenchmarks(
  population: HiddenLearner[],
  noPrior: SupportBenchmark,
  options: { trialsPerLearner?: number; seed?: number } = {},
): SupportPreferenceBenchmarkResult[] {
  const trialsPerLearner = options.trialsPerLearner ?? 20;
  const seed = options.seed ?? 20260925;
  return SUPPORT_PREFERENCE_PRIORS.map((prior) => {
    const benchmark = runSupportBenchmark(
      `current+${prior.name}`,
      currentSupportPolicy,
      { population, trialsPerLearner, seed, preferencePrior: prior },
    );
    return {
      prior,
      benchmark,
      deltaVsNoPrior: {
        final5PreferredRate: benchmark.final5PreferredRate - noPrior.final5PreferredRate,
        meanRegret: noPrior.meanRegret - benchmark.meanRegret,
        medianTrialsToStablePreference:
          benchmark.medianTrialsToStablePreference === null
          || noPrior.medianTrialsToStablePreference === null
            ? null
            : noPrior.medianTrialsToStablePreference
              - benchmark.medianTrialsToStablePreference,
        stablePreferenceRate: benchmark.stablePreferenceRate - noPrior.stablePreferenceRate,
      },
    };
  });
}
