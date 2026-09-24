import { ACTIVE } from '../brain/misconceptions';
import { recordAnswer } from '../brain/tutor';
import type { Profile, Question } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';

interface MisconceptionScenario {
  id: string;
  skillId: string;
  answer: string;
  bugAnswer: string;
  genericWrong: string;
  prompt: string;
}

const SCENARIOS: readonly MisconceptionScenario[] = [
  {
    id: 'frac-add-across',
    skillId: 'fractions-y6',
    answer: '3/4',
    bugAnswer: '2/6',
    genericWrong: '1/4',
    prompt: '1/2 + 1/4 = ?',
  },
  {
    id: 'mult-added',
    skillId: 'multiplication',
    answer: '24',
    bugAnswer: '10',
    genericWrong: '18',
    prompt: '6 × 4 = ?',
  },
  {
    id: 'neg-sign',
    skillId: 'negative-numbers',
    answer: '-3',
    bugAnswer: '3',
    genericWrong: '-2',
    prompt: '-1 - 2 = ?',
  },
] as const;

export interface HiddenMisconceptionLearner {
  id: string;
  year: number;
  scenario: MisconceptionScenario;
  hasMisconception: boolean;
  /** Probability of using the wrong rule before the recovery phase. */
  applyRate: number;
  /** Chance a learner without the misconception happens to give that bug answer. */
  accidentalBugRate: number;
  /** Other wrong answers that should not trigger this misconception. */
  genericSlipRate: number;
}

export interface MisconceptionStep {
  exposure: number;
  phase: 'detect' | 'recover';
  answerType: 'correct' | 'bug' | 'other-wrong';
  active: boolean;
  strength: number;
  fixed: boolean;
}

export interface MisconceptionLearnerRun {
  learner: HiddenMisconceptionLearner;
  steps: MisconceptionStep[];
  firstActiveExposure: number | null;
  activeByDetectionEnd: boolean;
  everActive: boolean;
  firstFixedRecoveryExposure: number | null;
  fixedByEnd: boolean;
  activeAtEnd: boolean;
}

export interface MisconceptionBenchmark {
  learnerCount: number;
  hiddenCount: number;
  controlCount: number;
  detectionExposures: number;
  recoveryExposures: number;
  detectionRecall: number;
  detectionPrecision: number;
  falsePositiveRate: number;
  medianDetectionExposure: number | null;
  recoveryResolutionRate: number;
  medianRecoveryExposuresToClear: number | null;
  lingeringActiveRate: number;
}

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

export function misconceptionPopulation(size = 120): HiddenMisconceptionLearner[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `misconception-${index + 1}`,
    year: 6,
    scenario: SCENARIOS[index % SCENARIOS.length],
    hasMisconception: index % 2 === 0,
    applyRate: 0.68 + (index % 4) * 0.06,
    accidentalBugRate: 0.02 + (index % 3) * 0.01,
    genericSlipRate: 0.08 + (index % 4) * 0.015,
  }));
}

const questionFor = (
  learner: HiddenMisconceptionLearner,
  exposure: number,
): Question => ({
  id: `brain-lab:${learner.id}:${exposure}`,
  skillId: learner.scenario.skillId,
  level: 3,
  prompt: learner.scenario.prompt,
  answer: learner.scenario.answer,
  explanation: 'Synthetic misconception benchmark item.',
  bugs: [[learner.scenario.id, learner.scenario.bugAnswer]],
});

const answerType = (
  learner: HiddenMisconceptionLearner,
  phase: 'detect' | 'recover',
  rng: () => number,
): 'correct' | 'bug' | 'other-wrong' => {
  const roll = rng();

  if (learner.hasMisconception && phase === 'detect') {
    if (roll < learner.applyRate) return 'bug';
    if (roll < learner.applyRate + learner.genericSlipRate) return 'other-wrong';
    return 'correct';
  }

  const bugRate = learner.hasMisconception
    ? Math.min(0.02, learner.accidentalBugRate)
    : learner.accidentalBugRate;
  const genericSlipRate = learner.hasMisconception
    ? Math.min(0.08, learner.genericSlipRate)
    : learner.genericSlipRate;

  if (roll < bugRate) return 'bug';
  if (roll < bugRate + genericSlipRate) return 'other-wrong';
  return 'correct';
};

const givenFor = (
  learner: HiddenMisconceptionLearner,
  type: MisconceptionStep['answerType'],
): string => {
  if (type === 'bug') return learner.scenario.bugAnswer;
  if (type === 'other-wrong') return learner.scenario.genericWrong;
  return learner.scenario.answer;
};

export function runMisconceptionLearner(
  learner: HiddenMisconceptionLearner,
  options: {
    detectionExposures?: number;
    recoveryExposures?: number;
    seed?: number;
  } = {},
): MisconceptionLearnerRun {
  const detectionExposures = options.detectionExposures ?? 6;
  const recoveryExposures = options.recoveryExposures ?? 4;
  const seed = options.seed ?? 20260925;
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber, 0x6d697363));
  let profile: Profile = newProfile(learner.id, '🧪', learner.year);
  const steps: MisconceptionStep[] = [];
  let firstActiveExposure: number | null = null;
  let firstFixedRecoveryExposure: number | null = null;

  const total = detectionExposures + recoveryExposures;
  for (let index = 0; index < total; index++) {
    const exposure = index + 1;
    const phase: MisconceptionStep['phase'] =
      exposure <= detectionExposures ? 'detect' : 'recover';
    const type = answerType(learner, phase, rng);
    const question = questionFor(learner, exposure);
    const correct = type === 'correct';
    const result = recordAnswer(
      profile,
      question,
      correct,
      3500,
      exposure * 60_000,
      { given: givenFor(learner, type) },
    );
    profile = result.profile;

    const state = profile.misconceptions[learner.scenario.id];
    const strength = state?.strength ?? 0;
    const active = strength >= ACTIVE;
    const fixed = !!state?.fixedAt;

    if (active && firstActiveExposure === null) firstActiveExposure = exposure;
    if (
      phase === 'recover'
      && fixed
      && firstFixedRecoveryExposure === null
    ) {
      firstFixedRecoveryExposure = exposure - detectionExposures;
    }

    steps.push({
      exposure,
      phase,
      answerType: type,
      active,
      strength,
      fixed,
    });
  }

  const activeByDetectionEnd =
    steps[detectionExposures - 1]?.active ?? false;
  const everActive = firstActiveExposure !== null;
  const activeAtEnd = steps.at(-1)?.active ?? false;

  return {
    learner,
    steps,
    firstActiveExposure,
    activeByDetectionEnd,
    everActive,
    firstFixedRecoveryExposure,
    fixedByEnd: firstFixedRecoveryExposure !== null,
    activeAtEnd,
  };
}

export function runMisconceptionBenchmark(
  options: {
    population?: HiddenMisconceptionLearner[];
    detectionExposures?: number;
    recoveryExposures?: number;
    seed?: number;
  } = {},
): MisconceptionBenchmark {
  const population = options.population ?? misconceptionPopulation();
  const detectionExposures = options.detectionExposures ?? 6;
  const recoveryExposures = options.recoveryExposures ?? 4;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runMisconceptionLearner(learner, {
      detectionExposures,
      recoveryExposures,
      seed: mixSeed(seed, index + 1),
    }));

  const hidden = runs.filter((run) => run.learner.hasMisconception);
  const controls = runs.filter((run) => !run.learner.hasMisconception);
  const trueDetected = hidden.filter((run) => run.activeByDetectionEnd);
  const controlActivated = controls.filter((run) =>
    run.steps
      .slice(0, detectionExposures)
      .some((step) => step.active));

  const detectedAll = trueDetected.length + controlActivated.length;
  const resolved = trueDetected.filter((run) => run.fixedByEnd);
  const detectionTimes = trueDetected
    .map((run) => run.firstActiveExposure)
    .filter((value): value is number => value !== null);
  const recoveryTimes = resolved
    .map((run) => run.firstFixedRecoveryExposure)
    .filter((value): value is number => value !== null);

  return {
    learnerCount: runs.length,
    hiddenCount: hidden.length,
    controlCount: controls.length,
    detectionExposures,
    recoveryExposures,
    detectionRecall: hidden.length === 0 ? 0 : trueDetected.length / hidden.length,
    detectionPrecision: detectedAll === 0 ? 1 : trueDetected.length / detectedAll,
    falsePositiveRate:
      controls.length === 0 ? 0 : controlActivated.length / controls.length,
    medianDetectionExposure: median(detectionTimes),
    recoveryResolutionRate:
      trueDetected.length === 0 ? 0 : resolved.length / trueDetected.length,
    medianRecoveryExposuresToClear: median(recoveryTimes),
    lingeringActiveRate:
      hidden.length === 0
        ? 0
        : mean(hidden.map((run) => run.activeAtEnd ? 1 : 0)),
  };
}
