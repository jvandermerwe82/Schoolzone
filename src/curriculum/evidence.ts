import type { CurriculumEvidenceRecord, Level, Profile, Question } from '../brain/types';
import { australianEvidenceForQuestion } from './australia-content-evidence';

export interface CurriculumPracticeFocus {
  curriculumId: string;
  canonicalNodeId: string;
  practiceSkillId: string;
  practiceLevels?: readonly Level[];
  strength: 'direct' | 'supporting';
}

const matchesFocus = (question: Question, focus: CurriculumPracticeFocus): boolean =>
  question.skillId === focus.practiceSkillId
  && (!focus.practiceLevels?.length || focus.practiceLevels.includes(question.level));

/**
 * Curriculum-pack dispatcher.
 *
 * The core Brain never imports country-specific curriculum modules. UI/session
 * code calls this layer, which looks at the learner's explicit curriculum
 * context and returns generic evidence records.
 *
 * When a structured curriculum route is active, only questions that match that
 * route's skill + verified level contract can count toward the active canonical
 * objective. This prevents helper/easier questions from falsely proving the
 * teacher's target.
 */
export function curriculumEvidenceForQuestion(
  profile: Profile,
  question: Question,
  focus?: CurriculumPracticeFocus,
): CurriculumEvidenceRecord[] {
  const context = profile.learningIntelligence?.curriculum;
  if (!context) return [];

  if (
    context.curriculumId === 'au-ac-v9' &&
    (context.yearLevel === '4' || context.yearLevel === '5' || context.yearLevel === '6')
  ) {
    const general = australianEvidenceForQuestion(question, context.yearLevel).map((evidence) => ({
      curriculumId: context.curriculumId,
      canonicalNodeId: evidence.canonicalNodeId,
      strength: evidence.strength,
    }));

    if (focus && focus.curriculumId === context.curriculumId) {
      if (matchesFocus(question, focus)) {
        return [{
          curriculumId: focus.curriculumId,
          canonicalNodeId: focus.canonicalNodeId,
          strength: focus.strength,
        }];
      }
      // While helping outside the verified route, other genuine curriculum
      // evidence may still count, but never the active objective itself.
      return general.filter((evidence) => evidence.canonicalNodeId !== focus.canonicalNodeId);
    }

    return general;
  }

  return [];
}
