import type { AnswerEvent } from './api';
import { isMastered } from './brain/model';
import type { AnswerResult, Plan } from './brain/tutor';
import type { CurriculumEvidenceRecord, Question, SkillState } from './brain/types';
import type { AustralianPracticeRoute } from './curriculum/australia-intent-routing';

export const PILOT_EVIDENCE_VERSION = 1 as const;

export function newMissionEvidenceId(
  at = Date.now(),
  random: () => number = Math.random,
): string {
  return `m-${at.toString(36)}-${Math.floor(random() * 0x1_0000_0000).toString(36)}`;
}

export interface PilotAnswerEvidenceInput {
  at: number;
  timeMs: number;
  sessionId: string;
  sessionPosition: number;
  question: Question;
  itemKey: string;
  correct: boolean;
  hinted: boolean;
  plan: Plan;
  result: Pick<AnswerResult, 'predicted' | 'misconception' | 'rapid' | 'event'>;
  before: SkillState;
  after: SkillState;
  curriculumEvidence: readonly CurriculumEvidenceRecord[];
  teacherRoute?: AustralianPracticeRoute;
}

/**
 * Structured research telemetry for one practice answer.
 *
 * This deliberately contains no names, raw answers, tutor chat, teacher notes,
 * parent notes, diagnosis fields or free text. Server storage still requires
 * the parent's separate research opt-in.
 */
export function pilotAnswerEvent(input: PilotAnswerEvidenceInput): AnswerEvent {
  const primaryEvidence = input.curriculumEvidence[0];
  const dueReview =
    input.before.masteredAt !== null
    && input.before.nextReviewAt !== null
    && input.before.nextReviewAt <= input.at;

  return {
    eventVersion: PILOT_EVIDENCE_VERSION,
    at: input.at,
    skillId: input.question.skillId,
    level: input.question.level,
    itemKey: input.itemKey,
    correct: input.correct,
    hinted: input.hinted,
    rapid: input.result.rapid,
    timeMs: input.timeMs,
    predicted: input.result.predicted,
    misconception: input.result.misconception,
    strategy: input.plan.strategy ?? null,
    sessionId: input.sessionId,
    sessionPosition: input.sessionPosition,
    planReason: input.plan.reason,
    helpEvent: input.result.event,
    diagnostic: !!input.plan.diagnostic,
    dueReview,
    curriculumId: primaryEvidence?.curriculumId ?? null,
    canonicalNodeId: primaryEvidence?.canonicalNodeId ?? null,
    evidenceStrength: primaryEvidence?.strength ?? null,
    teacherTargetNodeId: input.teacherRoute?.targetCanonicalNodeId ?? null,
    teacherRouteReason: input.teacherRoute?.reason ?? null,
    pKnownBefore: input.before.pKnown,
    pKnownAfter: input.after.pKnown,
    abilityBefore: input.before.ability,
    abilityAfter: input.after.ability,
    masteredAfter: isMastered(input.after),
  };
}
