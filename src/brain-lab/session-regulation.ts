import { recordEngagementSignal } from '../brain/learning-intelligence';
import {
  DEFAULT_MISSION_LENGTH,
  sessionPolicy,
} from '../brain/session-policy';
import type { Profile, SubjectId } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';

export interface HiddenSessionLearner {
  id: string;
  year: number;
  subject: SubjectId;
  /** Position after which sustained attention/learning quality starts to fall. */
  fatigueAfter: number;
  baseCorrectProbability: number;
  fatigueCorrectPenalty: number;
  baseRapidProbability: number;
  fatigueRapidIncrease: number;
  /** Probability of choosing to stop on each question after fatigue begins. */
  stopHazardAfterFatigue: number;
}

export type SessionRegulationPolicy = 'adaptive' | 'fixed-10';

export interface SessionMissionResult {
  mission: number;
  plannedLength: number;
  answered: number;
  completed: boolean;
  correct: number;
  usefulCorrect: number;
  rapidGuesses: number;
  stoppedAt: number | null;
  policySource: string;
}

export interface SessionLearnerRun {
  learner: HiddenSessionLearner;
  policy: SessionRegulationPolicy;
  missions: SessionMissionResult[];
  questionsAnswered: number;
  usefulCorrect: number;
  usefulLearningRate: number;
  rapidGuessRate: number;
  earlyStopRate: number;
  missionCompletionRate: number;
  meanPlannedMissionLength: number;
  finalPlannedMissionLength: number;
  distanceFromFatigueThreshold: number;
}

export interface SessionRegulationBenchmark {
  policy: SessionRegulationPolicy;
  learnerCount: number;
  missionsPerLearner: number;
  meanQuestionsAnswered: number;
  meanUsefulCorrect: number;
  usefulLearningRate: number;
  rapidGuessRate: number;
  earlyStopRate: number;
  missionCompletionRate: number;
  meanPlannedMissionLength: number;
  meanDistanceFromFatigueThreshold: number;
  withinOneOfFatigueThresholdRate: number;
}

export interface SessionRegulationComparison {
  adaptive: SessionRegulationBenchmark;
  fixed10: SessionRegulationBenchmark;
  delta: {
    usefulLearningRate: number;
    rapidGuessRate: number;
    earlyStopRate: number;
    missionCompletionRate: number;
    meanUsefulCorrect: number;
    meanDistanceFromFatigueThreshold: number;
  };
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function sessionRegulationPopulation(size = 120): HiddenSessionLearner[] {
  const fatigue = [5, 6, 7, 8, 9, 10] as const;
  const subjects: SubjectId[] = ['maths', 'english', 'science'];

  return Array.from({ length: size }, (_, index) => ({
    id: `session-${index + 1}`,
    year: 6,
    subject: subjects[index % subjects.length],
    fatigueAfter: fatigue[index % fatigue.length],
    baseCorrectProbability: 0.78 + (index % 4) * 0.035,
    fatigueCorrectPenalty: 0.08 + (index % 3) * 0.025,
    baseRapidProbability: 0.01 + (index % 3) * 0.005,
    fatigueRapidIncrease: 0.10 + (index % 4) * 0.025,
    stopHazardAfterFatigue: 0.10 + (index % 4) * 0.05,
  }));
}

const questionOutcome = (
  learner: HiddenSessionLearner,
  position: number,
  rng: () => number,
): { correct: boolean; rapid: boolean; stop: boolean } => {
  const beyond = Math.max(0, position - learner.fatigueAfter);
  const fatigued = beyond > 0;
  const rapidProbability = clamp01(
    learner.baseRapidProbability + (fatigued ? learner.fatigueRapidIncrease * beyond : 0),
  );
  const rapid = rng() < rapidProbability;
  const correctProbability = clamp01(
    learner.baseCorrectProbability - (fatigued ? learner.fatigueCorrectPenalty * beyond : 0),
  );
  const correct = !rapid && rng() < correctProbability;
  const stop = fatigued && rng() < clamp01(
    learner.stopHazardAfterFatigue * beyond,
  );
  return { correct, rapid, stop };
};

const missionLengthFor = (
  policy: SessionRegulationPolicy,
  profile: Profile,
  subject: SubjectId,
  now: number,
): { missionLength: number; source: string } => {
  if (policy === 'fixed-10') {
    return { missionLength: DEFAULT_MISSION_LENGTH, source: 'fixed-10' };
  }
  const selected = sessionPolicy(profile, subject, now);
  return { missionLength: selected.missionLength, source: selected.source };
};

export function runSessionLearner(
  learner: HiddenSessionLearner,
  policy: SessionRegulationPolicy,
  options: { missions?: number; seed?: number } = {},
): SessionLearnerRun {
  const missions = options.missions ?? 12;
  const seed = options.seed ?? 20260925;
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  let profile = newProfile(learner.id, '🧪', learner.year);
  const results: SessionMissionResult[] = [];

  for (let mission = 1; mission <= missions; mission++) {
    const now = mission * 86_400_000;
    const selected = missionLengthFor(policy, profile, learner.subject, now);
    const rng = seededRng(mixSeed(seed, idNumber, mission, policy === 'adaptive' ? 0x61646170 : 0x66697831));

    let correct = 0;
    let usefulCorrect = 0;
    let rapidGuesses = 0;
    let stoppedAt: number | null = null;
    let answered = 0;

    for (let position = 1; position <= selected.missionLength; position++) {
      const outcome = questionOutcome(learner, position, rng);
      answered++;
      if (outcome.correct) {
        correct++;
        if (position <= learner.fatigueAfter) usefulCorrect++;
      }
      if (outcome.rapid) {
        rapidGuesses++;
        profile = {
          ...profile,
          learningIntelligence: recordEngagementSignal(profile.learningIntelligence!, {
            kind: 'rapid-guess',
            at: now + position,
            subject: learner.subject,
            value: position,
          }),
        };
      }
      if (outcome.stop && position < selected.missionLength) {
        stoppedAt = position;
        profile = {
          ...profile,
          learningIntelligence: recordEngagementSignal(profile.learningIntelligence!, {
            kind: 'stopped-session',
            at: now + position,
            subject: learner.subject,
            value: position,
          }),
        };
        break;
      }
    }

    results.push({
      mission,
      plannedLength: selected.missionLength,
      answered,
      completed: stoppedAt === null,
      correct,
      usefulCorrect,
      rapidGuesses,
      stoppedAt,
      policySource: selected.source,
    });
  }

  const questionsAnswered = results.reduce((sum, result) => sum + result.answered, 0);
  const usefulCorrect = results.reduce((sum, result) => sum + result.usefulCorrect, 0);
  const rapidGuesses = results.reduce((sum, result) => sum + result.rapidGuesses, 0);
  const earlyStops = results.filter((result) => result.stoppedAt !== null).length;
  const meanPlannedMissionLength = mean(results.map((result) => result.plannedLength));
  const finalPlannedMissionLength = results.at(-1)?.plannedLength ?? DEFAULT_MISSION_LENGTH;

  return {
    learner,
    policy,
    missions: results,
    questionsAnswered,
    usefulCorrect,
    usefulLearningRate: questionsAnswered === 0 ? 0 : usefulCorrect / questionsAnswered,
    rapidGuessRate: questionsAnswered === 0 ? 0 : rapidGuesses / questionsAnswered,
    earlyStopRate: missions === 0 ? 0 : earlyStops / missions,
    missionCompletionRate: missions === 0 ? 0 : (missions - earlyStops) / missions,
    meanPlannedMissionLength,
    finalPlannedMissionLength,
    distanceFromFatigueThreshold:
      Math.abs(finalPlannedMissionLength - learner.fatigueAfter),
  };
}

export function runSessionRegulationBenchmark(
  policy: SessionRegulationPolicy,
  options: {
    population?: HiddenSessionLearner[];
    missionsPerLearner?: number;
    seed?: number;
  } = {},
): SessionRegulationBenchmark {
  const population = options.population ?? sessionRegulationPopulation();
  const missionsPerLearner = options.missionsPerLearner ?? 12;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runSessionLearner(learner, policy, {
      missions: missionsPerLearner,
      seed: mixSeed(seed, index + 1),
    }));

  const totalAnswered = runs.reduce((sum, run) => sum + run.questionsAnswered, 0);
  const totalUseful = runs.reduce((sum, run) => sum + run.usefulCorrect, 0);
  const totalRapid = runs.reduce(
    (sum, run) => sum + run.missions.reduce((inner, mission) => inner + mission.rapidGuesses, 0),
    0,
  );
  const totalStops = runs.reduce(
    (sum, run) => sum + run.missions.filter((mission) => mission.stoppedAt !== null).length,
    0,
  );
  const totalMissions = runs.length * missionsPerLearner;

  return {
    policy,
    learnerCount: runs.length,
    missionsPerLearner,
    meanQuestionsAnswered: mean(runs.map((run) => run.questionsAnswered)),
    meanUsefulCorrect: mean(runs.map((run) => run.usefulCorrect)),
    usefulLearningRate: totalAnswered === 0 ? 0 : totalUseful / totalAnswered,
    rapidGuessRate: totalAnswered === 0 ? 0 : totalRapid / totalAnswered,
    earlyStopRate: totalMissions === 0 ? 0 : totalStops / totalMissions,
    missionCompletionRate: totalMissions === 0 ? 0 : (totalMissions - totalStops) / totalMissions,
    meanPlannedMissionLength: mean(runs.map((run) => run.meanPlannedMissionLength)),
    meanDistanceFromFatigueThreshold: mean(runs.map((run) => run.distanceFromFatigueThreshold)),
    withinOneOfFatigueThresholdRate:
      runs.length === 0
        ? 0
        : runs.filter((run) => run.distanceFromFatigueThreshold <= 1).length / runs.length,
  };
}

export function compareSessionRegulation(
  options: {
    population?: HiddenSessionLearner[];
    missionsPerLearner?: number;
    seed?: number;
  } = {},
): SessionRegulationComparison {
  const population = options.population ?? sessionRegulationPopulation();
  const missionsPerLearner = options.missionsPerLearner ?? 12;
  const seed = options.seed ?? 20260925;
  const adaptive = runSessionRegulationBenchmark('adaptive', {
    population,
    missionsPerLearner,
    seed,
  });
  const fixed10 = runSessionRegulationBenchmark('fixed-10', {
    population,
    missionsPerLearner,
    seed,
  });

  return {
    adaptive,
    fixed10,
    delta: {
      usefulLearningRate: adaptive.usefulLearningRate - fixed10.usefulLearningRate,
      rapidGuessRate: fixed10.rapidGuessRate - adaptive.rapidGuessRate,
      earlyStopRate: fixed10.earlyStopRate - adaptive.earlyStopRate,
      missionCompletionRate: adaptive.missionCompletionRate - fixed10.missionCompletionRate,
      meanUsefulCorrect: adaptive.meanUsefulCorrect - fixed10.meanUsefulCorrect,
      meanDistanceFromFatigueThreshold:
        fixed10.meanDistanceFromFatigueThreshold - adaptive.meanDistanceFromFatigueThreshold,
    },
  };
}
