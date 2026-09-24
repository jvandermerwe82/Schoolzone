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
  /**
   * Strong means the existing SchoolZone skill substantially teaches the mapped
   * curriculum idea. Partial means useful content exists but the skill must be
   * split, extended or narrowed before it can claim full coverage.
   */
  coverage: 'strong' | 'partial';
  /** Why this mapping exists; useful for review/audit when curricula change. */
  rationale: string;
  /** Mapping confidence is editorial/review confidence, not learner confidence. */
  confidence: 'provisional' | 'reviewed' | 'verified';
}


export type EvidenceMode =
  | 'selected-response'
  | 'typed-response'
  | 'constructed-response'
  | 'practical'
  | 'investigation'
  | 'teacher-observation';

/**
 * Curriculum-independent learning node. Curriculum packs map their official
 * references onto these concepts; the Brain should eventually reason over the
 * canonical node rather than a country-specific curriculum code.
 */
export interface CanonicalLearningNode {
  id: string;
  subject: string;
  name: string;
  strand: string;
  /** Canonical node ids. Cross-year prerequisites can be added as packs expand. */
  prerequisites: string[];
  /** Valid ways SchoolZone may collect evidence for this concept. */
  evidenceModes: EvidenceMode[];
  /** Curriculum-pack references this node currently supports. */
  curriculumRefs: string[];
}
