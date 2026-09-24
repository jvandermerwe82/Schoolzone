import type { Level, StrategyId } from '../brain/types';

export interface HiddenLearner {
  id: string;
  year: number;
  skillId: string;
  /** Latent ability the Brain is trying to recover. */
  trueAbility: number;
  /** Independent chance of an otherwise-correct answer becoming a slip. */
  carelessRate: number;
  /** Chance of a non-informative rapid wrong response. */
  rapidRate: number;
  /** Hidden intervention that most improves this learner's success. */
  preferredStrategy: StrategyId;
  preferredSupportBoost: number;
  otherSupportBoost: number;
}

export interface LabDecision {
  level: Level;
  strategy?: StrategyId | 'climb';
  hinted?: boolean;
  diagnostic?: boolean;
}

export type LabPolicy = (
  profile: import('../brain/types').Profile,
  learner: HiddenLearner,
  step: number,
  now: number,
  rng: () => number,
) => LabDecision;

export interface LabStep {
  index: number;
  level: Level;
  strategy: StrategyId | 'climb' | null;
  diagnostic: boolean;
  predicted: number;
  trueProbability: number;
  correct: boolean;
  hinted: boolean;
  rapid: boolean;
  abilityEstimate: number;
  abilityError: number;
  brier: number;
}

export interface LearnerRun {
  learner: HiddenLearner;
  steps: LabStep[];
  finalAbilityError: number;
  meanBrier: number;
  calibrationGap: number;
  successRate: number;
  answersToStableEstimate: number | null;
}

export interface LearningCurvePoint {
  afterAnswers: number;
  abilityMae: number;
  predictionBrier: number;
  calibrationGap: number;
}

export interface BrainBenchmark {
  policy: string;
  learnerCount: number;
  answersPerLearner: number;
  finalAbilityMae: number;
  meanPredictionBrier: number;
  calibrationGap: number;
  successRate: number;
  medianAnswersToStableEstimate: number | null;
  stableEstimateRate: number;
  learningCurve: LearningCurvePoint[];
}

export interface BenchmarkComparison {
  champion: BrainBenchmark;
  challenger: BrainBenchmark;
  delta: {
    finalAbilityMae: number;
    meanPredictionBrier: number;
    calibrationGap: number;
    medianAnswersToStableEstimate: number | null;
  };
}
