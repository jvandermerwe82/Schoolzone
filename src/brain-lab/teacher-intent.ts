import { canonicalProgressIsReady, routeAustralianTeacherHomework } from '../curriculum/australia-intent-routing';
import {
  AUSTRALIAN_TEACHER_OBJECTIVES,
  structuredHomework,
  type StructuredHomework,
  type TeacherObjectiveDefinition,
} from '../curriculum/australia-teacher-objectives';
import { australianCanonicalProgress } from '../curriculum/australia-canonical';
import type { AnswerRecord, Profile } from '../brain/types';
import { newProfile } from '../storage';
import { mixSeed, seededRng } from './rng';

export interface TeacherIntentScenario {
  target: TeacherObjectiveDefinition;
  prerequisiteNodeId: string;
  prerequisiteTitle: string;
  prerequisitePracticeSkillId: string;
}

export interface HiddenTeacherIntentLearner {
  id: string;
  year: number;
  scenario: TeacherIntentScenario;
  prerequisiteKnowledge: number;
  targetKnowledge: number;
  prerequisiteLearnRate: number;
  targetLearnRate: number;
  slipRate: number;
}

export type TeacherIntentPolicy = 'route-aware' | 'direct-target';
export type TeacherEvidencePolicy =
  | 'lifetime'
  | 'recent-6'
  | 'recent-8'
  | 'recent-10'
  | 'recent-8-after-8'
  | 'recent-8-after-10'
  | 'recent-10-after-10'
  | 'recovery-7-of-8'
  | 'recovery-8-of-8'
  | 'recovery-9-of-10';

export const TEACHER_INTENT_SAFE_TARGET_KNOWLEDGE = 0.70;
export const TEACHER_INTENT_SAFE_PREREQUISITE_KNOWLEDGE = 0.65;

export interface TeacherIntentLearnerRun {
  learner: HiddenTeacherIntentLearner;
  policy: TeacherIntentPolicy;
  completed: boolean;
  questionsAsked: number;
  questionsToCompletion: number | null;
  targetKnowledgeAtCompletion: number | null;
  wrongAnswers: number;
  targetAttempts: number;
  prerequisiteAttempts: number;
  prematureTargetAttempts: number;
  prerequisiteEvidenceReadyAt: number | null;
  prerequisiteKnowledgeAtReady: number | null;
  returnedToTargetAfterRepair: boolean;
  finalPrerequisiteKnowledge: number;
  finalTargetKnowledge: number;
}

export interface TeacherIntentBenchmark {
  policy: TeacherIntentPolicy;
  evidencePolicy: TeacherEvidencePolicy;
  learnerCount: number;
  horizonQuestions: number;
  completionRate: number;
  medianQuestionsToCompletion: number | null;
  meanWrongAnswers: number;
  wrongAnswerRate: number;
  meanTargetAttempts: number;
  meanPrerequisiteAttempts: number;
  meanPrematureTargetAttempts: number;
  prerequisiteRepairRate: number;
  returnToTargetRate: number;
  prerequisiteReadinessPrecision: number;
  completionReadinessPrecision: number;
  meanFinalTargetKnowledge: number;
}

export interface TeacherIntentComparison {
  routeAware: TeacherIntentBenchmark;
  directTarget: TeacherIntentBenchmark;
  delta: {
    completionRate: number;
    medianQuestionsToCompletion: number | null;
    wrongAnswerRate: number;
    prematureTargetAttempts: number;
    meanFinalTargetKnowledge: number;
  };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
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

const evidence = (
  nodeId: string,
  skillId: string,
  correct: boolean,
  at: number,
): AnswerRecord => ({
  at,
  skillId,
  level: 3,
  correct,
  timeMs: 3500,
  predicted: 0.7,
  curriculumEvidence: [{
    curriculumId: 'au-ac-v9',
    canonicalNodeId: nodeId,
    strength: 'direct',
  }],
});

const homeworkFor = (
  target: TeacherObjectiveDefinition,
): StructuredHomework => structuredHomework(target, 1, { priority: 2 });

interface EvidenceWindowPolicy {
  window: number | null;
  minLifetimeDirectEvidence: number;
  recoveryRequiredCorrect?: number;
}

const evidenceWindowPolicy = (policy: TeacherEvidencePolicy): EvidenceWindowPolicy => {
  switch (policy) {
    case 'recent-6': return { window: 6, minLifetimeDirectEvidence: 0 };
    case 'recent-8': return { window: 8, minLifetimeDirectEvidence: 0 };
    case 'recent-10': return { window: 10, minLifetimeDirectEvidence: 0 };
    case 'recent-8-after-8': return { window: 8, minLifetimeDirectEvidence: 8 };
    case 'recent-8-after-10': return { window: 8, minLifetimeDirectEvidence: 10 };
    case 'recent-10-after-10': return { window: 10, minLifetimeDirectEvidence: 10 };
    case 'recovery-7-of-8':
      return { window: 8, minLifetimeDirectEvidence: 8, recoveryRequiredCorrect: 7 };
    case 'recovery-8-of-8':
      return { window: 8, minLifetimeDirectEvidence: 8, recoveryRequiredCorrect: 8 };
    case 'recovery-9-of-10':
      return { window: 10, minLifetimeDirectEvidence: 10, recoveryRequiredCorrect: 9 };
    case 'lifetime': return { window: null, minLifetimeDirectEvidence: 0 };
  }
};

const historyForEvidencePolicy = (
  history: readonly AnswerRecord[],
  policy: TeacherEvidencePolicy,
): AnswerRecord[] => {
  const config = evidenceWindowPolicy(policy);
  if (config.window === null) return [...history];

  const byNode = new Map<string, { index: number; answer: AnswerRecord; correct: boolean; direct: boolean }[]>();
  for (let index = 0; index < history.length; index++) {
    const answer = history[index];
    for (const item of answer.curriculumEvidence ?? []) {
      if (item.curriculumId !== 'au-ac-v9') continue;
      const rows = byNode.get(item.canonicalNodeId) ?? [];
      rows.push({
        index,
        answer,
        correct: answer.correct,
        direct: item.strength === 'direct',
      });
      byNode.set(item.canonicalNodeId, rows);
    }
  }

  const useRecentFor = new Set<string>();
  for (const [nodeId, rows] of byNode) {
    const directRows = rows.filter((row) => row.direct);
    if (directRows.length < config.minLifetimeDirectEvidence) continue;

    if (config.recoveryRequiredCorrect !== undefined) {
      if (directRows.length < config.window) continue;
      const recentDirect = directRows.slice(-config.window);
      const correct = recentDirect.filter((row) => row.correct).length;
      if (correct >= config.recoveryRequiredCorrect) useRecentFor.add(nodeId);
    } else {
      useRecentFor.add(nodeId);
    }
  }

  const recentCounts = new Map<string, number>();
  const keptIndices = new Set<number>();

  for (let index = history.length - 1; index >= 0; index--) {
    const answer = history[index];
    const nodeIds = (answer.curriculumEvidence ?? [])
      .filter((item) => item.curriculumId === 'au-ac-v9')
      .map((item) => item.canonicalNodeId);

    if (nodeIds.length === 0) {
      keptIndices.add(index);
      continue;
    }

    let keep = false;
    for (const nodeId of nodeIds) {
      if (!useRecentFor.has(nodeId)) {
        keep = true;
        continue;
      }
      if ((recentCounts.get(nodeId) ?? 0) < config.window) {
        keep = true;
        recentCounts.set(nodeId, (recentCounts.get(nodeId) ?? 0) + 1);
      }
    }
    if (keep) keptIndices.add(index);
  }

  return history.filter((_answer, index) => keptIndices.has(index));
};

const evidenceProfile = (
  profile: Pick<Profile, 'history'>,
  policy: TeacherEvidencePolicy,
): Pick<Profile, 'history'> => ({
  history: historyForEvidencePolicy(profile.history, policy),
});


/**
 * Use only real Australian teacher objectives where production routing has a
 * single executable direct-evidence prerequisite and returns to the target
 * once that prerequisite has four clean direct successes.
 */
export function teacherIntentScenarios(): TeacherIntentScenario[] {
  const scenarios: TeacherIntentScenario[] = [];

  for (const target of AUSTRALIAN_TEACHER_OBJECTIVES) {
    if (target.routeStrength !== 'direct') continue;

    const profile = newProfile('scenario', '🧪', Number(target.yearLevel));
    const homework = homeworkFor(target);
    const first = routeAustralianTeacherHomework(profile, homework);
    if (!first || first.reason !== 'prerequisite' || first.evidenceStrength !== 'direct') continue;

    profile.history = Array.from({ length: 4 }, (_, index) =>
      evidence(first.activeCanonicalNodeId, first.practiceSkillId, true, index + 1));
    const afterRepair = routeAustralianTeacherHomework(profile, homework);
    if (
      !afterRepair
      || afterRepair.reason !== 'target'
      || afterRepair.activeCanonicalNodeId !== target.canonicalNodeId
    ) continue;

    scenarios.push({
      target,
      prerequisiteNodeId: first.activeCanonicalNodeId,
      prerequisiteTitle: first.activeTitle,
      prerequisitePracticeSkillId: first.practiceSkillId,
    });
  }

  return scenarios;
}

export function teacherIntentPopulation(size = 120): HiddenTeacherIntentLearner[] {
  const scenarios = teacherIntentScenarios();
  if (scenarios.length === 0) throw new Error('No executable teacher-intent benchmark scenarios.');

  return Array.from({ length: size }, (_, index) => ({
    id: `teacher-intent-${index + 1}`,
    year: Number(scenarios[index % scenarios.length].target.yearLevel),
    scenario: scenarios[index % scenarios.length],
    prerequisiteKnowledge: 0.18 + (index % 5) * 0.06,
    targetKnowledge: 0.24 + (index % 4) * 0.05,
    prerequisiteLearnRate: 0.20 + (index % 4) * 0.025,
    targetLearnRate: 0.13 + (index % 3) * 0.02,
    slipRate: 0.04 + (index % 4) * 0.01,
  }));
}

const successProbability = (
  activeNodeId: string,
  learner: HiddenTeacherIntentLearner,
  prerequisiteKnowledge: number,
  targetKnowledge: number,
): number => {
  const isPrerequisite = activeNodeId === learner.scenario.prerequisiteNodeId;
  const knowledge = isPrerequisite ? prerequisiteKnowledge : targetKnowledge;
  const prerequisiteGate = isPrerequisite ? 1 : 0.30 + 0.70 * prerequisiteKnowledge;
  return clamp01((0.12 + 0.84 * knowledge * prerequisiteGate) * (1 - learner.slipRate));
};

const learn = (
  activeNodeId: string,
  learner: HiddenTeacherIntentLearner,
  prerequisiteKnowledge: number,
  targetKnowledge: number,
): { prerequisiteKnowledge: number; targetKnowledge: number } => {
  if (activeNodeId === learner.scenario.prerequisiteNodeId) {
    return {
      prerequisiteKnowledge: clamp01(
        prerequisiteKnowledge + (1 - prerequisiteKnowledge) * learner.prerequisiteLearnRate,
      ),
      targetKnowledge,
    };
  }

  // Target learning is possible without the prerequisite, but it is much less
  // efficient. As the prerequisite becomes strong, target practice becomes
  // substantially more productive.
  const transfer = 0.20 + 0.80 * prerequisiteKnowledge;
  return {
    prerequisiteKnowledge,
    targetKnowledge: clamp01(
      targetKnowledge + (1 - targetKnowledge) * learner.targetLearnRate * transfer,
    ),
  };
};

export function runTeacherIntentLearner(
  learner: HiddenTeacherIntentLearner,
  policy: TeacherIntentPolicy,
  options: {
    horizonQuestions?: number;
    seed?: number;
    evidencePolicy?: TeacherEvidencePolicy;
  } = {},
): TeacherIntentLearnerRun {
  const horizonQuestions = options.horizonQuestions ?? 24;
  const seed = options.seed ?? 20260925;
  const evidencePolicy = options.evidencePolicy ?? 'lifetime';
  const idNumber = Number(learner.id.replace(/\D/g, '')) || 1;
  const rng = seededRng(mixSeed(seed, idNumber, policy === 'route-aware' ? 0x726f7574 : 0x64697265));

  const homework = homeworkFor(learner.scenario.target);
  let profile: Profile = newProfile(learner.id, '🧪', learner.year);
  let prerequisiteKnowledge = learner.prerequisiteKnowledge;
  let targetKnowledge = learner.targetKnowledge;
  let wrongAnswers = 0;
  let questionsAsked = 0;
  let targetAttempts = 0;
  let prerequisiteAttempts = 0;
  let prematureTargetAttempts = 0;
  let prerequisiteEvidenceReadyAt: number | null = null;
  let prerequisiteKnowledgeAtReady: number | null = null;
  let returnedToTargetAfterRepair = false;
  let questionsToCompletion: number | null = null;
  let targetKnowledgeAtCompletion: number | null = null;

  for (let questionIndex = 1; questionIndex <= horizonQuestions; questionIndex++) {
    const visibleProfile = evidenceProfile(profile, evidencePolicy);
    const targetProgress = australianCanonicalProgress(
      visibleProfile,
      learner.scenario.target.canonicalNodeId,
    );
    if (canonicalProgressIsReady(targetProgress)) {
      questionsToCompletion = questionIndex - 1;
      targetKnowledgeAtCompletion = targetKnowledge;
      break;
    }

    const productionRoute = routeAustralianTeacherHomework(visibleProfile, homework);
    const activeNodeId = policy === 'route-aware'
      ? productionRoute?.activeCanonicalNodeId ?? learner.scenario.target.canonicalNodeId
      : learner.scenario.target.canonicalNodeId;
    const activeSkillId = policy === 'route-aware'
      ? productionRoute?.practiceSkillId ?? learner.scenario.target.practiceSkillId
      : learner.scenario.target.practiceSkillId;

    const prerequisiteProgress = australianCanonicalProgress(
      visibleProfile,
      learner.scenario.prerequisiteNodeId,
    );
    const prerequisiteReady = canonicalProgressIsReady(prerequisiteProgress);
    if (prerequisiteReady && prerequisiteEvidenceReadyAt === null) {
      prerequisiteEvidenceReadyAt = questionIndex;
      prerequisiteKnowledgeAtReady = prerequisiteKnowledge;
    }

    if (activeNodeId === learner.scenario.target.canonicalNodeId) {
      targetAttempts++;
      if (!prerequisiteReady && prerequisiteKnowledge < 0.65) prematureTargetAttempts++;
      if (prerequisiteEvidenceReadyAt !== null) returnedToTargetAfterRepair = true;
    } else if (activeNodeId === learner.scenario.prerequisiteNodeId) {
      prerequisiteAttempts++;
    }

    questionsAsked++;
    const p = successProbability(
      activeNodeId,
      learner,
      prerequisiteKnowledge,
      targetKnowledge,
    );
    const correct = rng() < p;
    if (!correct) wrongAnswers++;

    profile = {
      ...profile,
      history: [
        ...profile.history,
        evidence(activeNodeId, activeSkillId, correct, questionIndex),
      ],
    };

    const learned = learn(
      activeNodeId,
      learner,
      prerequisiteKnowledge,
      targetKnowledge,
    );
    prerequisiteKnowledge = learned.prerequisiteKnowledge;
    targetKnowledge = learned.targetKnowledge;

    const repairedVisible = evidenceProfile(profile, evidencePolicy);
    const repaired = australianCanonicalProgress(repairedVisible, learner.scenario.prerequisiteNodeId);
    if (canonicalProgressIsReady(repaired) && prerequisiteEvidenceReadyAt === null) {
      prerequisiteEvidenceReadyAt = questionIndex;
      prerequisiteKnowledgeAtReady = prerequisiteKnowledge;
    }
  }

  if (questionsToCompletion === null) {
    const finalVisible = evidenceProfile(profile, evidencePolicy);
    const finalTarget = australianCanonicalProgress(finalVisible, learner.scenario.target.canonicalNodeId);
    if (canonicalProgressIsReady(finalTarget)) {
      questionsToCompletion = horizonQuestions;
      targetKnowledgeAtCompletion = targetKnowledge;
    }
  }

  return {
    learner,
    policy,
    completed: questionsToCompletion !== null,
    questionsAsked,
    questionsToCompletion,
    targetKnowledgeAtCompletion,
    wrongAnswers,
    targetAttempts,
    prerequisiteAttempts,
    prematureTargetAttempts,
    prerequisiteEvidenceReadyAt,
    prerequisiteKnowledgeAtReady,
    returnedToTargetAfterRepair,
    finalPrerequisiteKnowledge: prerequisiteKnowledge,
    finalTargetKnowledge: targetKnowledge,
  };
}

export function runTeacherIntentBenchmark(
  policy: TeacherIntentPolicy,
  options: {
    population?: HiddenTeacherIntentLearner[];
    horizonQuestions?: number;
    seed?: number;
    evidencePolicy?: TeacherEvidencePolicy;
  } = {},
): TeacherIntentBenchmark {
  const population = options.population ?? teacherIntentPopulation();
  const horizonQuestions = options.horizonQuestions ?? 24;
  const seed = options.seed ?? 20260925;
  const evidencePolicy = options.evidencePolicy ?? 'lifetime';
  const runs = population.map((learner, index) =>
    runTeacherIntentLearner(learner, policy, {
      horizonQuestions,
      seed: mixSeed(seed, index + 1),
      evidencePolicy,
    }));

  const completed = runs
    .map((run) => run.questionsToCompletion)
    .filter((value): value is number => value !== null);
  const repaired = runs.filter((run) => run.prerequisiteEvidenceReadyAt !== null);
  const returned = repaired.filter((run) => run.returnedToTargetAfterRepair);
  const completedRuns = runs.filter((run) => run.completed);
  const prerequisiteSafe = repaired.filter(
    (run) => (run.prerequisiteKnowledgeAtReady ?? 0) >= TEACHER_INTENT_SAFE_PREREQUISITE_KNOWLEDGE,
  );
  const completionSafe = completedRuns.filter(
    (run) => (run.targetKnowledgeAtCompletion ?? 0) >= TEACHER_INTENT_SAFE_TARGET_KNOWLEDGE,
  );
  const totalQuestions = runs.reduce((sum, run) => sum + run.questionsAsked, 0);
  const totalWrong = runs.reduce((sum, run) => sum + run.wrongAnswers, 0);

  return {
    policy,
    evidencePolicy,
    learnerCount: runs.length,
    horizonQuestions,
    completionRate: runs.length === 0 ? 0 : completed.length / runs.length,
    medianQuestionsToCompletion: median(completed),
    meanWrongAnswers: mean(runs.map((run) => run.wrongAnswers)),
    wrongAnswerRate: totalQuestions === 0 ? 0 : totalWrong / totalQuestions,
    meanTargetAttempts: mean(runs.map((run) => run.targetAttempts)),
    meanPrerequisiteAttempts: mean(runs.map((run) => run.prerequisiteAttempts)),
    meanPrematureTargetAttempts: mean(runs.map((run) => run.prematureTargetAttempts)),
    prerequisiteRepairRate: runs.length === 0 ? 0 : repaired.length / runs.length,
    returnToTargetRate: repaired.length === 0 ? 0 : returned.length / repaired.length,
    prerequisiteReadinessPrecision:
      repaired.length === 0 ? 1 : prerequisiteSafe.length / repaired.length,
    completionReadinessPrecision:
      completedRuns.length === 0 ? 1 : completionSafe.length / completedRuns.length,
    meanFinalTargetKnowledge: mean(runs.map((run) => run.finalTargetKnowledge)),
  };
}

export function compareTeacherIntentPolicies(
  options: {
    population?: HiddenTeacherIntentLearner[];
    horizonQuestions?: number;
    seed?: number;
    evidencePolicy?: TeacherEvidencePolicy;
  } = {},
): TeacherIntentComparison {
  const population = options.population ?? teacherIntentPopulation();
  const horizonQuestions = options.horizonQuestions ?? 24;
  const seed = options.seed ?? 20260925;
  const evidencePolicy = options.evidencePolicy ?? 'lifetime';
  const routeAware = runTeacherIntentBenchmark('route-aware', {
    population, horizonQuestions, seed, evidencePolicy,
  });
  const directTarget = runTeacherIntentBenchmark('direct-target', {
    population, horizonQuestions, seed, evidencePolicy,
  });

  return {
    routeAware,
    directTarget,
    delta: {
      completionRate: routeAware.completionRate - directTarget.completionRate,
      medianQuestionsToCompletion:
        routeAware.medianQuestionsToCompletion === null
        || directTarget.medianQuestionsToCompletion === null
          ? null
          : directTarget.medianQuestionsToCompletion - routeAware.medianQuestionsToCompletion,
      wrongAnswerRate: directTarget.wrongAnswerRate - routeAware.wrongAnswerRate,
      prematureTargetAttempts:
        directTarget.meanPrematureTargetAttempts - routeAware.meanPrematureTargetAttempts,
      meanFinalTargetKnowledge:
        routeAware.meanFinalTargetKnowledge - directTarget.meanFinalTargetKnowledge,
    },
  };
}


export interface TeacherIntentHorizonPoint {
  horizonQuestions: number;
  comparison: TeacherIntentComparison;
}

export function teacherIntentHorizonCurve(
  population: HiddenTeacherIntentLearner[],
  horizons: readonly number[] = [12, 24, 36, 48],
  seed = 20260925,
): TeacherIntentHorizonPoint[] {
  return horizons.map((horizonQuestions) => ({
    horizonQuestions,
    comparison: compareTeacherIntentPolicies({
      population,
      horizonQuestions,
      seed,
    }),
  }));
}


export interface TeacherEvidenceChallenger {
  evidencePolicy: TeacherEvidencePolicy;
  benchmark: TeacherIntentBenchmark;
  deltaVsLifetime: {
    completionRate: number;
    wrongAnswerRate: number;
    prerequisiteRepairRate: number;
    meanTargetKnowledge: number;
  };
}

export function teacherEvidenceChallengers(
  population: HiddenTeacherIntentLearner[],
  lifetime: TeacherIntentBenchmark,
  options: { horizonQuestions?: number; seed?: number } = {},
): TeacherEvidenceChallenger[] {
  const horizonQuestions = options.horizonQuestions ?? 48;
  const seed = options.seed ?? 20260925;
  const policies: TeacherEvidencePolicy[] = ['recent-6', 'recent-8', 'recent-10'];

  return policies.map((evidencePolicy) => {
    const benchmark = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions,
      seed,
      evidencePolicy,
    });
    return {
      evidencePolicy,
      benchmark,
      deltaVsLifetime: {
        completionRate: benchmark.completionRate - lifetime.completionRate,
        wrongAnswerRate: lifetime.wrongAnswerRate - benchmark.wrongAnswerRate,
        prerequisiteRepairRate:
          benchmark.prerequisiteRepairRate - lifetime.prerequisiteRepairRate,
        meanTargetKnowledge:
          benchmark.meanFinalTargetKnowledge - lifetime.meanFinalTargetKnowledge,
      },
    };
  });
}


export function teacherHybridEvidenceChallengers(
  population: HiddenTeacherIntentLearner[],
  lifetime: TeacherIntentBenchmark,
  options: { horizonQuestions?: number; seed?: number } = {},
): TeacherEvidenceChallenger[] {
  const horizonQuestions = options.horizonQuestions ?? 48;
  const seed = options.seed ?? 20260925;
  const policies: TeacherEvidencePolicy[] = [
    'recent-8-after-8',
    'recent-8-after-10',
    'recent-10-after-10',
  ];

  return policies.map((evidencePolicy) => {
    const benchmark = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions,
      seed,
      evidencePolicy,
    });
    return {
      evidencePolicy,
      benchmark,
      deltaVsLifetime: {
        completionRate: benchmark.completionRate - lifetime.completionRate,
        wrongAnswerRate: lifetime.wrongAnswerRate - benchmark.wrongAnswerRate,
        prerequisiteRepairRate:
          benchmark.prerequisiteRepairRate - lifetime.prerequisiteRepairRate,
        meanTargetKnowledge:
          benchmark.meanFinalTargetKnowledge - lifetime.meanFinalTargetKnowledge,
      },
    };
  });
}


export function teacherRecoveryEvidenceChallengers(
  population: HiddenTeacherIntentLearner[],
  lifetime: TeacherIntentBenchmark,
  options: { horizonQuestions?: number; seed?: number } = {},
): TeacherEvidenceChallenger[] {
  const horizonQuestions = options.horizonQuestions ?? 48;
  const seed = options.seed ?? 20260925;
  const policies: TeacherEvidencePolicy[] = [
    'recovery-7-of-8',
    'recovery-8-of-8',
    'recovery-9-of-10',
  ];

  return policies.map((evidencePolicy) => {
    const benchmark = runTeacherIntentBenchmark('route-aware', {
      population,
      horizonQuestions,
      seed,
      evidencePolicy,
    });
    return {
      evidencePolicy,
      benchmark,
      deltaVsLifetime: {
        completionRate: benchmark.completionRate - lifetime.completionRate,
        wrongAnswerRate: lifetime.wrongAnswerRate - benchmark.wrongAnswerRate,
        prerequisiteRepairRate:
          benchmark.prerequisiteRepairRate - lifetime.prerequisiteRepairRate,
        meanTargetKnowledge:
          benchmark.meanFinalTargetKnowledge - lifetime.meanFinalTargetKnowledge,
      },
    };
  });
}
