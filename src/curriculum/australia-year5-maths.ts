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
 * Each is linked to one verified AC v9 content code. Prerequisites currently
 * include only relationships within this Year 5 set; cross-year prerequisites
 * are added when Year 4 is decomposed.
 */
export const AUSTRALIA_YEAR5_MATHS_NODES: readonly CanonicalLearningNode[] = [
  // Number
  node('math.decimals.place-value-order', 'Decimal place value and ordering', 'number', 'AC9M5N01', quiz),
  node('math.number.factors-multiples-divisibility', 'Factors, multiples and divisibility', 'number', 'AC9M5N02', quiz),
  node(
    'math.fractions.compare-order-related',
    'Compare and order related fractions',
    'number',
    'AC9M5N03',
    quiz,
    ['math.number.factors-multiples-divisibility'],
  ),
  node(
    'math.percentages.fraction-decimal-equivalence',
    'Percent, fraction and decimal equivalence',
    'number',
    'AC9M5N04',
    quiz,
    ['math.decimals.place-value-order'],
  ),
  node(
    'math.fractions.add-subtract-related',
    'Add and subtract related fractions',
    'number',
    'AC9M5N05',
    quiz,
    ['math.fractions.compare-order-related'],
  ),
  node('math.multiplication.large-numbers', 'Multiply larger numbers', 'number', 'AC9M5N06', quiz),
  node(
    'math.division.remainders',
    'Division and interpreting remainders',
    'number',
    'AC9M5N07',
    quiz,
    ['math.multiplication.large-numbers'],
  ),
  node(
    'math.estimation.reasonableness',
    'Estimate and check reasonableness',
    'number',
    'AC9M5N08',
    explain,
  ),
  node(
    'math.modelling.additive-multiplicative',
    'Model practical additive and multiplicative problems',
    'number',
    'AC9M5N09',
    applied,
    ['math.multiplication.large-numbers', 'math.division.remainders'],
  ),
  node(
    'math.algorithms.factors-multiples',
    'Algorithms for factors and multiples',
    'number',
    'AC9M5N010',
    investigate,
    ['math.number.factors-multiples-divisibility'],
  ),

  // Algebra
  node(
    'math.inverse.multiplication-division',
    'Multiplication and division as inverse operations',
    'algebra',
    'AC9M5A01',
    explain,
  ),
  node(
    'math.equations.mul-div-unknowns',
    'Unknowns in multiplication and division equations',
    'algebra',
    'AC9M5A02',
    quiz,
    ['math.inverse.multiplication-division'],
  ),

  // Measurement
  node('math.measure.metric-unit-choice', 'Choose precise metric units', 'measurement', 'AC9M5M01', applied),
  node(
    'math.measure.perimeter-area',
    'Perimeter and area in practical contexts',
    'measurement',
    'AC9M5M02',
    applied,
    ['math.multiplication.large-numbers'],
  ),
  node('math.time.12-24-conversion', '12-hour and 24-hour time', 'measurement', 'AC9M5M03', quiz),
  node('math.angles.measure-degrees', 'Estimate, construct and measure angles', 'measurement', 'AC9M5M04', applied),

  // Space
  node('math.space.nets', 'Connect 3D objects and nets', 'space', 'AC9M5SP01', applied),
  node('math.space.grid-coordinates', 'Grid coordinates and movement', 'space', 'AC9M5SP02', applied),
  node('math.space.transformations-symmetry', 'Transformations and symmetry', 'space', 'AC9M5SP03', applied),

  // Statistics
  node('math.statistics.data-mode-shape', 'Represent data, mode and distribution shape', 'statistics', 'AC9M5ST01', investigate),
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
    ['math.statistics.data-mode-shape'],
  ),

  // Probability
  node('math.probability.outcomes-likelihood', 'Possible outcomes and likelihood', 'probability', 'AC9M5P01', explain),
  node(
    'math.probability.repeated-experiments',
    'Repeated chance experiments and frequency',
    'probability',
    'AC9M5P02',
    investigate,
    ['math.probability.outcomes-likelihood'],
  ),
] as const;

export const AUSTRALIA_YEAR5_MATHS_CODES = AUSTRALIA_YEAR5_MATHS_NODES.map(
  (item) => item.curriculumRefs[0].slice(AU.length),
);
