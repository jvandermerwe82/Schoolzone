import type { CanonicalLearningNode, EvidenceMode } from './types';

const AU = 'au-ac-v9:';
const q = (code: string) => `${AU}${code}`;
const quiz: EvidenceMode[] = ['selected-response', 'typed-response'];
const explain: EvidenceMode[] = ['typed-response', 'constructed-response'];
const applied: EvidenceMode[] = ['constructed-response', 'practical', 'teacher-observation'];
const investigate: EvidenceMode[] = ['constructed-response', 'investigation', 'teacher-observation'];

const node = (
  id: string,
  name: string,
  strand: string,
  code: string,
  evidenceModes: EvidenceMode[],
  prerequisites: string[] = [],
): CanonicalLearningNode => ({
  id,
  subject: 'mathematics',
  name,
  strand,
  prerequisites,
  evidenceModes,
  curriculumRefs: [q(code)],
});

/**
 * Australian Curriculum v9 — Year 5 Mathematics canonical decomposition.
 *
 * These are SchoolZone concept nodes, not copies of the curriculum wording.
 * Each is linked to one verified AC v9 content code. Prerequisites deliberately
 * cross back into the Year 4 canonical graph where earlier learning is needed.
 */
export const AUSTRALIA_YEAR5_MATHS_NODES: readonly CanonicalLearningNode[] = [
  // Number
  node('math.decimals.place-value-order', 'Decimal place value and ordering', 'number', 'AC9M5N01', quiz, ['math.decimals.tenths-hundredths']),
  node('math.number.factors-multiples-divisibility', 'Factors, multiples and divisibility', 'number', 'AC9M5N02', quiz, ['math.facts.mul-div-10x10']),
  node(
    'math.fractions.compare-order-related',
    'Compare and order related fractions',
    'number',
    'AC9M5N03',
    quiz,
    ['math.number.factors-multiples-divisibility', 'math.fractions.equivalence-decimal-connections', 'math.fractions.number-line-mixed'],
  ),
  node(
    'math.percentages.fraction-decimal-equivalence',
    'Percent, fraction and decimal equivalence',
    'number',
    'AC9M5N04',
    quiz,
    ['math.decimals.place-value-order', 'math.fractions.equivalence-decimal-connections'],
  ),
  node(
    'math.fractions.add-subtract-related',
    'Add and subtract related fractions',
    'number',
    'AC9M5N05',
    quiz,
    ['math.fractions.compare-order-related', 'math.fractions.equivalence-decimal-connections'],
  ),
  node('math.multiplication.large-numbers', 'Multiply larger numbers', 'number', 'AC9M5N06', quiz, ['math.operations.efficient-four-no-remainder', 'math.facts.mul-div-10x10']),
  node(
    'math.division.remainders',
    'Division and interpreting remainders',
    'number',
    'AC9M5N07',
    quiz,
    ['math.multiplication.large-numbers', 'math.operations.efficient-four-no-remainder'],
  ),
  node(
    'math.estimation.reasonableness',
    'Estimate and check reasonableness',
    'number',
    'AC9M5N08',
    explain,
    ['math.estimation.rounding-check'],
  ),
  node(
    'math.modelling.additive-multiplicative',
    'Model practical additive and multiplicative problems',
    'number',
    'AC9M5N09',
    applied,
    ['math.modelling.additive-multiplicative-y4', 'math.multiplication.large-numbers', 'math.division.remainders'],
  ),
  node(
    'math.algorithms.factors-multiples',
    'Algorithms for factors and multiples',
    'number',
    'AC9M5N010',
    investigate,
    ['math.algorithms.addition-multiplication-patterns', 'math.number.factors-multiples-divisibility'],
  ),

  // Algebra
  node(
    'math.inverse.multiplication-division',
    'Multiplication and division as inverse operations',
    'algebra',
    'AC9M5A01',
    explain,
    ['math.facts.mul-div-10x10'],
  ),
  node(
    'math.equations.mul-div-unknowns',
    'Unknowns in multiplication and division equations',
    'algebra',
    'AC9M5A02',
    quiz,
    ['math.inverse.multiplication-division', 'math.equations.add-sub-unknowns'],
  ),

  // Measurement
  node('math.measure.metric-unit-choice', 'Choose precise metric units', 'measurement', 'AC9M5M01', applied, ['math.measure.scaled-instruments']),
  node(
    'math.measure.perimeter-area',
    'Perimeter and area in practical contexts',
    'measurement',
    'AC9M5M02',
    applied,
    ['math.measure.perimeter-area-approx', 'math.multiplication.large-numbers'],
  ),
  node('math.time.12-24-conversion', '12-hour and 24-hour time', 'measurement', 'AC9M5M03', quiz, ['math.time.duration-conversions']),
  node('math.angles.measure-degrees', 'Estimate, construct and measure angles', 'measurement', 'AC9M5M04', applied, ['math.angles.relative-right-angle']),

  // Space
  node('math.space.nets', 'Connect 3D objects and nets', 'space', 'AC9M5SP01', applied, ['math.space.composite-shapes']),
  node('math.space.grid-coordinates', 'Grid coordinates and movement', 'space', 'AC9M5SP02', applied, ['math.space.grid-references']),
  node('math.space.transformations-symmetry', 'Transformations and symmetry', 'space', 'AC9M5SP03', applied, ['math.space.symmetry-line-rotational']),

  // Statistics
  node('math.statistics.data-mode-shape', 'Represent data, mode and distribution shape', 'statistics', 'AC9M5ST01', investigate, ['math.statistics.many-to-one-displays', 'math.statistics.compare-displays']),
  node(
    'math.statistics.line-graphs',
    'Interpret change over time in line graphs',
    'statistics',
    'AC9M5ST02',
    explain,
    ['math.statistics.data-mode-shape'],
  ),
  node(
    'math.statistics.investigation',
    'Plan and conduct a statistical investigation',
    'statistics',
    'AC9M5ST03',
    investigate,
    ['math.statistics.data-mode-shape', 'math.statistics.investigation-y4'],
  ),

  // Probability
  node('math.probability.outcomes-likelihood', 'Possible outcomes and likelihood', 'probability', 'AC9M5P01', explain, ['math.probability.likelihood-dependence']),
  node(
    'math.probability.repeated-experiments',
    'Repeated chance experiments and frequency',
    'probability',
    'AC9M5P02',
    investigate,
    ['math.probability.outcomes-likelihood', 'math.probability.repeated-variation'],
  ),
] as const;

export const AUSTRALIA_YEAR5_MATHS_CODES = AUSTRALIA_YEAR5_MATHS_NODES.map(
  (item) => item.curriculumRefs[0].slice(AU.length),
);
