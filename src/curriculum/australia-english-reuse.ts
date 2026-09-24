import type { CurriculumSkillMapping } from './types';

export interface EnglishExistingReuse extends CurriculumSkillMapping {
  canonicalNodeId: string;
}

/**
 * Current SchoolZone English content mapped to the first Australian core nodes.
 * No mapping is provided for the England statutory spelling-list skill because
 * that list is jurisdiction-specific and must not be rebadged for Australia.
 */
export const AUSTRALIAN_ENGLISH_EXISTING_REUSE: readonly EnglishExistingReuse[] = [
  {
    curriculumRefId: 'au-ac-v9:AC9E4LY05',
    canonicalNodeId: 'english.reading.comprehension-y4',
    skillId: 'reading-y6',
    coverage: 'partial',
    rationale: 'The current comprehension engine tests literal meaning, inference, vocabulary and summarising; Year 4 Australian progression and text range still need explicit calibration.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E5LY05',
    canonicalNodeId: 'english.reading.comprehension-y5',
    skillId: 'reading-y6',
    coverage: 'strong',
    rationale: 'Current original passages and questions strongly support literal/inferred meaning and evaluation, with Australian reporting tags still required.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E6LY05',
    canonicalNodeId: 'english.reading.comprehension-y6',
    skillId: 'reading-y6',
    coverage: 'partial',
    rationale: 'The engine is reusable but needs explicit cross-source comparison and Australian curriculum tagging.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E4LY11',
    canonicalNodeId: 'english.spelling.homophones-context-y4',
    skillId: 'homophones',
    coverage: 'strong',
    rationale: 'The current homophone bank directly supports contextual spelling choice, subject to Australian examples and review.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E5LY09',
    canonicalNodeId: 'english.spelling.word-building-y5',
    skillId: 'spelling-patterns',
    coverage: 'partial',
    rationale: 'Prefixes, suffixes, letter patterns and spelling generalisations overlap strongly; word-origin progression needs expansion.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E6LY09',
    canonicalNodeId: 'english.spelling.roots-technical-y6',
    skillId: 'spelling-patterns',
    coverage: 'partial',
    rationale: 'Existing patterns are reusable but Greek/Latin roots and technical vocabulary need explicit expansion.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E5LA05',
    canonicalNodeId: 'english.grammar.complex-sentence-effect-y5',
    skillId: 'grammar-y6',
    coverage: 'partial',
    rationale: 'Current grammar questions include sentence structure, but the skill must be decomposed and reviewed against Australian terminology.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9E6LA09',
    canonicalNodeId: 'english.punctuation.commas-y6',
    skillId: 'punctuation-y6',
    coverage: 'partial',
    rationale: 'Some current punctuation content is reusable, but the England semicolon/colon emphasis does not equal Australian Year 6 comma expectations.',
    confidence: 'verified',
  },
];

export const AUSTRALIAN_ENGLISH_REPLACE_NOT_REBADGE = [
  {
    skillId: 'spelling-words',
    reason: 'The England Years 5-6 statutory spelling list is jurisdiction-specific and has no direct Australian Curriculum equivalent.',
  },
  {
    skillId: 'punctuation-y6',
    reason: 'The existing England Year 6 punctuation scope contains semicolons, colons and dashes that must not be presented as the Australian Year 6 punctuation progression.',
  },
] as const;

export const AUSTRALIAN_ENGLISH_MAJOR_GAPS = [
  'full Literature strand progression and text-context evidence',
  'spoken interaction and oral/multimodal presentation evidence',
  'creating and editing extended imaginative, informative and persuasive texts',
  'reading fluency/navigation progression beyond the current comprehension engine',
  'Australian Year 4-6 writing assessment and teacher-observation pathways',
] as const;
