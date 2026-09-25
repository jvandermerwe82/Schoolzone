import {
  guessRate,
  initialSkillState,
  isMastered,
  REVIEW_INTERVAL_MULTIPLIER,
  updateSkill,
} from '../brain/model';
import type { SkillState } from '../brain/types';
import { mixSeed, seededRng } from './rng';

const DAY = 86_400_000;

export interface HiddenRetentionLearner {
  id: string;
  year: number;
  typicalYear: number;
  /** Hidden starting memory half-life after mastery. */
  initialHalfLifeDays: number;
  /** How much a successful due review strengthens hidden retention. */
  successGrowth: number;
  /** How much a lapse weakens the hidden half-life before recovery. */
  lapsePenalty: number;
}

export interface RetentionLearnerRun {
  learner: HiddenRetentionLearner;
  days: number;
  reviews: number;
  successfulReviews: number;
  lapses: number;
  recoveryPractice: number;
  meanDailyRecallProbability: number;
  retentionCoverage70: number;
  finalRecallProbability: number;
  finalReviewIntervalDays: number;
  masteredAtEnd: boolean;
  maintenanceActions: number;
}

export interface RetentionBenchmark {
  learnerCount: number;
  horizonDays: number;
  meanDailyRecallProbability: number;
  retentionCoverage70: number;
  reviewSuccessRate: number;
  meanReviewsPerLearner: number;
  meanRecoveryPracticePerLearner: number;
  meanMaintenanceActionsPerLearner: number;
  lapseRate: number;
  meanFinalRecallProbability: number;
  medianFinalReviewIntervalDays: number | null;
  masteredAtEndRate: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Synthetic hidden recall curve. This is a lab assumption, not a claim about
 * an individual child. Different learners get different half-lives.
 */
export function hiddenRecallProbability(
  daysSinceReinforcement: number,
  halfLifeDays: number,
): number {
  const base = Math.pow(0.5, Math.max(0, daysSinceReinforcement) / Math.max(0.25, halfLifeDays));
  return clamp(0.08 + 0.9 * base, 0.08, 0.98);
}

export function retentionPopulation(size = 80): HiddenRetentionLearner[] {
  const halfLives = [1.5, 2, 2.5, 3.5, 5, 7] as const;
  const growth = [1.7, 1.9, 2.1, 2.3] as const;
  return Array.from({ length: size }, (_, index) => ({
    id: `retention-${index + 1}`,
    year: 6,
    typicalYear: 3,
    initialHalfLifeDays: halfLives[index % halfLives.length],
    successGrowth: growth[index % growth.length],
    lapsePenalty: 0.65 + (index % 4) * 0.05,
  }));
}

function masteredState(learner: HiddenRetentionLearner): SkillState {
  let state = initialSkillState(learner.year, learner.typicalYear);
  for (let i = 0; i < 12; i++) {
    state = updateSkill(
      state,
      4,
      true,
      guessRate(4),
      3000,
      0,
    );
  }
  if (!isMastered(state)) {
    throw new Error('Brain Lab retention setup failed to reach mastery.');
  }
  return state;
}

export function runRetentionLearner(
  learner: HiddenRetentionLearner,
  options: {
    horizonDays?: number;
    seed?: number;
    intervalMultiplier?: number;
  } = {},
): RetentionLearnerRun {
  const horizonDays = options.horizonDays ?? 60;
  const seed = options.seed ?? 20260925;
  const intervalMultiplier = options.intervalMultiplier ?? REVIEW_INTERVAL_MULTIPLIER;
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber, 0x7265746e));

  let state = masteredState(learner);
  let halfLifeDays = learner.initialHalfLifeDays;
  let lastReinforcedDay = 0;
  let reviews = 0;
  let successfulReviews = 0;
  let lapses = 0;
  let recoveryPractice = 0;
  let recallTotal = 0;
  let coverageDays = 0;

  for (let day = 1; day <= horizonDays; day++) {
    const now = day * DAY;
    const recall = hiddenRecallProbability(day - lastReinforcedDay, halfLifeDays);
    recallTotal += recall;
    if (recall >= 0.70) coverageDays++;

    if (state.nextReviewAt === null || now < state.nextReviewAt) continue;

    reviews++;
    const previousInterval = state.reviewIntervalDays;
    const correct = rng() < recall;
    state = updateSkill(
      state,
      4,
      correct,
      guessRate(4),
      3000,
      now,
    );

    if (correct) {
      successfulReviews++;
      halfLifeDays = Math.min(120, halfLifeDays * learner.successGrowth);
      lastReinforcedDay = day;

      // updateSkill() implements the production interval. Lab challengers
      // override only the next due interval so we can compare scheduling
      // policies without mutating production code.
      if (intervalMultiplier !== REVIEW_INTERVAL_MULTIPLIER && isMastered(state)) {
        const nextInterval = Math.min(
          60,
          Math.max(1, previousInterval * intervalMultiplier),
        );
        state = {
          ...state,
          reviewIntervalDays: nextInterval,
          nextReviewAt: now + nextInterval * DAY,
        };
      }
      continue;
    }

    lapses++;
    halfLifeDays = Math.max(0.5, halfLifeDays * learner.lapsePenalty);

    // A lapse returns the learner to active practice. Model a bounded recovery
    // cost using clean practice until the production mastery condition returns.
    for (let attempt = 0; attempt < 6 && !isMastered(state); attempt++) {
      recoveryPractice++;
      state = updateSkill(
        state,
        3,
        true,
        guessRate(3),
        3500,
        now + attempt + 1,
      );
      halfLifeDays = Math.min(120, halfLifeDays * 1.15);
      lastReinforcedDay = day;
    }
  }

  const finalRecallProbability = hiddenRecallProbability(
    horizonDays - lastReinforcedDay,
    halfLifeDays,
  );

  return {
    learner,
    days: horizonDays,
    reviews,
    successfulReviews,
    lapses,
    recoveryPractice,
    meanDailyRecallProbability: recallTotal / horizonDays,
    retentionCoverage70: coverageDays / horizonDays,
    finalRecallProbability,
    finalReviewIntervalDays: state.reviewIntervalDays,
    masteredAtEnd: isMastered(state),
    maintenanceActions: reviews + recoveryPractice,
  };
}

export function runRetentionBenchmark(
  options: {
    population?: HiddenRetentionLearner[];
    horizonDays?: number;
    seed?: number;
    intervalMultiplier?: number;
  } = {},
): RetentionBenchmark {
  const population = options.population ?? retentionPopulation();
  const horizonDays = options.horizonDays ?? 60;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runRetentionLearner(learner, {
      horizonDays,
      seed: mixSeed(seed, index + 1),
      intervalMultiplier: options.intervalMultiplier ?? REVIEW_INTERVAL_MULTIPLIER,
    }));

  const totalReviews = runs.reduce((sum, run) => sum + run.reviews, 0);
  const successful = runs.reduce((sum, run) => sum + run.successfulReviews, 0);
  const lapses = runs.reduce((sum, run) => sum + run.lapses, 0);

  return {
    learnerCount: runs.length,
    horizonDays,
    meanDailyRecallProbability: mean(runs.map((run) => run.meanDailyRecallProbability)),
    retentionCoverage70: mean(runs.map((run) => run.retentionCoverage70)),
    reviewSuccessRate: totalReviews === 0 ? 0 : successful / totalReviews,
    meanReviewsPerLearner: mean(runs.map((run) => run.reviews)),
    meanRecoveryPracticePerLearner: mean(runs.map((run) => run.recoveryPractice)),
    meanMaintenanceActionsPerLearner: mean(runs.map((run) => run.maintenanceActions)),
    lapseRate: totalReviews === 0 ? 0 : lapses / totalReviews,
    meanFinalRecallProbability: mean(runs.map((run) => run.finalRecallProbability)),
    medianFinalReviewIntervalDays: median(runs.map((run) => run.finalReviewIntervalDays)),
    masteredAtEndRate: mean(runs.map((run) => run.masteredAtEnd ? 1 : 0)),
  };
}


export interface RetentionScheduleChallenger {
  intervalMultiplier: number;
  benchmark: RetentionBenchmark;
  deltaVsCurrent: {
    retentionCoverage70: number;
    reviewSuccessRate: number;
    meanMaintenanceActionsPerLearner: number;
    lapseRate: number;
    meanFinalRecallProbability: number;
  };
}

export function retentionScheduleChallengers(
  population: HiddenRetentionLearner[],
  current: RetentionBenchmark,
  options: { horizonDays?: number; seed?: number } = {},
): RetentionScheduleChallenger[] {
  const horizonDays = options.horizonDays ?? 60;
  const seed = options.seed ?? 20260925;

  return [1.5, 1.75, 2, 2.25].map((intervalMultiplier) => {
    const benchmark = runRetentionBenchmark({
      population,
      horizonDays,
      seed,
      intervalMultiplier,
    });
    return {
      intervalMultiplier,
      benchmark,
      deltaVsCurrent: {
        retentionCoverage70:
          benchmark.retentionCoverage70 - current.retentionCoverage70,
        reviewSuccessRate:
          benchmark.reviewSuccessRate - current.reviewSuccessRate,
        meanMaintenanceActionsPerLearner:
          current.meanMaintenanceActionsPerLearner
          - benchmark.meanMaintenanceActionsPerLearner,
        lapseRate: current.lapseRate - benchmark.lapseRate,
        meanFinalRecallProbability:
          benchmark.meanFinalRecallProbability - current.meanFinalRecallProbability,
      },
    };
  });
}


export const RETENTION_LAB_THRESHOLDS = {
  minRetentionCoverage70: 0.75,
  minReviewSuccessRate: 0.45,
  maxLapseRate: 0.55,
  maxMaintenanceActionsPerLearner: 20,
  minFinalRecallProbability: 0.75,
  minMasteredAtEndRate: 0.98,
} as const;

export interface RetentionLabGate {
  pass: boolean;
  failures: string[];
}

export function evaluateRetentionLabGate(
  benchmark: RetentionBenchmark,
): RetentionLabGate {
  const failures: string[] = [];

  if (benchmark.retentionCoverage70 < RETENTION_LAB_THRESHOLDS.minRetentionCoverage70) {
    failures.push(
      `retention coverage ${benchmark.retentionCoverage70.toFixed(3)} is below ${RETENTION_LAB_THRESHOLDS.minRetentionCoverage70}`,
    );
  }
  if (benchmark.reviewSuccessRate < RETENTION_LAB_THRESHOLDS.minReviewSuccessRate) {
    failures.push(
      `review success rate ${benchmark.reviewSuccessRate.toFixed(3)} is below ${RETENTION_LAB_THRESHOLDS.minReviewSuccessRate}`,
    );
  }
  if (benchmark.lapseRate > RETENTION_LAB_THRESHOLDS.maxLapseRate) {
    failures.push(
      `lapse rate ${benchmark.lapseRate.toFixed(3)} exceeds ${RETENTION_LAB_THRESHOLDS.maxLapseRate}`,
    );
  }
  if (
    benchmark.meanMaintenanceActionsPerLearner
    > RETENTION_LAB_THRESHOLDS.maxMaintenanceActionsPerLearner
  ) {
    failures.push(
      `maintenance actions ${benchmark.meanMaintenanceActionsPerLearner.toFixed(3)} exceeds ${RETENTION_LAB_THRESHOLDS.maxMaintenanceActionsPerLearner}`,
    );
  }
  if (
    benchmark.meanFinalRecallProbability
    < RETENTION_LAB_THRESHOLDS.minFinalRecallProbability
  ) {
    failures.push(
      `final recall ${benchmark.meanFinalRecallProbability.toFixed(3)} is below ${RETENTION_LAB_THRESHOLDS.minFinalRecallProbability}`,
    );
  }
  if (benchmark.masteredAtEndRate < RETENTION_LAB_THRESHOLDS.minMasteredAtEndRate) {
    failures.push(
      `mastered-at-end rate ${benchmark.masteredAtEndRate.toFixed(3)} is below ${RETENTION_LAB_THRESHOLDS.minMasteredAtEndRate}`,
    );
  }

  return { pass: failures.length === 0, failures };
}
