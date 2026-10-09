/**
 * Synthetic fixture learners for the Brain Lab and the Year 5 fractions lesson.
 *
 * These are INVENTED learners. They contain no real child data and are marked
 * so the lab can refuse anything else. The scripts only say what the learner
 * does; every decision shown comes from running the real engine on them.
 */
import { emptyHelp } from '../brain/help';
import {
  emptyLearningIntelligence, recordSupportOutcome, setCurriculumContext, setSupportPreference,
  type LearningIntelligenceState, type SupportStrategyId,
} from '../brain/learning-intelligence';
import { DEFAULT_SETTINGS, type AnswerRecord, type Profile, type SkillState } from '../brain/types';
import { australianTeacherObjective, structuredHomework } from '../curriculum/australia-teacher-objectives';
import { SYNTHETIC_ID_PREFIX, SYNTHETIC_NAME_PREFIX } from './provenance';
import type { Move, Scenario } from './trace';

const DAY = 86_400_000;
/** A fixed, arbitrary Monday so every run produces identical timestamps. */
export const FIXTURE_START = Date.UTC(2026, 2, 2, 0, 30, 0);

const learnedSkill = (startAt: number, ability: number, pKnown: number, attempts: number): SkillState => ({
  ability, pKnown, attempts, correct: Math.round(attempts * 0.8), recent: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
  wrongStreak: 0, lastPracticed: startAt - 2 * DAY, reviewIntervalDays: 0, nextReviewAt: null, masteredAt: null,
  totalTimeMs: attempts * 9_000,
});

const masteredSkill = (startAt: number): SkillState => ({
  ...learnedSkill(startAt, 1.6, 0.98, 30),
  masteredAt: startAt - 30 * DAY, reviewIntervalDays: 4, nextReviewAt: startAt + 6 * DAY,
});

const FOUNDATIONS = [
  'number-sense', 'addition', 'subtraction', 'place-value', 'multiplication', 'division', 'factors-primes',
];

interface LearnerSpec {
  letter: string;
  /** Fractions (Year 4-5) is the skill this learner is still shaky on. */
  fractions: { ability: number; pKnown: number; attempts: number };
  intelligence?: (state: LearningIntelligenceState, startAt: number) => LearningIntelligenceState;
}

/**
 * Earlier clean work that already shows two foundation concepts are secure, so
 * the teacher route goes straight to the fractions objective instead of
 * detouring through them. Invented evidence, attached to a synthetic learner.
 */
function priorFoundationHistory(startAt: number): AnswerRecord[] {
  const entry = (i: number, skillId: string, canonicalNodeId: string): AnswerRecord => ({
    at: startAt - (10 - i) * DAY,
    skillId,
    level: 3,
    correct: true,
    timeMs: 9_000,
    predicted: 0.8,
    curriculumEvidence: [{ curriculumId: 'au-ac-v9', canonicalNodeId, strength: 'direct' }],
  });
  return [
    ...Array.from({ length: 6 }, (_, i) => entry(i, 'multiplication', 'math.facts.mul-div-10x10')),
    ...Array.from({ length: 6 }, (_, i) => entry(i, 'factors-primes', 'math.number.factors-multiples-divisibility')),
  ];
}

function syntheticLearner(spec: LearnerSpec, startAt: number): Profile {
  let intelligence = setCurriculumContext(emptyLearningIntelligence(), {
    jurisdiction: 'AU', curriculumId: 'au-ac-v9', curriculumVersion: '9.0', yearLevel: '5',
  });
  if (spec.intelligence) intelligence = spec.intelligence(intelligence, startAt);
  const skills: Record<string, SkillState> = Object.fromEntries(FOUNDATIONS.map((id) => [id, masteredSkill(startAt)]));
  skills.fractions = learnedSkill(startAt, spec.fractions.ability, spec.fractions.pKnown, spec.fractions.attempts);
  return {
    id: `${SYNTHETIC_ID_PREFIX}${spec.letter.toLowerCase()}`,
    name: `${SYNTHETIC_NAME_PREFIX} ${spec.letter}`,
    avatar: '',
    year: 5,
    createdAt: startAt - 60 * DAY,
    skills,
    history: priorFoundationHistory(startAt),
    recentQuestionIds: [],
    misconceptions: {},
    help: emptyHelp(),
    badges: {},
    rewards: {},
    rewardsSetUp: true,
    currency: '$',
    xp: 0,
    checkpoints: [],
    settings: { ...DEFAULT_SETTINGS },
    sats: [],
    learningIntelligence: intelligence,
  };
}

const objective = australianTeacherObjective('au5-fractions-add-subtract')!;
const homework = structuredHomework(objective, FIXTURE_START, { priority: 1 });

const right = (extraHelp = false): Move => ({ kind: 'answer', outcome: 'right', ...(extraHelp ? { extraHelp } : {}) });
const wrongTops = (): Move => ({ kind: 'answer', outcome: 'add-across' });
const wrongOther = (): Move => ({ kind: 'answer', outcome: 'other-wrong' });
const rep = (count: number, move: () => Move): Move[] => Array.from({ length: count }, move);

const outcomesFor = (
  state: LearningIntelligenceState,
  strategy: SupportStrategyId,
  deltas: readonly number[],
  startAt: number,
): LearningIntelligenceState =>
  deltas.reduce(
    (acc, delta, i) => recordSupportOutcome(acc, {
      strategy, at: startAt - (deltas.length - i + 2) * DAY, delta, weight: 0.5, source: 'observed-learning',
      subject: 'maths', skillId: 'fractions-y6',
    }),
    state,
  );

export const SCENARIO_A: Scenario = {
  meta: {
    id: 'a-tops-and-bottoms',
    title: 'Learner A: adds the tops and the bottoms',
    summary: 'A synthetic Year 5 learner meets related-denominator addition, makes the classic mistake, gets stuck, is helped, and works back up on their own.',
    demonstrates: 'A first wrong answer is a possible slip, a second makes a pattern. Help never skips ahead, and only an unaided answer ends the episode.',
    source: 'live-engine-synthetic',
  },
  seed: 5101,
  startAt: FIXTURE_START,
  homework,
  profile: () => syntheticLearner({ letter: 'A', fractions: { ability: 0.4, pKnown: 0.55, attempts: 14 } }, FIXTURE_START),
  moves: [right(), right(), wrongTops(), wrongTops(), right(), right(), right(), right(), right(), right(), right()],
};

export const SCENARIO_B: Scenario = {
  meta: {
    id: 'b-different-help',
    title: 'Learner B: a different kind of help comes first',
    summary: 'A second synthetic learner whose parent and learner have stated preferences, and whose past results favour one kind of help over another.',
    demonstrates: 'Past results lead, stated preferences only nudge, and measured results only count once repeated. The same mistake leads to a different first kind of help.',
    source: 'live-engine-synthetic',
  },
  seed: 5102,
  startAt: FIXTURE_START,
  homework,
  profile: () => syntheticLearner({
    letter: 'B',
    fractions: { ability: 0.4, pKnown: 0.55, attempts: 14 },
    intelligence: (state, startAt) => {
      let next = setSupportPreference(state, { strategy: 'worked-examples', source: 'learner', value: 'prefer', at: startAt - 5 * DAY });
      next = setSupportPreference(next, { strategy: 'smaller-steps', source: 'parent', value: 'prefer', at: startAt - 5 * DAY });
      next = outcomesFor(next, 'graduated-hints', [-0.6, -0.4, -0.5, -0.6], startAt);
      next = outcomesFor(next, 'similar-problem', [0.9, 0.8, 0.7, 0.9], startAt);
      return next;
    },
  }, FIXTURE_START),
  moves: [right(), right(), wrongTops(), right(), right(), right(), right()],
};

export const SCENARIO_C: Scenario = {
  meta: {
    id: 'c-leaves-and-returns',
    title: 'Learner C: leaves mid-help and returns',
    summary: 'A third synthetic learner gets stuck, closes the app, and comes back. A week later a question with no help checks whether it stuck.',
    demonstrates: 'An open help episode survives leaving and is resumed. A helped answer is practice, not proof. Only a no-help answer after a gap counts as an independent delayed check.',
    source: 'live-engine-synthetic',
  },
  seed: 5103,
  startAt: FIXTURE_START,
  homework,
  profile: () => syntheticLearner({ letter: 'C', fractions: { ability: 0.4, pKnown: 0.55, attempts: 14 } }, FIXTURE_START),
  moves: [
    right(), wrongOther(), { kind: 'leave', label: 'Closes the app part-way through' },
    { kind: 'wait', days: 1, label: 'Returns the next day' },
    ...rep(5, right),
    { kind: 'wait', days: 8, label: 'A week and a day later' },
    right(),
  ],
};

export const SCENARIOS: readonly Scenario[] = [SCENARIO_A, SCENARIO_B, SCENARIO_C];

export function scenarioById(id: string): Scenario | null {
  return SCENARIOS.find((scenario) => scenario.meta.id === id) ?? null;
}
