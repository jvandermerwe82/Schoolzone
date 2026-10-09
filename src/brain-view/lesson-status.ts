/**
 * What a child sees about how SchoolZone is helping right now.
 *
 * Pure function over the planner's own Plan and the stored help episode. It
 * only labels what the engine already decided. It never changes mastery,
 * routing or evidence.
 */
import type { Plan } from '../brain/tutor';
import type { StrategyId } from '../brain/types';
import { classifyAttempt, type AttemptModeInfo } from './evidence-mode';

export type RibbonState = 'done' | 'now' | 'next';

export interface LessonStatusView {
  mode: AttemptModeInfo;
  /** One short, kind sentence about the help in use, or null when none is. */
  helpLine: string | null;
  /** The shape of a stuck episode, or null when the child is not in one. */
  ribbon: { label: string; state: RibbonState }[] | null;
  /** True when this question belongs to a help episode (helping or climbing back up). */
  inEpisode: boolean;
}

const HELP_LINE: Record<StrategyId | 'climb', string> = {
  similar: 'Here is one like it. Take your time and check each step.',
  'worked-example': 'Have a look at a solved one first, then it is your turn.',
  hint: 'A hint is switched on for this one.',
  'smaller-steps': 'We are starting a little easier and building back up.',
  prerequisite: 'We are warming up with an earlier skill first, then coming back.',
  climb: 'The help worked. Now try this one on your own.',
};

const RIBBON_LABELS = ['A tricky one', 'Getting help', 'Back on your own'] as const;

export interface LessonStatusInput {
  plan: Pick<Plan, 'reason' | 'strategy'>;
  /** Any help in use for this question: hint, visual guide, worked example, tutor chat. */
  helped: boolean;
  /** Time since this skill was last practised, if ever. */
  msSincePreviousAttempt: number | null;
}

export function lessonStatusFor(input: LessonStatusInput): LessonStatusView {
  const { plan, helped, msSincePreviousAttempt } = input;
  const mode = classifyAttempt({
    hinted: helped,
    strategy: plan.strategy ?? null,
    planReason: plan.reason,
    msSincePreviousAttempt,
  });
  const inEpisode = plan.reason === 'help' || plan.reason === 'climb';
  const ribbon = inEpisode
    ? RIBBON_LABELS.map((label, i) => ({
        label,
        state: (i < (plan.reason === 'help' ? 1 : 2) ? 'done' : i === (plan.reason === 'help' ? 1 : 2) ? 'now' : 'next') as RibbonState,
      }))
    : null;
  return {
    mode,
    helpLine: plan.strategy ? HELP_LINE[plan.strategy] : null,
    ribbon,
    inEpisode,
  };
}

/** A calm sentence after an answer, honest about what kind of attempt it was. */
export function afterAnswerLine(mode: AttemptModeInfo, correct: boolean): string {
  if (mode.mode === 'assisted-practice') {
    return correct
      ? 'Nice work. This one had help, so it builds your skill. A question on your own will show what you can do.'
      : 'That is okay. Getting stuck is part of learning, and SchoolZone will keep helping until it clicks.';
  }
  if (mode.mode === 'independent-delayed-check') {
    return correct
      ? 'You remembered it after a break, with no help. That is a strong sign it has stuck.'
      : 'It has been a while, so this one slipped. That is normal. A little practice will bring it back.';
  }
  if (mode.mode === 'due-review') {
    return correct ? 'Still strong. That is a good sign it is staying with you.' : 'That one needs another look, and we will bring it back soon.';
  }
  return correct ? 'All you. That shows what you can do on your own.' : 'Not yet. We will work out what happened and try another way.';
}
