import type { CanonicalLearningNode, EvidenceMode } from './types';

const AU = 'au-ac-v9:';
const q = (code: string) => `${AU}${code}`;
const read: EvidenceMode[] = ['selected-response', 'typed-response', 'constructed-response'];
const spell: EvidenceMode[] = ['typed-response', 'constructed-response'];
const language: EvidenceMode[] = ['selected-response', 'typed-response', 'constructed-response'];

const node = (
  id: string,
  name: string,
  strand: string,
  code: string,
  evidenceModes: EvidenceMode[],
  prerequisites: string[] = [],
): CanonicalLearningNode => ({
  id,
  subject: 'english',
  name,
  strand,
  prerequisites,
  evidenceModes,
  curriculumRefs: [q(code)],
});

/**
 * Australian Curriculum v9 — focused Years 4-6 English progression for the
 * areas SchoolZone already has a credible product base for.
 *
 * This is intentionally NOT the full English curriculum. Literature creation,
 * speaking/listening, extended text creation and other omitted content remain
 * explicit product gaps rather than being silently treated as covered.
 */
export const AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES: readonly CanonicalLearningNode[] = [
  // ----- Text structure -----
  node(
    'english.text-structure.purpose-y4',
    'Text organisation and purpose',
    'language',
    'AC9E4LA03',
    language,
  ),
  node(
    'english.text-structure.stages-phases-y5',
    'Characteristic stages and phases of texts',
    'language',
    'AC9E5LA03',
    language,
    ['english.text-structure.purpose-y4'],
  ),
  node(
    'english.text-structure.adapt-y6',
    'How authors adapt text structures for purpose',
    'language',
    'AC9E6LA03',
    language,
    ['english.text-structure.stages-phases-y5'],
  ),

  // ----- Reading comprehension -----
  node(
    'english.reading.comprehension-y4',
    'Literal and inferred meaning, topic knowledge and evaluation',
    'literacy',
    'AC9E4LY05',
    read,
  ),
  node(
    'english.reading.comprehension-y5',
    'Literal and inferred meaning, evaluating information and ideas',
    'literacy',
    'AC9E5LY05',
    read,
    ['english.reading.comprehension-y4'],
  ),
  node(
    'english.reading.comprehension-y6',
    'Literal and inferred meaning across multiple sources',
    'literacy',
    'AC9E6LY05',
    read,
    ['english.reading.comprehension-y5'],
  ),

  // ----- Word knowledge and spelling -----
  node(
    'english.spelling.multisyllabic-morphology-y4',
    'Multisyllabic words using phonological and morphological knowledge',
    'literacy',
    'AC9E4LY09',
    spell,
  ),
  node(
    'english.spelling.patterns-origins-y4',
    'Letter patterns, word families, affixes and word origins',
    'literacy',
    'AC9E4LY10',
    spell,
    ['english.spelling.multisyllabic-morphology-y4'],
  ),
  node(
    'english.spelling.homophones-context-y4',
    'High-frequency words and homophones in context',
    'literacy',
    'AC9E4LY11',
    spell,
  ),
  node(
    'english.spelling.pattern-pronunciation-y5',
    'Common letter patterns with different pronunciations',
    'literacy',
    'AC9E5LY08',
    spell,
    ['english.spelling.multisyllabic-morphology-y4'],
  ),
  node(
    'english.spelling.word-building-y5',
    'Build words from bases, affixes, origins and spelling generalisations',
    'literacy',
    'AC9E5LY09',
    spell,
    ['english.spelling.patterns-origins-y4'],
  ),
  node(
    'english.spelling.plurals-suffixes-y5',
    'Less common plurals and suffix effects',
    'literacy',
    'AC9E5LY10',
    spell,
    ['english.spelling.patterns-origins-y4'],
  ),
  node(
    'english.spelling.complex-phonics-y6',
    'Common and less common grapheme-phoneme relationships',
    'literacy',
    'AC9E6LY08',
    spell,
    ['english.spelling.pattern-pronunciation-y5'],
  ),
  node(
    'english.spelling.roots-technical-y6',
    'Word origins, Greek and Latin roots, affixes and technical spelling',
    'literacy',
    'AC9E6LY09',
    spell,
    ['english.spelling.word-building-y5', 'english.spelling.plurals-suffixes-y5'],
  ),

  // ----- Grammar and sentence structure -----
  node(
    'english.grammar.complex-sentences-y4',
    'Independent and dependent clauses in complex sentences',
    'language',
    'AC9E4LA06',
    language,
  ),
  node(
    'english.grammar.reported-direct-speech-y4',
    'Quoted and reported speech',
    'language',
    'AC9E4LA07',
    language,
  ),
  node(
    'english.grammar.adverb-prepositional-detail-y4',
    'Adverb groups and prepositional phrases for detail',
    'language',
    'AC9E4LA08',
    language,
  ),
  node(
    'english.grammar.tense-y4',
    'Past, present and future tense and meaning',
    'language',
    'AC9E4LA09',
    language,
  ),
  node(
    'english.grammar.complex-sentence-effect-y5',
    'Complex sentence structure and effect',
    'language',
    'AC9E5LA05',
    language,
    ['english.grammar.complex-sentences-y4'],
  ),
  node(
    'english.grammar.expanded-noun-groups-y5',
    'Expanded noun groups for fuller description',
    'language',
    'AC9E5LA06',
    language,
  ),
  node(
    'english.grammar.embedded-clauses-y6',
    'Embedded clauses to elaborate, extend and explain',
    'language',
    'AC9E6LA05',
    language,
    ['english.grammar.complex-sentence-effect-y5'],
  ),
  node(
    'english.grammar.verbs-tenses-adverbs-y6',
    'Verbs, elaborated tenses and adverb groups',
    'language',
    'AC9E6LA06',
    language,
    ['english.grammar.tense-y4', 'english.grammar.adverb-prepositional-detail-y4'],
  ),

  // ----- Punctuation -----
  node(
    'english.punctuation.dialogue-y4',
    'Dialogue punctuation conventions',
    'language',
    'AC9E4LA12',
    language,
    ['english.grammar.reported-direct-speech-y4'],
  ),
  node(
    'english.punctuation.commas-apostrophes-y5',
    'Commas with prepositional phrases and apostrophes for multiple possession',
    'language',
    'AC9E5LA09',
    language,
    ['english.grammar.adverb-prepositional-detail-y4', 'english.punctuation.dialogue-y4'],
  ),
  node(
    'english.punctuation.commas-y6',
    'Commas in lists, clauses and dialogue',
    'language',
    'AC9E6LA09',
    language,
    ['english.punctuation.commas-apostrophes-y5'],
  ),

  // ----- Vocabulary -----
  node(
    'english.vocabulary.synonyms-antonyms-y4',
    'Synonyms, antonyms and vocabulary expansion',
    'language',
    'AC9E4LA11',
    language,
  ),
  node(
    'english.vocabulary.precision-technical-y5',
    'Precise, specialist and technical vocabulary',
    'language',
    'AC9E5LA08',
    language,
    ['english.vocabulary.synonyms-antonyms-y4'],
  ),
  node(
    'english.vocabulary.vivid-figurative-y6',
    'Vivid and emotive vocabulary and figurative language',
    'language',
    'AC9E6LA08',
    language,
    ['english.vocabulary.precision-technical-y5'],
  ),
] as const;

export const AUSTRALIA_YEARS4_6_ENGLISH_CORE_CODES = AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES.map(
  (item) => item.curriculumRefs[0].slice(AU.length),
);

const byId = new Map(AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES.map((item) => [item.id, item]));

export function australianEnglishCoreNode(id: string): CanonicalLearningNode | null {
  return byId.get(id) ?? null;
}
