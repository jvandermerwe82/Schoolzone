/**
 * Curriculum-pack contracts.
 *
 * Core SchoolZone intelligence should reference canonical skills and these
 * curriculum mappings rather than hard-coding one country's year structure.
 */

export interface CurriculumFramework {
  /** Stable id used in stored learner context, e.g. "au-ac-v9". */
  id: string;
  name: string;
  jurisdiction: string;
  version: string;
  /** Human-readable provenance/source URL or document identifier. */
  source: string;
}

export interface CurriculumReference {
  /** Stable curriculum-pack reference. */
  id: string;
  frameworkId: string;
  subject: string;
  yearLevel: string;
  code?: string;
  title: string;
  description?: string;
}

/**
 * Many curriculum statements can map to one SchoolZone skill and one statement
 * may require several SchoolZone skills. Keep the mapping many-to-many.
 */
export interface CurriculumSkillMapping {
  curriculumRefId: string;
  skillId: string;
  /** Why this mapping exists; useful for review/audit when curricula change. */
  rationale: string;
  /** Mapping confidence is editorial/review confidence, not learner confidence. */
  confidence: 'provisional' | 'reviewed' | 'verified';
}
