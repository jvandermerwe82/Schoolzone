/**
 * How independent was an attempt?
 *
 * SchoolZone must never treat a helped answer as proof that a child can do
 * something alone. This module is the single place that decides, for
 * presentation and analytics, which of four kinds an attempt was:
 *
 *   assisted-practice          any help was in use (hint, visual guide, worked
 *                              example, tutor chat, or a help-episode strategy)
 *   unaided-demonstration      no help, practised recently: "what can you do now?"
 *   due-review                 the engine's scheduled review of an earlier skill
 *   independent-delayed-check  no help, and a week or more since this skill was
 *                              last practised
 *
 * This is a LABELLING rule over existing engine fields. It does not change how
 * the learner model, mastery or canonical evidence are calculated.
 */
import type { Reason } from '../brain/tutor';
import type { AnswerRecord, StrategyId } from '../brain/types';

const DAY_MS = 86_400_000;

/**
 * A skill left alone for at least this long, then answered with no help, is an
 * "independent delayed check". The engine's first review interval is one day
 * and grows from there, so a week is a clear, reachable "after a proper break".
 * Presentation threshold only; pending agreement with the pilot-evidence owners.
 */
export const DELAYED_CHECK_MIN_GAP_MS = 7 * DAY_MS;

export type AttemptMode =
  | 'assisted-practice'
  | 'unaided-demonstration'
  | 'due-review'
  | 'independent-delayed-check';

export interface AttemptModeInfo {
  mode: AttemptMode;
  /** For adults and the lab. */
  label: string;
  /** For the learner. Short, never a verdict. */
  childLabel: string;
  /** Plain-language reason, safe to show next to the label. */
  explanation: string;
  /** True when the answer can count as independent evidence. */
  independent: boolean;
}

export interface AttemptInput {
  /** Any help was in use: hint, visual guide, worked example, tutor chat. */
  hinted: boolean;
  /** How the tutor was helping at the time, if it was. */
  strategy?: StrategyId | 'climb' | null;
  /** Why the engine chose this question. */
  planReason?: Reason | null;
  /** Time since this skill was last practised; null if never. */
  msSincePreviousAttempt?: number | null;
}

export const MODE_INFO: Readonly<Record<AttemptMode, Omit<AttemptModeInfo, 'mode'>>> = {
  'assisted-practice': {
    label: 'Assisted practice',
    childLabel: 'Practice with help',
    explanation: 'Help was in use, so this builds skill but does not show what you can do alone.',
    independent: false,
  },
  'unaided-demonstration': {
    label: 'Unaided demonstration',
    childLabel: 'On your own',
    explanation: 'No help was used, so this shows what you can do on your own right now.',
    independent: true,
  },
  'due-review': {
    label: 'Due review',
    childLabel: 'Keep it strong',
    explanation: 'A scheduled review of something learned earlier, to keep it from fading.',
    independent: true,
  },
  'independent-delayed-check': {
    label: 'Independent delayed check',
    childLabel: 'Remember it?',
    explanation: 'No help, and a week or more since last practice: the strongest sign that learning has stuck.',
    independent: true,
  },
};

/** True while the tutor is using a help strategy. 'climb' is the child working back up unaided. */
export const isHelpStrategy = (strategy: StrategyId | 'climb' | null | undefined): strategy is StrategyId =>
  !!strategy && strategy !== 'climb';

/**
 * Assisted if the child used any help, or the tutor was teaching with a help
 * strategy when the question was served. Precedence: assisted beats everything,
 * so a helped answer can never be promoted to "independent".
 */
export function classifyAttempt(input: AttemptInput): AttemptModeInfo {
  const { hinted, strategy, planReason, msSincePreviousAttempt } = input;
  let mode: AttemptMode;
  if (hinted || isHelpStrategy(strategy)) mode = 'assisted-practice';
  else if (msSincePreviousAttempt != null && msSincePreviousAttempt >= DELAYED_CHECK_MIN_GAP_MS) mode = 'independent-delayed-check';
  else if (planReason === 'review') mode = 'due-review';
  else mode = 'unaided-demonstration';
  return { mode, ...MODE_INFO[mode] };
}

/** An answer already in the history, classified without needing the plan. */
export function classifyRecord(record: AnswerRecord, previousAttemptAt: number | null): AttemptModeInfo {
  return classifyAttempt({
    hinted: !!record.hinted,
    strategy: record.strategy ?? null,
    planReason: null,
    msSincePreviousAttempt: previousAttemptAt === null ? null : record.at - previousAttemptAt,
  });
}

/**
 * Does this stored answer count as an independent attempt? Rapid guesses are
 * excluded: they are not a real attempt either way.
 */
export const isIndependentRecord = (record: AnswerRecord): boolean =>
  !record.hinted && !record.rapid && !isHelpStrategy(record.strategy ?? null);
