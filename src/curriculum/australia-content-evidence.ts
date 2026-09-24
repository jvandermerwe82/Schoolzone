import type { Question } from '../brain/types';
import { AUSTRALIA_YEARS4_6_MATHS_NODES } from './australia-maths';
import { AUSTRALIA_YEARS4_6_SCIENCE_NODES } from './australia-science';
import { AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES } from './australia-english-core';

export type EvidenceStrength = 'direct' | 'supporting';

export interface CanonicalEvidenceTarget {
  canonicalNodeId: string;
  strength: EvidenceStrength;
  /** Why this exact legacy question can contribute evidence to the node. */
  rationale: string;
}

const known = new Set([
  ...AUSTRALIA_YEARS4_6_MATHS_NODES,
  ...AUSTRALIA_YEARS4_6_SCIENCE_NODES,
  ...AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES,
].map((node) => node.id));

const target = (
  canonicalNodeId: string,
  strength: EvidenceStrength,
  rationale: string,
): CanonicalEvidenceTarget => {
  if (!known.has(canonicalNodeId)) throw new Error(`Unknown canonical evidence target: ${canonicalNodeId}`);
  return { canonicalNodeId, strength, rationale };
};

const has = (text: string, ...needles: string[]) => needles.some((needle) => text.toLowerCase().includes(needle.toLowerCase()));

/**
 * Translate one existing England-focused SchoolZone question into conservative
 * Australian canonical evidence.
 *
 * DIRECT means the question directly tests part of that canonical node.
 * SUPPORTING means it is relevant evidence, but must never by itself establish
 * mastery of the whole curriculum node.
 *
 * Returning [] is intentional: unmapped content remains useful legacy practice
 * but makes no Australian curriculum mastery claim.
 */
export function australianEvidenceForQuestion(
  question: Question,
  yearLevel?: '4' | '5' | '6',
): CanonicalEvidenceTarget[] {
  const p = question.prompt;
  const content = `${question.prompt} ${question.answer}`;

  switch (question.skillId) {
    // ---- existing maths foundations ----
    case 'multiplication':
      return question.level <= 4
        ? [target('math.facts.mul-div-10x10', 'direct', 'Times-table multiplication directly supports Year 4 multiplication facts.')]
        : [target('math.operations.efficient-four-no-remainder', 'supporting', 'Larger multiplication supports efficient operation fluency.')];
    case 'division':
      return question.level <= 4
        ? [target('math.facts.mul-div-10x10', 'direct', 'Related division facts directly support Year 4 multiplication/division facts.')]
        : [target('math.operations.efficient-four-no-remainder', 'supporting', 'Larger exact division supports efficient operation fluency.')];
    case 'place-value':
      return has(p, 'round ')
        ? [target('math.estimation.rounding-check', 'supporting', 'Rounding contributes to estimation and calculation checking.')]
        : [];
    case 'fractions':
      if (question.level === 4) {
        return [target('math.fractions.compare-order-related', 'supporting', 'Comparing simple fractions supports later related-fraction ordering.')];
      }
      if (question.level === 5) {
        return [target('math.fractions.add-subtract-related', 'supporting', 'Adding fractions with the same denominator is prerequisite evidence for related-denominator addition.')];
      }
      return [];

    // ---- existing England Year 6 maths ----
    case 'negative-numbers':
      return [target('math.integers.number-line-cartesian', 'supporting', 'Integer calculations support the integer component; the question does not test Cartesian-plane work.')];

    case 'factors-primes':
      if (has(p, 'prime')) {
        return [target('math.number.prime-composite-square', 'supporting', 'Prime-number reasoning supports the Year 6 prime/composite/square-number node.')];
      }
      return [target('math.number.factors-multiples-divisibility', 'direct', 'Factor/HCF/LCM reasoning directly contributes to factors and multiples proficiency.')];

    case 'order-of-operations':
      return [target('math.equations.combined-operations', 'supporting', 'Evaluating expressions with brackets and operation order supports combined-operation equations, but does not test unknown values.')];

    case 'long-multiplication-division':
      if (p.includes('×')) {
        return [target('math.multiplication.large-numbers', 'direct', 'The generated question directly tests multiplication of larger whole numbers.')];
      }
      return [target('math.division.remainders', 'supporting', 'Exact division supports the division strategy node, but does not test interpreting remainders.')];

    case 'fractions-y6':
      if (question.level === 2 || question.level === 3 || (question.level === 5 && p.includes('+'))) {
        return [target('math.fractions.add-subtract-equivalent', 'direct', 'The question requires addition/subtraction using equivalent fractions or common denominators.')];
      }
      if (question.level === 1) {
        return [target('math.fractions.common-compare-order', 'supporting', 'Simplifying fractions demonstrates equivalence knowledge that supports common-fraction reasoning.')];
      }
      return []; // fraction multiplication/division is not rebadged into a different Australian node

    case 'decimals-percentages':
      if (question.level === 1) {
        return [target('math.percentages.fraction-decimal-equivalence', 'direct', 'The question directly converts between fraction, decimal and percentage forms.')];
      }
      if (question.level === 2) {
        return [target('math.decimals.mul-div-powers-10', 'direct', 'The question directly multiplies/divides decimals by powers of 10.')];
      }
      if (question.level === 3 || question.level === 4) {
        return [target('math.quantities.fraction-decimal-percent', 'direct', 'The question directly finds a percentage of a quantity.')];
      }
      if (has(p, 'write ') && has(p, ' as a decimal')) {
        return [target('math.percentages.fraction-decimal-equivalence', 'supporting', 'Fraction-to-decimal conversion supports equivalence fluency.')];
      }
      return [];

    case 'algebra':
      if (question.level === 1) {
        return [target('math.equations.add-sub-unknowns', 'direct', 'The question directly solves an addition/subtraction equation with an unknown.')];
      }
      if (question.level === 2) {
        return [target('math.equations.mul-div-unknowns', 'direct', 'The question directly solves a multiplication equation with an unknown.')];
      }
      if (question.level === 3 || (question.level === 5 && has(p, 'n −', 'n +'))) {
        return [target('math.equations.combined-operations', 'direct', 'The question solves an unknown using more than one operation.')];
      }
      if (has(p, 'sequence')) {
        return [target('math.patterns.growing-rational', 'supporting', 'The generated sequence question supports identifying and using a growing-pattern rule.')];
      }
      return [];

    case 'geometry-statistics':
      if (question.level <= 2 || has(p, 'quadrilateral', 'interior angle')) {
        return [target('math.angles.relationships', 'direct', 'The question uses angle relationships to determine an unknown angle.')];
      }
      return []; // triangle/parallelogram area, circles and mean are not rebadged as AC v9 nodes they do not test

    // ---- science ----
    case 'living-things':
      if (has(content, 'food chain', 'producer', 'herbivore')) {
        return [target('science.ecology.roles-food-chains', 'supporting', 'The question contributes evidence about organism roles or food-chain relationships.')];
      }
      return [];

    case 'materials':
      if (has(content, 'solid', 'liquid', 'gas', 'particles', 'melts', 'melting', 'boil', 'condensation', 'evaporation', 'steam')) {
        return [target('science.matter.particle-states', 'supporting', 'States-of-matter knowledge supports the Year 5 particle-model node.')];
      }
      if (has(content, 'material', 'raincoat', 'glass', 'natural material')) {
        return [target('science.materials.properties-use', 'supporting', 'The question links material properties or origin to use.')];
      }
      if (has(content, 'conducts electricity', 'conductor')) {
        return [target('science.electricity.energy-circuits', 'supporting', 'Conductor knowledge supports the Year 6 electrical-circuit node.')];
      }
      return [];

    case 'forces-energy':
      if (has(content, 'gravity', 'friction', 'magnet', 'newton')) {
        return [target('science.forces.friction-gravity-magnetism', 'direct', 'The question directly tests frictional, gravitational or magnetic forces.')];
      }
      if (has(content, 'shadow', 'light')) {
        return [target('science.light.travel-shadows-reflection-refraction', 'supporting', 'The question supports light-source or shadow reasoning, but may not cover reflection/refraction.')];
      }
      if (has(content, 'circuit', 'switch')) {
        return [target('science.electricity.energy-circuits', 'supporting', 'The question directly supports simple circuit behaviour.')];
      }
      return [];

    case 'earth-space':
      if (has(content, 'water cycle', 'cloud', 'precipitation')) {
        return [target('science.earth.water-cycle', 'supporting', 'The question contributes evidence about water-cycle processes.')];
      }
      if (has(content, 'sun', 'planet', 'earth', 'day and night', 'seasons', 'moon')) {
        return [target('science.space.earth-sun-cycles', 'supporting', 'The question contributes to Earth/Sun/planet and observable-cycle understanding.')];
      }
      return [];

    case 'light-y6':
      return [target('science.light.travel-shadows-reflection-refraction', 'direct', 'The existing light bank directly contributes to the Australian Year 5 light node.')];

    case 'electricity-y6':
      return [target('science.electricity.energy-circuits', 'direct', 'The existing electricity bank directly contributes to the Australian Year 6 electrical-energy node.')];

    // classification, circulatory-system and evolution-inheritance intentionally make no Australian Years 4-6 claim

    // ---- English ----
    case 'reading-y6': {
      const nodeId =
        yearLevel === '4' ? 'english.reading.comprehension-y4'
          : yearLevel === '6' ? 'english.reading.comprehension-y6'
            : 'english.reading.comprehension-y5';
      return [target(nodeId, 'direct', 'The original reading question directly contributes comprehension evidence at the learner\'s Australian year context.')];
    }

    case 'homophones':
      return yearLevel === '4'
        ? [target('english.spelling.homophones-context-y4', 'direct', 'The question directly tests homophone choice in context.')]
        : [];

    case 'spelling-patterns':
      if (yearLevel === '4') {
        return [target('english.spelling.patterns-origins-y4', 'supporting', 'The existing spelling-pattern bank supports Year 4 pattern/affix knowledge after Australian review.')];
      }
      if (yearLevel === '6') {
        return [target('english.spelling.roots-technical-y6', 'supporting', 'The existing pattern bank supports Year 6 complex spelling, but Greek/Latin roots and technical words need separate evidence.')];
      }
      return [target('english.spelling.word-building-y5', 'supporting', 'The existing pattern bank supports bases, affixes and spelling generalisations.')];

    case 'grammar-y6':
      if (has(p, 'synonym', 'antonym')) {
        return [target('english.vocabulary.synonyms-antonyms-y4', 'supporting', 'Synonym/antonym questions contribute vocabulary evidence.')];
      }
      return [];

    case 'punctuation-y6':
      if (has(p, 'comma')) {
        if (yearLevel === '5') {
          return [target('english.punctuation.commas-apostrophes-y5', 'supporting', 'Comma use contributes to the Year 5 punctuation node.')];
        }
        if (yearLevel === '6') {
          return [target('english.punctuation.commas-y6', 'direct', 'The question directly contributes evidence about Year 6 comma conventions.')];
        }
      }
      return [];

    // spelling-words intentionally returns no Australian evidence
    default:
      return [];
  }
}

export function isKnownAustralianEvidenceTarget(id: string): boolean {
  return known.has(id);
}
