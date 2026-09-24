import type { CurriculumReference, CurriculumSkillMapping } from './types';

const FRAMEWORK = 'au-ac-v9';

const ref = (
  code: string,
  subject: 'mathematics' | 'english' | 'science',
  yearLevel: '4' | '5' | '6',
  title: string,
): CurriculumReference => ({
  id: `${FRAMEWORK}:${code}`,
  frameworkId: FRAMEWORK,
  subject,
  yearLevel,
  code,
  title,
});

/**
 * Verified AC v9 references used by the first SchoolZone reuse audit.
 *
 * Titles are concise SchoolZone labels rather than substitutes for the official
 * content descriptions. The ACARA/QCAA source remains authoritative.
 */
export const AUSTRALIAN_V9_REFERENCES: readonly CurriculumReference[] = [
  // Mathematics
  ref('AC9M4A02', 'mathematics', '4', 'Multiplication facts, division facts and efficient mental strategies'),
  ref('AC9M5N01', 'mathematics', '5', 'Decimal place value, comparison and ordering'),
  ref('AC9M5N02', 'mathematics', '5', 'Factors, multiples and divisibility'),
  ref('AC9M5N04', 'mathematics', '5', 'Percentages and fraction/decimal equivalents'),
  ref('AC9M5N05', 'mathematics', '5', 'Add and subtract fractions with related denominators'),
  ref('AC9M5N06', 'mathematics', '5', 'Multiply larger numbers efficiently'),
  ref('AC9M5N07', 'mathematics', '5', 'Division strategies and interpreting remainders'),
  ref('AC9M5A02', 'mathematics', '5', 'Unknown values in multiplication and division equations'),
  ref('AC9M6N01', 'mathematics', '6', 'Integers on number lines and the Cartesian plane'),
  ref('AC9M6N02', 'mathematics', '6', 'Prime, composite and square numbers'),
  ref('AC9M6N04', 'mathematics', '6', 'Add and subtract decimals using place value'),
  ref('AC9M6N05', 'mathematics', '6', 'Add and subtract fractions using equivalent fractions'),
  ref('AC9M6N06', 'mathematics', '6', 'Multiply and divide decimals by powers of 10'),
  ref('AC9M6N07', 'mathematics', '6', 'Find a fraction, decimal or percentage of a quantity'),
  ref('AC9M6A02', 'mathematics', '6', 'Unknown values with brackets and combined operations'),
  ref('AC9M6M02', 'mathematics', '6', 'Area of rectangles'),
  ref('AC9M6M04', 'mathematics', '6', 'Angle relationships and unknown angles'),

  // English
  ref('AC9E5LY05', 'english', '5', 'Comprehension strategies for literal and inferred meaning'),
  ref('AC9E5LY08', 'english', '5', 'Phonic and morphemic knowledge for reading and spelling'),
  ref('AC9E5LY09', 'english', '5', 'Build and spell words using morphology, origins and spelling generalisations'),
  ref('AC9E5LY10', 'english', '5', 'Less common plurals and suffix effects'),
  ref('AC9E6LY05', 'english', '6', 'Comprehension across sources using literal and inferred meaning'),
  ref('AC9E6LY08', 'english', '6', 'Phonic knowledge for increasingly complex words'),
  ref('AC9E6LY09', 'english', '6', 'Spell complex and technical words using morphology and word origins'),
  ref('AC9E6LA09', 'english', '6', 'Comma use in lists, clauses and dialogue'),

  // Science
  ref('AC9S5U01', 'science', '5', 'Structural and behavioural adaptations for survival'),
  ref('AC9S5U02', 'science', '5', 'Weathering, erosion, transportation and deposition'),
  ref('AC9S5U03', 'science', '5', 'Light sources, straight-line travel, shadows, reflection and refraction'),
  ref('AC9S5U04', 'science', '5', 'Particle model of solids, liquids and gases'),
  ref('AC9S6U01', 'science', '6', 'Habitat conditions and their effects on living things'),
  ref('AC9S6U02', 'science', '6', 'Earth and planets relative to the sun and cyclic phenomena'),
  ref('AC9S6U03', 'science', '6', 'Energy transfer and transformation in electrical circuits'),
  ref('AC9S6U04', 'science', '6', 'Reversible and irreversible changes to substances'),
] as const;

const map = (
  code: string,
  skillId: string,
  coverage: CurriculumSkillMapping['coverage'],
  rationale: string,
  confidence: CurriculumSkillMapping['confidence'] = 'verified',
): CurriculumSkillMapping => ({
  curriculumRefId: `${FRAMEWORK}:${code}`,
  skillId,
  coverage,
  rationale,
  confidence,
});

/**
 * Initial many-to-many reuse map from the existing England-focused SchoolZone
 * skill graph to Australian Curriculum v9.
 *
 * "verified" means the curriculum code and conceptual relationship were
 * checked against current AC v9/QCAA material. It does not claim the existing
 * question bank completely covers that content description.
 */
export const AUSTRALIAN_V9_EXISTING_SKILL_MAPPINGS: readonly CurriculumSkillMapping[] = [
  map('AC9M4A02', 'multiplication', 'partial', 'Existing times-table and multiplication work supports the Year 4 proficiency expectation but does not yet model the complete Australian descriptor.'),
  map('AC9M4A02', 'division', 'partial', 'Existing division work supports related division facts and strategy fluency but requires Australian scope review.'),

  map('AC9M5N02', 'factors-primes', 'partial', 'Existing skill directly teaches factors and multiples; divisibility coverage needs to be checked and extended.'),
  map('AC9M6N02', 'factors-primes', 'partial', 'Prime-number content is reusable, but Australian Year 6 also requires composite and square-number properties.'),

  map('AC9M6N01', 'negative-numbers', 'partial', 'Negative-number work transfers to integer number-line reasoning; Cartesian coordinates and financial contexts are missing.'),
  map('AC9M6A02', 'order-of-operations', 'partial', 'Brackets and combinations of operations are already taught; Australian mapping also expects solving for unknown values.'),
  map('AC9M5N06', 'long-multiplication-division', 'strong', 'Existing larger-number multiplication substantially overlaps Year 5 multiplication expectations.'),
  map('AC9M5N07', 'long-multiplication-division', 'partial', 'Existing division is reusable, but interpretation of remainders as whole number, decimal or fraction needs explicit coverage.'),

  map('AC9M5N05', 'fractions-y6', 'partial', 'Existing fraction addition work overlaps, but the skill mixes England Year 6 content beyond this Australian Year 5 descriptor.'),
  map('AC9M6N05', 'fractions-y6', 'partial', 'Equivalent-fraction addition/subtraction is reusable; current multiplication/division of fractions should not be treated as Year 6 Australian coverage.'),

  map('AC9M5N01', 'decimals-percentages', 'partial', 'Existing decimal content is useful but the current skill is broader and must be separated by outcome.'),
  map('AC9M5N04', 'decimals-percentages', 'strong', 'Fraction-decimal-percentage equivalence is a direct existing focus.'),
  map('AC9M6N04', 'decimals-percentages', 'partial', 'Existing decimal operations overlap but need explicit Australian Year 6 addition/subtraction coverage.'),
  map('AC9M6N06', 'decimals-percentages', 'partial', 'Place-value work is reusable; powers-of-10 decimal operations need explicit coverage review.'),
  map('AC9M6N07', 'decimals-percentages', 'strong', 'Finding percentages of amounts and fraction/decimal/percentage reasoning are already central to the skill.'),

  map('AC9M5A02', 'algebra', 'partial', 'Missing-number equations are reusable; current algebra scope is broader than the Year 5 descriptor.'),
  map('AC9M6A02', 'algebra', 'partial', 'Unknown-value and operation reasoning overlaps but must be aligned to the Australian combinations-of-operations expectation.'),

  map('AC9M6M02', 'geometry-statistics', 'partial', 'The existing combined skill includes area but uses triangle/parallelogram content that does not equal the Australian Year 6 rectangle-area requirement.'),
  map('AC9M6M04', 'geometry-statistics', 'partial', 'Missing-angle reasoning transfers; the current combined geometry/statistics skill should be split before claiming full coverage.'),

  map('AC9E5LY05', 'reading-y6', 'strong', 'Current reading questions already test literal meaning, inference, vocabulary and summarising, but Australian tagging must replace KS2-only domain labels.'),
  map('AC9E6LY05', 'reading-y6', 'strong', 'The comprehension engine is reusable; texts and reporting need Australian curriculum metadata.'),
  map('AC9E5LY08', 'spelling-patterns', 'partial', 'Existing phonics/spelling-pattern practice is reusable after Australian content review.'),
  map('AC9E5LY09', 'spelling-patterns', 'partial', 'Prefixes, suffixes, letter patterns and spelling generalisations overlap the existing skill.'),
  map('AC9E5LY10', 'spelling-patterns', 'partial', 'Suffix effects overlap but need Australian examples and explicit coverage.'),
  map('AC9E6LY08', 'spelling-patterns', 'partial', 'Complex word decoding/spelling overlaps but must use Australian Year 6 scope.'),
  map('AC9E6LY09', 'spelling-patterns', 'partial', 'Word origins, roots, affixes and spelling generalisations overlap the existing skill.'),

  map('AC9S5U03', 'light-y6', 'strong', 'The existing light skill closely matches Year 5 Australian light, shadows, reflection and straight-line travel; refraction coverage must be confirmed in the question bank.'),
  map('AC9S5U04', 'materials', 'strong', 'The existing states-of-matter foundation substantially overlaps the Year 5 particle-model content, subject to question-bank review.'),
  map('AC9S6U02', 'earth-space', 'partial', 'Sun/planet content is reusable, but the existing skill also contains unrelated weather content and needs Australian cyclic-phenomena coverage.'),
  map('AC9S6U03', 'electricity-y6', 'strong', 'Series-circuit and component content is reusable; energy-transfer language, insulators and conductors need explicit audit.'),
  map('AC9S5U01', 'living-things', 'partial', 'The generic living-things foundation can support adaptations but does not itself cover the Year 5 descriptor.'),
  map('AC9S6U01', 'living-things', 'partial', 'The generic foundation supports habitat reasoning but not the required analysis of changing physical conditions.'),
] as const;

export type ExistingAustralianCoverage =
  | 'strong-reuse'
  | 'partial-reuse'
  | 'replace-or-split'
  | 'foundation-only'
  | 'no-direct-years-4-6-match';

export interface ExistingSkillAudit {
  skillId: string;
  status: ExistingAustralianCoverage;
  note: string;
}

/**
 * Audit every current canonical skill so that "not mapped" never silently
 * becomes "covered".
 */
export const AUSTRALIAN_V9_EXISTING_SKILL_AUDIT: readonly ExistingSkillAudit[] = [
  { skillId: 'number-sense', status: 'foundation-only', note: 'Keep as prerequisite remediation; it is below the initial Years 4–6 launch focus.' },
  { skillId: 'addition', status: 'foundation-only', note: 'Keep as prerequisite remediation.' },
  { skillId: 'subtraction', status: 'foundation-only', note: 'Keep as prerequisite remediation.' },
  { skillId: 'place-value', status: 'partial-reuse', note: 'Reusable, but the existing scope is not yet mapped to Australian decimal place-value outcomes.' },
  { skillId: 'multiplication', status: 'partial-reuse', note: 'Reusable foundation for Year 4 and later number work.' },
  { skillId: 'division', status: 'partial-reuse', note: 'Reusable foundation for Year 4 and later number work.' },
  { skillId: 'fractions', status: 'partial-reuse', note: 'Reusable foundation; Australian Year 4 fraction outcomes require a separate verified mapping pass.' },
  { skillId: 'negative-numbers', status: 'partial-reuse', note: 'Maps into Australian Year 6 integer work but does not cover coordinates.' },
  { skillId: 'factors-primes', status: 'partial-reuse', note: 'Strong reuse, with composite/square number and divisibility extensions needed.' },
  { skillId: 'order-of-operations', status: 'partial-reuse', note: 'Reusable, but the Australian outcome is framed around unknown values and combinations of operations.' },
  { skillId: 'long-multiplication-division', status: 'strong-reuse', note: 'Good Year 5 reuse with remainder interpretation to extend.' },
  { skillId: 'fractions-y6', status: 'replace-or-split', note: 'Current England Year 6 skill mixes content across Australian year levels; split into canonical fraction outcomes.' },
  { skillId: 'decimals-percentages', status: 'replace-or-split', note: 'Highly reusable content but currently combines several Australian Year 5–6 outcomes in one skill.' },
  { skillId: 'algebra', status: 'replace-or-split', note: 'Reusable question ideas, but split to Australian unknown-value and pattern outcomes.' },
  { skillId: 'geometry-statistics', status: 'replace-or-split', note: 'Must split geometry, measurement and statistics; the current combined skill does not mirror AC v9 strands.' },

  { skillId: 'living-things', status: 'foundation-only', note: 'Useful prerequisite but too broad to count as Australian Years 5–6 biological science coverage.' },
  { skillId: 'human-body', status: 'no-direct-years-4-6-match', note: 'Retain as enrichment/prerequisite; it is not a direct Australian Years 5–6 Science Understanding match.' },
  { skillId: 'materials', status: 'strong-reuse', note: 'Good base for Year 5 solids, liquids, gases and particles.' },
  { skillId: 'forces-energy', status: 'foundation-only', note: 'Useful prerequisite, but Australian light and electricity should be separate canonical skills.' },
  { skillId: 'earth-space', status: 'replace-or-split', note: 'Reusable astronomy content, but scope/year placement differs and weather should be separated.' },
  { skillId: 'classification', status: 'no-direct-years-4-6-match', note: 'England Year 6 classification is not a direct Australian Years 4–6 v9 Science Understanding outcome.' },
  { skillId: 'circulatory-system', status: 'no-direct-years-4-6-match', note: 'England Year 6 body-system content is not a direct Australian Years 4–6 v9 Science Understanding outcome.' },
  { skillId: 'evolution-inheritance', status: 'no-direct-years-4-6-match', note: 'England Year 6 evolution content is not a direct Australian Years 4–6 v9 Science Understanding outcome.' },
  { skillId: 'light-y6', status: 'strong-reuse', note: 'Move conceptually to Australian Year 5 and audit refraction coverage.' },
  { skillId: 'electricity-y6', status: 'strong-reuse', note: 'Good Australian Year 6 base; extend energy transfer, conductors and insulators.' },

  { skillId: 'spelling-words', status: 'replace-or-split', note: 'The England Years 5–6 statutory word list must not be presented as Australian curriculum content.' },
  { skillId: 'spelling-patterns', status: 'strong-reuse', note: 'Pattern engine is reusable; examples and progression must be rebuilt around Australian v9 outcomes.' },
  { skillId: 'homophones', status: 'partial-reuse', note: 'Useful spelling content, but it should sit inside a broader Australian word-knowledge progression rather than stand alone.' },
  { skillId: 'grammar-y6', status: 'replace-or-split', note: 'Question ideas may be reused, but Australian grammar progression and terminology require remapping.' },
  { skillId: 'punctuation-y6', status: 'replace-or-split', note: 'Current semicolon/colon/dash-heavy England Year 6 scope should not be rebadged as Australian Year 6.' },
  { skillId: 'reading-y6', status: 'strong-reuse', note: 'Comprehension engine and original texts are reusable; replace KS2-only reporting taxonomy with Australian curriculum tagging.' },
] as const;

export interface AustralianContentGap {
  subject: 'mathematics' | 'english' | 'science';
  priority: 'launch-critical' | 'important';
  gap: string;
  reason: string;
}

/** Highest-value gaps discovered in the first reuse audit. */
export const AUSTRALIAN_V9_INITIAL_GAPS: readonly AustralianContentGap[] = [
  { subject: 'mathematics', priority: 'launch-critical', gap: 'Split current combined maths skills into canonical Number, Algebra, Measurement, Space, Statistics and Probability outcomes.', reason: 'The current England-focused graph combines multiple Australian strands, which would make mastery reporting inaccurate.' },
  { subject: 'mathematics', priority: 'launch-critical', gap: 'Complete Years 4–6 Space, Statistics and Probability coverage.', reason: 'Current content is concentrated in Number with only limited geometry/statistics.' },
  { subject: 'english', priority: 'launch-critical', gap: 'Replace the England statutory spelling-list product path with Australian Year 4–6 word-knowledge progression.', reason: 'The current 100-word list is jurisdiction-specific and cannot be treated as Australian curriculum coverage.' },
  { subject: 'english', priority: 'launch-critical', gap: 'Add Australian curriculum tagging for reading and rebuild grammar/punctuation progression.', reason: 'The comprehension engine is reusable, but KS2 domains and England Year 6 grammar/punctuation labels are not Australian reporting structures.' },
  { subject: 'english', priority: 'important', gap: 'Expand beyond selected-response practice into creating texts and oral/interaction evidence where appropriate.', reason: 'Australian English achievement standards include creation and interaction, not only reading and conventions.' },
  { subject: 'science', priority: 'launch-critical', gap: 'Add Year 5 adaptations and Earth-surface change as explicit canonical skills.', reason: 'AC9S5U01 and AC9S5U02 are not fully represented by the current UK skill graph.' },
  { subject: 'science', priority: 'launch-critical', gap: 'Add Year 6 habitat-conditions and reversible/irreversible changes as explicit canonical skills.', reason: 'AC9S6U01 and AC9S6U04 are missing from current Year 6 science content.' },
  { subject: 'science', priority: 'important', gap: 'Add Science Inquiry and Science as a Human Endeavour evidence pathways.', reason: 'Australian Science is broader than Science Understanding recall questions.' },
] as const;

export function australianReference(code: string): CurriculumReference | null {
  return AUSTRALIAN_V9_REFERENCES.find((item) => item.code === code) ?? null;
}

export function australianMappingsForSkill(skillId: string): CurriculumSkillMapping[] {
  return AUSTRALIAN_V9_EXISTING_SKILL_MAPPINGS.filter((item) => item.skillId === skillId);
}
