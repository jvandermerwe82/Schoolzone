/**
 * Trace runner: plays a scripted SYNTHETIC learner through the real engine
 * (planNext, makeQuestion, curriculumEvidenceForQuestion, recordAnswer) and
 * records the engine's own before/after at every step.
 *
 * Guarantees:
 * - only synthetic profiles are accepted (assertSyntheticProfile);
 * - the input profile is never mutated, and nothing is read from or written to
 *   storage, the server or the network;
 * - fully deterministic: the clock and the RNG are inputs, not globals;
 * - the learner script supplies only WHAT the learner does (right, a named
 *   mistake, extra help, leave, wait). Every decision comes from the engine.
 */
import { structuredHomeworkRoute, type AustralianPracticeRoute } from '../curriculum/australia-intent-routing';
import type { StructuredHomework } from '../curriculum/australia-teacher-objectives';
import { curriculumEvidenceForQuestion, type CurriculumPracticeFocus } from '../curriculum/evidence';
import { planNext, recordAnswer, skillState, type Plan, type SessionContext } from '../brain/tutor';
import type { ItemStats } from '../brain/items';
import type { HelpEvent } from '../brain/help';
import type { Profile, Question } from '../brain/types';
import { checkAnswer, makeQuestion } from '../content';
import { getSkill } from '../content/skills';
import { seededRng } from '../brain-lab/rng';
import { parentCardFor, teacherCardFor } from './audience';
import { classifyAttempt } from './evidence-mode';
import { assertSyntheticProfile } from './provenance';
import {
  explainAnswer, selectCanonicalNode, selectConceptGraph, selectDecision, selectHelpEpisode, selectMisconceptions,
  selectReviews, selectRoute, selectStrategyChoice, selectSupport, snapshotSkill,
} from './selectors';
import type { ScenarioMeta, StrategyChoiceView, TraceBreakView, TraceEntry, TraceStepView } from './views';

export const DAY_MS = 86_400_000;
/** Default thinking time for a synthetic answer. Comfortably above the rapid-guess threshold. */
export const DEFAULT_TIME_MS = 9_000;
const BETWEEN_QUESTIONS_MS = 4_000;

export type Outcome =
  /** The correct answer. */
  | 'right'
  /** The catalogued "add the tops and add the bottoms" mistake (falls back to another wrong answer if none is offered). */
  | 'add-across'
  /** A wrong answer that matches no catalogued mistake. */
  | 'other-wrong';

export type Move =
  | { kind: 'answer'; outcome: Outcome; /** Opens a hint or the Problem Solver, as a child might. */ extraHelp?: boolean; timeMs?: number }
  /** Closes the app. The profile, including any open help episode, is kept. A new session starts after. */
  | { kind: 'leave'; label: string }
  /** Time passes before the next session. */
  | { kind: 'wait'; days: number; label: string };

export interface Scenario {
  meta: ScenarioMeta;
  seed: number;
  startAt: number;
  homework: StructuredHomework;
  /** Builds a FRESH synthetic profile each call. */
  profile: () => Profile;
  moves: readonly Move[];
}

export interface TraceResult {
  meta: ScenarioMeta;
  entries: TraceEntry[];
  initial: { profile: Profile };
  final: { profile: Profile };
}

const WRONG_FALLBACKS = ['0', '1/99', '99'];

/** The answer a synthetic learner gives for the chosen outcome. Never a correct answer for a wrong outcome. */
export function givenFor(question: Question, outcome: Outcome): string {
  if (outcome === 'right') return question.answer;
  const bugs = question.bugs ?? [];
  const pool = outcome === 'add-across'
    ? [...bugs.filter(([id]) => id === 'frac-add-across').map(([, wrong]) => wrong), ...WRONG_FALLBACKS]
    : [...bugs.filter(([id]) => id !== 'frac-add-across').map(([, wrong]) => wrong), ...WRONG_FALLBACKS];
  const given = pool.find((candidate) => !checkAnswer(question, candidate));
  if (!given) throw new Error('No wrong answer available for this question.');
  return given;
}

const focusFor = (route: AustralianPracticeRoute): CurriculumPracticeFocus => ({
  curriculumId: 'au-ac-v9',
  canonicalNodeId: route.activeCanonicalNodeId,
  practiceSkillId: route.practiceSkillId,
  practiceLevels: route.practiceLevels,
  strength: route.evidenceStrength,
});

/**
 * Rebuild the profile the help system saw when it picked a way of helping:
 * skills, history and mistakes already updated for this answer, but help and
 * Learning Intelligence still as they were before it.
 */
const profileSeenByHelp = (before: Profile, after: Profile): Profile => ({
  ...after,
  help: before.help,
  learningIntelligence: before.learningIntelligence,
});

function strategyChoiceFor(
  before: Profile, after: Profile, question: Question, event: HelpEvent, now: number,
): StrategyChoiceView | null {
  const seen = profileSeenByHelp(before, after);
  if (event === 'stuck') {
    return selectStrategyChoice(seen, { skillId: question.skillId, stuckLevel: question.level, tried: [] }, now);
  }
  if (event === 'switched') {
    const episode = before.help?.episode;
    if (!episode) return null;
    const failed = episode.phase === 'climb' ? episode.helpedBy : episode.phase;
    const tried = failed ? [...episode.tried, failed] : episode.tried;
    return selectStrategyChoice(seen, { skillId: episode.skillId, stuckLevel: episode.stuckLevel, tried }, now);
  }
  return null;
}

export function runTrace(scenario: Scenario): TraceResult {
  const initialProfile = scenario.profile();
  assertSyntheticProfile(initialProfile);

  const rng = seededRng(scenario.seed);
  let profile: Profile = initialProfile;
  let items: ItemStats = {};
  let now = scenario.startAt;
  let route = structuredHomeworkRoute(profile, scenario.homework);
  let session: SessionContext = { focus: route.practiceSkillId, answered: 0, allowedLevels: route.practiceLevels, strictFocus: true };
  const entries: TraceEntry[] = [];

  const newMission = () => {
    // Mirrors the app: a new mission recalculates the route from current evidence.
    route = structuredHomeworkRoute(profile, scenario.homework);
    session = { focus: route.practiceSkillId, answered: 0, allowedLevels: route.practiceLevels, strictFocus: true };
  };

  const plan = (): Plan => planNext(profile, 'maths', session, now, rng, items);

  for (const move of scenario.moves) {
    if (move.kind !== 'answer') {
      now += move.kind === 'wait' ? move.days * DAY_MS : BETWEEN_QUESTIONS_MS;
      newMission();
      const episodeOpen = !!profile.help?.episode;
      const resumed = episodeOpen ? selectDecision(profile, plan(), { items, allowedLevels: route.practiceLevels }) : null;
      const entry: TraceBreakView = { index: entries.length, at: now, kind: 'break', label: move.label, episodeOpen, resumed };
      entries.push(entry);
      continue;
    }

    const before = profile;
    const chosen = plan();
    const question = makeQuestion(chosen.skillId, chosen.level, before.recentQuestionIds, rng, chosen.target);
    const decision = selectDecision(before, chosen, { items, allowedLevels: route.practiceLevels });
    const routeView = selectRoute(before, scenario.homework);

    const given = givenFor(question, move.outcome);
    const correct = checkAnswer(question, given);
    const helped = !!chosen.workedExample || !!chosen.showHint || !!move.extraHelp;
    const timeMs = move.timeMs ?? DEFAULT_TIME_MS;
    const lastPracticed = skillState(before, question.skillId).lastPracticed;
    const attempt = classifyAttempt({
      hinted: helped,
      strategy: chosen.strategy ?? null,
      planReason: chosen.reason,
      msSincePreviousAttempt: lastPracticed === null ? null : now - lastPracticed,
    });
    const beforeSnapshot = snapshotSkill(before, question.skillId);

    const curriculumEvidence = curriculumEvidenceForQuestion(before, question, focusFor(route));
    const result = recordAnswer(before, question, correct, timeMs, now, {
      given, hinted: helped, items, strategy: chosen.strategy, curriculumEvidence, sessionPosition: session.answered + 1,
    });
    profile = result.profile;
    items = result.items;
    const afterSnapshot = snapshotSkill(profile, question.skillId);

    const step: TraceStepView = {
      index: entries.length,
      at: now,
      kind: 'answer',
      decision,
      route: routeView,
      question: {
        id: question.id,
        skillId: question.skillId,
        skillName: getSkill(question.skillId).name,
        level: question.level,
        prompt: question.prompt,
        choices: question.choices ?? null,
      },
      input: { given, correct, helped, timeMs },
      attempt,
      predictedCorrect: result.predicted,
      before: beforeSnapshot,
      after: afterSnapshot,
      result: { misconceptionId: result.misconception, rapid: result.rapid, helpEvent: result.event, xp: result.xp },
      strategyChoice: strategyChoiceFor(before, profile, question, result.event, now),
      episodeAfter: selectHelpEpisode(profile),
      misconceptionsAfter: selectMisconceptions(profile),
      activeNode: selectCanonicalNode(profile, route.activeCanonicalNodeId),
      targetNode: selectCanonicalNode(profile, route.targetCanonicalNodeId),
      explain: explainAnswer({
        predicted: result.predicted,
        before: beforeSnapshot,
        after: afterSnapshot,
        correct,
        helped,
        rapid: result.rapid,
        misconceptionId: result.misconception,
        attempt,
        strategy: chosen.strategy ?? null,
      }),
      graph: selectConceptGraph(profile, route.targetCanonicalNodeId, route.activeCanonicalNodeId, 3),
      support: selectSupport(profile, question.skillId, now),
      reviews: selectReviews(profile, now),
      adults: {
        parent: parentCardFor(profile, { homework: scenario.homework, now, activeNodeId: route.activeCanonicalNodeId }),
        teacher: teacherCardFor(profile, { homework: scenario.homework, now, shared: true }),
      },
    };
    entries.push(step);

    session = { ...session, focus: question.skillId, answered: session.answered + 1 };
    now += timeMs + BETWEEN_QUESTIONS_MS;
  }

  return { meta: scenario.meta, entries, initial: { profile: initialProfile }, final: { profile } };
}
