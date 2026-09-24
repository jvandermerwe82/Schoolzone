import type { CurriculumEvidenceRecord, Profile, Question } from '../brain/types';
import { australianEvidenceForQuestion } from './australia-content-evidence';

/**
 * Curriculum-pack dispatcher.
 *
 * The core Brain never imports country-specific curriculum modules. UI/session
 * code calls this layer, which looks at the learner's explicit curriculum
 * context and returns generic evidence records.
 */
export function curriculumEvidenceForQuestion(
  profile: Profile,
  question: Question,
): CurriculumEvidenceRecord[] {
  const context = profile.learningIntelligence?.curriculum;
  if (!context) return [];

  if (
    context.curriculumId === 'au-ac-v9' &&
    (context.yearLevel === '4' || context.yearLevel === '5' || context.yearLevel === '6')
  ) {
    return australianEvidenceForQuestion(question, context.yearLevel).map((evidence) => ({
      curriculumId: context.curriculumId,
      canonicalNodeId: evidence.canonicalNodeId,
      strength: evidence.strength,
    }));
  }

  return [];
}
