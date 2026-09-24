import { getSkill } from '../content/skills';
import { chooseLevel, planNext, recordAnswer, skillState, TARGET_SUCCESS } from '../brain/tutor';
import type { Profile, Question } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';
import { hiddenSuccessProbability, syntheticPopulation } from './synthetic';
import type {
  BenchmarkComparison,
  BrainBenchmark,
  HiddenLearner,
  LabDecision,
  LabPolicy,
  LabStep,
  LearnerRun,
  LearningCurvePoint,
} from './types';

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const strategyHinted = (decision: LabDecision) =>
  decision.hinted || decision.strategy === 'hint' || decision.strategy === 'worked-example';

export const currentBrainPolicy: LabPolicy = (profile, learner, step, now, rng) => {
  const skill = getSkill(learner.skillId);
  const plan = planNext(
    profile,
    skill.subject,
    { focus: learner.skillId, answered: step, strictFocus: true },
    now,
    rng,
  );
  return {
    level: plan.level,
    strategy: plan.strategy,
    hinted: !!plan.showHint || !!plan.workedExample,
    diagnostic: !!plan.diagnostic,
  };
};

/** Simple reference point, not a claim about a historical SchoolZone version. */
export const staticMidlevelPolicy: LabPolicy = () => ({ level: 3 });

/** Adaptive 80% level selection without help/diagnostic orchestration. */
export const adaptive80Policy: LabPolicy = (profile, learner) => {
  const skill = getSkill(learner.skillId);
  return {
    level: chooseLevel(
      skillState(profile, learner.skillId),
      TARGET_SUCCESS,
      skill.choices,
    ),
  };
};

const labQuestion = (learner: HiddenLearner, decision: LabDecision, index: number): Question => {
  const choices = getSkill(learner.skillId).choices;
  return {
    id: `lab:${learner.id}:${index}`,
    skillId: learner.skillId,
    level: decision.level,
    prompt: 'Synthetic Brain Lab item',
    answer: '1',
    ...(choices ? { choices: Array.from({ length: choices }, (_, i) => String(i + 1)) } : {}),
    explanation: 'Synthetic benchmark item.',
  };
};

const stableEstimateAt = (steps: readonly LabStep[], threshold = 0.6, window = 3): number | null => {
  for (let i = 0; i <= steps.length - window; i++) {
    if (steps.slice(i, i + window).every((step) => step.abilityError <= threshold)) return i + 1;
  }
  return null;
};

export function runSyntheticLearner(
  learner: HiddenLearner,
  policy: LabPolicy,
  answers = 30,
  seed = 1,
): LearnerRun {
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber));
  let profile: Profile = newProfile(learner.id, '🧪', learner.year);
  const steps: LabStep[] = [];

  for (let index = 0; index < answers; index++) {
    const now = index * 60_000;
    const decision = policy(profile, learner, index, now, rng);
    const trueProbability = hiddenSuccessProbability(learner, decision);
    const rapid = rng() < learner.rapidRate;
    const correct = rapid ? false : rng() < trueProbability;
    const question = labQuestion(learner, decision, index);
    const result = recordAnswer(
      profile,
      question,
      correct,
      rapid ? 250 : 3500,
      now,
      {
        hinted: strategyHinted(decision),
        strategy: decision.strategy,
      },
    );
    profile = result.profile;
    const abilityEstimate = skillState(profile, learner.skillId).ability;
    steps.push({
      index: index + 1,
      level: decision.level,
      strategy: decision.strategy ?? null,
      diagnostic: !!decision.diagnostic,
      predicted: result.predicted,
      trueProbability,
      correct,
      rapid,
      abilityEstimate,
      abilityError: Math.abs(abilityEstimate - learner.trueAbility),
      brier: (result.predicted - (correct ? 1 : 0)) ** 2,
    });
  }

  return {
    learner,
    steps,
    finalAbilityError: steps.at(-1)?.abilityError
      ?? Math.abs(skillState(profile, learner.skillId).ability - learner.trueAbility),
    meanBrier: mean(steps.map((step) => step.brier)),
    calibrationGap: Math.abs(
      mean(steps.map((step) => step.predicted))
      - mean(steps.map((step) => step.correct ? 1 : 0)),
    ),
    successRate: mean(steps.map((step) => step.correct ? 1 : 0)),
    answersToStableEstimate: stableEstimateAt(steps),
  };
}

const curvePoint = (runs: readonly LearnerRun[], afterAnswers: number): LearningCurvePoint => {
  const finalSteps = runs
    .map((run) => run.steps[Math.min(afterAnswers, run.steps.length) - 1])
    .filter((step): step is LabStep => !!step);
  const allPrefix = runs.flatMap((run) => run.steps.slice(0, afterAnswers));
  return {
    afterAnswers,
    abilityMae: mean(finalSteps.map((step) => step.abilityError)),
    predictionBrier: mean(allPrefix.map((step) => step.brier)),
    calibrationGap: Math.abs(
      mean(allPrefix.map((step) => step.predicted))
      - mean(allPrefix.map((step) => step.correct ? 1 : 0)),
    ),
  };
};

export function runBenchmark(
  policyName: string,
  policy: LabPolicy,
  options: {
    population?: HiddenLearner[];
    answersPerLearner?: number;
    seed?: number;
    curveAt?: number[];
  } = {},
): BrainBenchmark {
  const population = options.population ?? syntheticPopulation();
  const answersPerLearner = options.answersPerLearner ?? 30;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runSyntheticLearner(learner, policy, answersPerLearner, mixSeed(seed, index + 1)));
  const stable = runs
    .map((run) => run.answersToStableEstimate)
    .filter((value): value is number => value !== null);
  const curveAt = (options.curveAt ?? [2, 5, 10, 20, answersPerLearner])
    .filter((value, index, all) =>
      value > 0 && value <= answersPerLearner && all.indexOf(value) === index)
    .sort((a, b) => a - b);
  const allSteps = runs.flatMap((run) => run.steps);

  return {
    policy: policyName,
    learnerCount: population.length,
    answersPerLearner,
    finalAbilityMae: mean(runs.map((run) => run.finalAbilityError)),
    meanPredictionBrier: mean(runs.map((run) => run.meanBrier)),
    calibrationGap: Math.abs(
      mean(allSteps.map((step) => step.predicted))
      - mean(allSteps.map((step) => step.correct ? 1 : 0)),
    ),
    successRate: mean(runs.map((run) => run.successRate)),
    medianAnswersToStableEstimate: median(stable),
    stableEstimateRate: stable.length / runs.length,
    learningCurve: curveAt.map((after) => curvePoint(runs, after)),
  };
}

export function compareBenchmarks(
  champion: BrainBenchmark,
  challenger: BrainBenchmark,
): BenchmarkComparison {
  const medianDelta =
    champion.medianAnswersToStableEstimate === null || challenger.medianAnswersToStableEstimate === null
      ? null
      : challenger.medianAnswersToStableEstimate - champion.medianAnswersToStableEstimate;
  return {
    champion,
    challenger,
    delta: {
      /** Positive means champion is better because error is lower. */
      finalAbilityMae: challenger.finalAbilityMae - champion.finalAbilityMae,
      meanPredictionBrier: challenger.meanPredictionBrier - champion.meanPredictionBrier,
      calibrationGap: challenger.calibrationGap - champion.calibrationGap,
      medianAnswersToStableEstimate: medianDelta,
    },
  };
}
