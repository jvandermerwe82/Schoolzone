import { getSkill } from '../content/skills';
import { guessRate, initialSkillState, kFactor, predictCorrect } from '../brain/model';
import { currentBrainPolicy, runSyntheticLearner } from './benchmark';
import { mixSeed } from './rng';
import { syntheticPopulation } from './synthetic';
import type { HiddenLearner, LearnerRun } from './types';

export interface ShadowAbilityWeights {
  name: string;
  hintedWeight: number;
  rapidWeight: number;
}

export interface ShadowAbilityCurvePoint {
  afterAnswers: number;
  abilityMae: number;
}

export interface ShadowAbilityBenchmark {
  name: string;
  learnerCount: number;
  answersPerLearner: number;
  hintedWeight: number;
  rapidWeight: number;
  finalAbilityMae: number;
  medianAnswersToStableEstimate: number | null;
  stableEstimateRate: number;
  learningCurve: ShadowAbilityCurvePoint[];
}

export interface BlendedAbilityConfig extends ShadowAbilityWeights {
  /** 0 = production ability only; 1 = shadow independent ability only. */
  shadowShare: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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

const stableAt = (errors: readonly number[], threshold = 0.6, window = 3): number | null => {
  for (let index = 0; index <= errors.length - window; index++) {
    if (errors.slice(index, index + window).every((error) => error <= threshold)) return index + 1;
  }
  return null;
};

export function productionRuns(
  population: readonly HiddenLearner[] = syntheticPopulation(),
  answersPerLearner = 30,
  seed = 20260925,
): LearnerRun[] {
  return population.map((learner, index) =>
    runSyntheticLearner(
      learner,
      currentBrainPolicy,
      answersPerLearner,
      mixSeed(seed, index + 1),
    ));
}

/**
 * Estimate independent/unaided ability in parallel with the production Brain.
 *
 * This state is deliberately shadow-only: it never changes question selection,
 * prediction, BKT, support routing or the production ability scalar.
 */
export function shadowAbilityBenchmark(
  runs: readonly LearnerRun[],
  weights: ShadowAbilityWeights,
  curveAt: readonly number[] = [2, 5, 10, 20, 30],
): ShadowAbilityBenchmark {
  const hintedWeight = clamp01(weights.hintedWeight);
  const rapidWeight = clamp01(weights.rapidWeight);

  const learnerErrors = runs.map((run) => {
    const skill = getSkill(run.learner.skillId);
    let ability = initialSkillState(run.learner.year, skill.typicalYear).ability;
    let effectiveAttempts = 0;
    const errors: number[] = [];

    for (const step of run.steps) {
      const reliability = step.rapid
        ? rapidWeight
        : step.hinted
          ? hintedWeight
          : 1;
      const expected = predictCorrect(
        ability,
        step.level,
        guessRate(step.level, skill.choices),
      );
      if (reliability > 0) {
        ability += kFactor(effectiveAttempts)
          * reliability
          * ((step.correct ? 1 : 0) - expected);
        effectiveAttempts += reliability;
      }
      errors.push(Math.abs(ability - run.learner.trueAbility));
    }

    return {
      errors,
      stableAt: stableAt(errors),
    };
  });

  const finalErrors = learnerErrors.map((item) => item.errors.at(-1) ?? 0);
  const stable = learnerErrors
    .map((item) => item.stableAt)
    .filter((value): value is number => value !== null);
  const answersPerLearner = runs[0]?.steps.length ?? 0;
  const points = [...new Set(curveAt)]
    .filter((answer) => answer > 0 && answer <= answersPerLearner)
    .sort((a, b) => a - b)
    .map((afterAnswers) => ({
      afterAnswers,
      abilityMae: mean(
        learnerErrors.map((item) => item.errors[Math.min(afterAnswers, item.errors.length) - 1] ?? 0),
      ),
    }));

  return {
    name: weights.name,
    learnerCount: runs.length,
    answersPerLearner,
    hintedWeight,
    rapidWeight,
    finalAbilityMae: mean(finalErrors),
    medianAnswersToStableEstimate: median(stable),
    stableEstimateRate: runs.length === 0 ? 0 : stable.length / runs.length,
    learningCurve: points,
  };
}

export function blendedAbilityBenchmark(
  runs: readonly LearnerRun[],
  config: BlendedAbilityConfig,
  curveAt: readonly number[] = [2, 5, 10, 20, 30],
): ShadowAbilityBenchmark {
  const hintedWeight = clamp01(config.hintedWeight);
  const rapidWeight = clamp01(config.rapidWeight);
  const shadowShare = clamp01(config.shadowShare);

  const learnerErrors = runs.map((run) => {
    const skill = getSkill(run.learner.skillId);
    let shadowAbility = initialSkillState(run.learner.year, skill.typicalYear).ability;
    let effectiveAttempts = 0;
    const errors: number[] = [];

    for (const step of run.steps) {
      const reliability = step.rapid
        ? rapidWeight
        : step.hinted
          ? hintedWeight
          : 1;
      const expected = predictCorrect(
        shadowAbility,
        step.level,
        guessRate(step.level, skill.choices),
      );
      if (reliability > 0) {
        shadowAbility += kFactor(effectiveAttempts)
          * reliability
          * ((step.correct ? 1 : 0) - expected);
        effectiveAttempts += reliability;
      }

      const estimate = shadowShare * shadowAbility
        + (1 - shadowShare) * step.abilityEstimate;
      errors.push(Math.abs(estimate - run.learner.trueAbility));
    }

    return { errors, stableAt: stableAt(errors) };
  });

  const finalErrors = learnerErrors.map((item) => item.errors.at(-1) ?? 0);
  const stable = learnerErrors
    .map((item) => item.stableAt)
    .filter((value): value is number => value !== null);
  const answersPerLearner = runs[0]?.steps.length ?? 0;
  const points = [...new Set(curveAt)]
    .filter((answer) => answer > 0 && answer <= answersPerLearner)
    .sort((a, b) => a - b)
    .map((afterAnswers) => ({
      afterAnswers,
      abilityMae: mean(
        learnerErrors.map((item) => item.errors[Math.min(afterAnswers, item.errors.length) - 1] ?? 0),
      ),
    }));

  return {
    name: config.name,
    learnerCount: runs.length,
    answersPerLearner,
    hintedWeight,
    rapidWeight,
    finalAbilityMae: mean(finalErrors),
    medianAnswersToStableEstimate: median(stable),
    stableEstimateRate: runs.length === 0 ? 0 : stable.length / runs.length,
    learningCurve: points,
  };
}

export const BLENDED_ABILITY_GRID: readonly BlendedAbilityConfig[] = [
  ...[0.75, 0.9, 1].flatMap((hintedWeight) =>
    [0, 0.05, 0.1].flatMap((rapidWeight) =>
      [0.25, 0.5, 0.75].map((shadowShare) => ({
        name: `blend-s${Math.round(shadowShare * 100)}-h${Math.round(hintedWeight * 100)}-r${Math.round(rapidWeight * 100)}`,
        hintedWeight,
        rapidWeight,
        shadowShare,
      })))),
] as const;

export function blendedAbilityGrid(
  runs: readonly LearnerRun[],
): ShadowAbilityBenchmark[] {
  return BLENDED_ABILITY_GRID.map((config) => blendedAbilityBenchmark(runs, config));
}

export const SHADOW_ABILITY_GRID: readonly ShadowAbilityWeights[] = [
  { name: 'clean-only', hintedWeight: 0, rapidWeight: 0 },
  ...[0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1].flatMap((hintedWeight) =>
    [0, 0.05, 0.1, 0.25, 0.5].map((rapidWeight) => ({
      name: `hinted-${Math.round(hintedWeight * 100)}-rapid-${Math.round(rapidWeight * 100)}`,
      hintedWeight,
      rapidWeight,
    }))),
] as const;

export function shadowAbilityGrid(
  runs: readonly LearnerRun[],
): ShadowAbilityBenchmark[] {
  return SHADOW_ABILITY_GRID.map((weights) => shadowAbilityBenchmark(runs, weights));
}
