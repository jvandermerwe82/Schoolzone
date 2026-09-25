import { planNext, recordAnswer } from '../brain/tutor';
import type { Level, Profile, Question, StrategyId, SubjectId } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';

const SKILL_ID = 'number-sense';
const SUBJECT: SubjectId = 'maths';
const STUCK_LEVEL: Level = 4;

export type ScaffoldFadePolicy = 'current' | 'two-supported' | 'three-supported';

export interface HiddenScaffoldLearner {
  id: string;
  year: number;
  /** Latent chance of unaided success at the original stuck level. */
  initialIndependentStrength: number;
  /** Temporary boost while a scaffold is active. */
  supportBoost: number;
  /** How much a successful supported attempt transfers to independent skill. */
  supportTransferRate: number;
  /** Learning from successful unaided attempts during the climb. */
  independentLearnRate: number;
  slipRate: number;
}

export interface ScaffoldEpisodeRun {
  learner: HiddenScaffoldLearner;
  policy: ScaffoldFadePolicy;
  resolved: boolean;
  turns: number;
  supportQuestions: number;
  unaidedQuestions: number;
  supportedCorrect: number;
  strategySwitches: number;
  firstFadeTurn: number | null;
  independentProbabilityAtFirstFade: number | null;
  prematureFade: boolean;
  overSupportQuestions: number;
  independentStrengthAtResolution: number | null;
  resolutionReady: boolean;
  postResolutionSuccessRate: number;
  postResolutionAllCorrect: boolean;
  relapsedImmediately: boolean;
}

export interface ScaffoldFadeBenchmark {
  policy: ScaffoldFadePolicy;
  learnerCount: number;
  maxTurns: number;
  resolutionRate: number;
  medianTurnsToResolution: number | null;
  meanSupportQuestions: number;
  meanUnaidedQuestions: number;
  prematureFadeRate: number;
  meanOverSupportQuestions: number;
  resolutionReadinessPrecision: number;
  meanIndependentStrengthAtResolution: number;
  postResolutionSuccessRate: number;
  postResolutionAllCorrectRate: number;
  immediateRelapseRate: number;
}

export interface ScaffoldFadeComparison {
  current: ScaffoldFadeBenchmark;
  twoSupported: ScaffoldFadeBenchmark;
  threeSupported: ScaffoldFadeBenchmark;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
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

export function scaffoldFadePopulation(size = 120): HiddenScaffoldLearner[] {
  const transfer = [0.14, 0.20, 0.28, 0.38, 0.52] as const;
  return Array.from({ length: size }, (_, index) => ({
    id: `scaffold-${index + 1}`,
    year: 6,
    initialIndependentStrength: 0.20 + (index % 5) * 0.055,
    supportBoost: 0.28 + (index % 4) * 0.045,
    supportTransferRate: transfer[index % transfer.length],
    independentLearnRate: 0.13 + (index % 4) * 0.025,
    slipRate: 0.02 + (index % 3) * 0.015,
  }));
}

const independentProbability = (
  learner: HiddenScaffoldLearner,
  strength: number,
  level: Level,
): number => {
  const easierBoost = (STUCK_LEVEL - level) * 0.08;
  return clamp01((0.08 + 0.88 * strength + easierBoost) * (1 - learner.slipRate));
};

const supportedProbability = (
  learner: HiddenScaffoldLearner,
  strength: number,
  level: Level,
): number => clamp01(
  independentProbability(learner, strength, level) + learner.supportBoost,
);

const labQuestion = (level: Level, turn: number): Question => ({
  id: `scaffold:${turn}:${level}`,
  skillId: SKILL_ID,
  level,
  prompt: 'Synthetic scaffold-fading question',
  answer: '1',
  explanation: 'Synthetic scaffold-fading benchmark item.',
});

const strategyIsSupport = (strategy: StrategyId | 'climb' | undefined): strategy is StrategyId =>
  !!strategy && strategy !== 'climb';

const requiredSupportedSuccesses = (policy: ScaffoldFadePolicy): number => {
  if (policy === 'two-supported') return 2;
  if (policy === 'three-supported') return 3;
  return 1;
};

const holdScaffold = (
  profile: Profile,
  previousPhase: StrategyId,
): Profile => {
  const episode = profile.help.episode;
  if (!episode) return profile;
  return {
    ...profile,
    help: {
      ...profile.help,
      episode: {
        ...episode,
        phase: previousPhase,
        helpedBy: null,
      },
    },
  };
};

export function runScaffoldEpisode(
  learner: HiddenScaffoldLearner,
  policy: ScaffoldFadePolicy,
  options: {
    maxTurns?: number;
    postResolutionProbes?: number;
    seed?: number;
  } = {},
): ScaffoldEpisodeRun {
  const maxTurns = options.maxTurns ?? 18;
  const postResolutionProbes = options.postResolutionProbes ?? 4;
  const seed = options.seed ?? 20260925;
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;

  let profile = newProfile(learner.id, '🧪', learner.year);
  let strength = learner.initialIndependentStrength;
  let supportQuestions = 0;
  let unaidedQuestions = 0;
  let supportedCorrect = 0;
  let strategySwitches = 0;
  let firstFadeTurn: number | null = null;
  let independentProbabilityAtFirstFade: number | null = null;
  let overSupportQuestions = 0;
  let independentStrengthAtResolution: number | null = null;
  let resolved = false;
  let turns = 0;

  // Force the initial stuck episode at the target level.
  const initial = labQuestion(STUCK_LEVEL, 0);
  profile = recordAnswer(
    profile,
    initial,
    false,
    3500,
    0,
    { given: 'wrong' },
  ).profile;

  const supportSuccessByStrategy: Partial<Record<StrategyId, number>> = {};
  let previousEpisodePhase = profile.help.episode?.phase ?? null;

  for (let turn = 1; turn <= maxTurns && profile.help.episode; turn++) {
    turns = turn;
    const plan = planNext(
      profile,
      SUBJECT,
      { focus: SKILL_ID, answered: turn },
      turn * 60_000,
      () => 0.5,
    );
    const activeStrategy = strategyIsSupport(plan.strategy) ? plan.strategy : null;
    const supported = activeStrategy !== null;
    const pIndependent = independentProbability(learner, strength, plan.level);
    const p = supported
      ? supportedProbability(learner, strength, plan.level)
      : pIndependent;

    if (supported) {
      supportQuestions++;
      if (independentProbability(learner, strength, STUCK_LEVEL) >= 0.75) {
        overSupportQuestions++;
      }
    } else {
      unaidedQuestions++;
      if (firstFadeTurn === null) {
        firstFadeTurn = turn;
        independentProbabilityAtFirstFade =
          independentProbability(learner, strength, STUCK_LEVEL);
      }
    }

    const rng = seededRng(mixSeed(seed, idNumber, turn));
    const correct = rng() < p;
    const question = labQuestion(plan.level, turn);
    const result = recordAnswer(
      profile,
      question,
      correct,
      3500,
      turn * 60_000,
      {
        given: correct ? question.answer : 'wrong',
        hinted: !!plan.showHint || !!plan.workedExample,
        strategy: plan.strategy,
      },
    );

    profile = result.profile;
    if (result.event === 'switched') strategySwitches++;

    if (supported) {
      if (correct) {
        supportedCorrect++;
        supportSuccessByStrategy[activeStrategy!] =
          (supportSuccessByStrategy[activeStrategy!] ?? 0) + 1;
        strength = clamp01(
          strength + (1 - strength) * learner.supportTransferRate,
        );

        const needed = requiredSupportedSuccesses(policy);
        const count = supportSuccessByStrategy[activeStrategy!] ?? 0;
        if (
          needed > 1
          && count < needed
          && profile.help.episode
          && profile.help.episode.phase === 'climb'
        ) {
          profile = holdScaffold(profile, activeStrategy!);
        }
      } else {
        strength = clamp01(
          strength + (1 - strength) * learner.supportTransferRate * 0.08,
        );
      }
    } else if (correct) {
      strength = clamp01(
        strength + (1 - strength) * learner.independentLearnRate,
      );
    } else {
      strength = clamp01(
        strength + (1 - strength) * learner.independentLearnRate * 0.04,
      );
    }

    if (!profile.help.episode) {
      resolved = true;
      independentStrengthAtResolution = strength;
      break;
    }

    const currentPhase = profile.help.episode.phase;
    if (
      previousEpisodePhase
      && currentPhase !== previousEpisodePhase
      && currentPhase !== 'climb'
      && previousEpisodePhase !== 'climb'
    ) {
      strategySwitches++;
    }
    previousEpisodePhase = currentPhase;
  }

  const targetProbAtFade = independentProbabilityAtFirstFade ?? 1;
  const prematureFade = firstFadeTurn !== null && targetProbAtFade < 0.60;
  const resolutionReady = resolved
    && independentProbability(learner, independentStrengthAtResolution ?? strength, STUCK_LEVEL) >= 0.65;

  let probeCorrect = 0;
  let firstProbeCorrect = true;
  if (resolved) {
    const probeStrength = independentStrengthAtResolution ?? strength;
    for (let probe = 1; probe <= postResolutionProbes; probe++) {
      const rng = seededRng(mixSeed(seed, idNumber, 0x70726f62, probe));
      const correct = rng() < independentProbability(
        learner,
        probeStrength,
        STUCK_LEVEL,
      );
      if (probe === 1) firstProbeCorrect = correct;
      if (correct) probeCorrect++;
    }
  }

  return {
    learner,
    policy,
    resolved,
    turns,
    supportQuestions,
    unaidedQuestions,
    supportedCorrect,
    strategySwitches,
    firstFadeTurn,
    independentProbabilityAtFirstFade,
    prematureFade,
    overSupportQuestions,
    independentStrengthAtResolution,
    resolutionReady,
    postResolutionSuccessRate:
      resolved && postResolutionProbes > 0
        ? probeCorrect / postResolutionProbes
        : 0,
    postResolutionAllCorrect:
      resolved && postResolutionProbes > 0 && probeCorrect === postResolutionProbes,
    relapsedImmediately: resolved && !firstProbeCorrect,
  };
}

export function runScaffoldFadeBenchmark(
  policy: ScaffoldFadePolicy,
  options: {
    population?: HiddenScaffoldLearner[];
    maxTurns?: number;
    postResolutionProbes?: number;
    seed?: number;
  } = {},
): ScaffoldFadeBenchmark {
  const population = options.population ?? scaffoldFadePopulation();
  const maxTurns = options.maxTurns ?? 18;
  const postResolutionProbes = options.postResolutionProbes ?? 4;
  const seed = options.seed ?? 20260925;
  const runs = population.map((learner, index) =>
    runScaffoldEpisode(learner, policy, {
      maxTurns,
      postResolutionProbes,
      seed: mixSeed(seed, index + 1),
    }));

  const resolved = runs.filter((run) => run.resolved);
  const resolutionTurns = resolved.map((run) => run.turns);

  return {
    policy,
    learnerCount: runs.length,
    maxTurns,
    resolutionRate: runs.length === 0 ? 0 : resolved.length / runs.length,
    medianTurnsToResolution: median(resolutionTurns),
    meanSupportQuestions: mean(runs.map((run) => run.supportQuestions)),
    meanUnaidedQuestions: mean(runs.map((run) => run.unaidedQuestions)),
    prematureFadeRate:
      runs.length === 0
        ? 0
        : runs.filter((run) => run.prematureFade).length / runs.length,
    meanOverSupportQuestions: mean(runs.map((run) => run.overSupportQuestions)),
    resolutionReadinessPrecision:
      resolved.length === 0
        ? 1
        : resolved.filter((run) => run.resolutionReady).length / resolved.length,
    meanIndependentStrengthAtResolution:
      resolved.length === 0
        ? 0
        : mean(resolved.map((run) => run.independentStrengthAtResolution ?? 0)),
    postResolutionSuccessRate:
      resolved.length === 0
        ? 0
        : mean(resolved.map((run) => run.postResolutionSuccessRate)),
    postResolutionAllCorrectRate:
      resolved.length === 0
        ? 0
        : resolved.filter((run) => run.postResolutionAllCorrect).length / resolved.length,
    immediateRelapseRate:
      resolved.length === 0
        ? 0
        : resolved.filter((run) => run.relapsedImmediately).length / resolved.length,
  };
}

export function compareScaffoldFadePolicies(
  options: {
    population?: HiddenScaffoldLearner[];
    maxTurns?: number;
    postResolutionProbes?: number;
    seed?: number;
  } = {},
): ScaffoldFadeComparison {
  const population = options.population ?? scaffoldFadePopulation();
  const maxTurns = options.maxTurns ?? 18;
  const postResolutionProbes = options.postResolutionProbes ?? 4;
  const seed = options.seed ?? 20260925;
  const common = { population, maxTurns, postResolutionProbes, seed };

  return {
    current: runScaffoldFadeBenchmark('current', common),
    twoSupported: runScaffoldFadeBenchmark('two-supported', common),
    threeSupported: runScaffoldFadeBenchmark('three-supported', common),
  };
}
