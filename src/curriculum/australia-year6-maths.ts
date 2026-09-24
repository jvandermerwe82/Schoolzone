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

/** Australian Curriculum v9 — Year 6 Mathematics canonical SchoolZone nodes. */
export const AUSTRALIA_YEAR6_MATHS_NODES: readonly CanonicalLearningNode[] = [
  // Number
  node(
    'math.integers.number-line-cartesian',
    'Integers on number lines and the Cartesian plane',
    'number',
    'AC9M6N01',
    quiz,
    ['math.space.grid-coordinates'],
  ),
  node(
    'math.number.prime-composite-square',
    'Prime, composite and square number properties',
    'number',
    'AC9M6N02',
    quiz,
    ['math.number.factors-multiples-divisibility'],
  ),
  node(
    'math.fractions.common-compare-order',
    'Compare and order common fractions',
    'number',
    'AC9M6N03',
    explain,
    ['math.fractions.compare-order-related'],
  ),
  node(
    'math.decimals.add-subtract',
    'Add and subtract decimals',
    'number',
    'AC9M6N04',
    quiz,
    ['math.decimals.place-value-order'],
  ),
  node(
    'math.fractions.add-subtract-equivalent',
    'Add and subtract fractions using equivalence',
    'number',
    'AC9M6N05',
    quiz,
    ['math.fractions.add-subtract-related'],
  ),
  node(
    'math.decimals.mul-div-powers-10',
    'Multiply and divide decimals by powers of 10',
    'number',
    'AC9M6N06',
    quiz,
    ['math.decimals.place-value-order', 'math.multiplication.large-numbers'],
  ),
  node(
    'math.quantities.fraction-decimal-percent',
    'Find fractions, decimals and percentages of quantities',
    'number',
    'AC9M6N07',
    applied,
    ['math.percentages.fraction-decimal-equivalence'],
  ),
  node(
    'math.estimation.rational-percent',
    'Estimate solutions with rational numbers and percentages',
    'number',
    'AC9M6N08',
    explain,
    ['math.estimation.reasonableness', 'math.percentages.fraction-decimal-equivalence'],
  ),
  node(
    'math.modelling.rational-percent-y6',
    'Model practical rational-number and percentage problems',
    'number',
    'AC9M6N09',
    applied,
    ['math.modelling.additive-multiplicative', 'math.percentages.fraction-decimal-equivalence'],
  ),

  // Algebra
  node(
    'math.patterns.growing-rational',
    'Rules for growing and rational-number patterns',
    'algebra',
    'AC9M6A01',
    explain,
  ),
  node(
    'math.equations.combined-operations',
    'Unknowns with brackets and combined operations',
    'algebra',
    'AC9M6A02',
    quiz,
    ['math.equations.mul-div-unknowns'],
  ),
  node(
    'math.algorithms.rules-number-sets',
    'Algorithms using rules to generate number sets',
    'algebra',
    'AC9M6A03',
    investigate,
    ['math.algorithms.factors-multiples'],
  ),

  // Measurement
  node(
    'math.measure.metric-conversion-decimals',
    'Convert metric units using decimal representations',
    'measurement',
    'AC9M6M01',
    applied,
    ['math.measure.metric-unit-choice', 'math.decimals.place-value-order'],
  ),
  node(
    'math.measure.rectangle-area-formula',
    'Rectangle area formula in practical problems',
    'measurement',
    'AC9M6M02',
    applied,
    ['math.measure.perimeter-area'],
  ),
  node(
    'math.time.timetables-itineraries',
    'Timetables, itineraries and duration',
    'measurement',
    'AC9M6M03',
    applied,
    ['math.time.12-24-conversion'],
  ),
  node(
    'math.angles.relationships',
    'Angle relationships and unknown angles',
    'measurement',
    'AC9M6M04',
    explain,
    ['math.angles.measure-degrees'],
  ),

  // Space
  node('math.space.prism-cross-sections', 'Parallel cross-sections and right prisms', 'space', 'AC9M6SP01', applied),
  node(
    'math.space.cartesian-four-quadrants',
    'Coordinates in all four Cartesian quadrants',
    'space',
    'AC9M6SP02',
    applied,
    ['math.space.grid-coordinates'],
  ),
  node(
    'math.space.tessellations-transformations',
    'Transformations and tessellating patterns',
    'space',
    'AC9M6SP03',
    applied,
    ['math.space.transformations-symmetry'],
  ),

  // Statistics
  node(
    'math.statistics.compare-distributions',
    'Compare distributions, mode, range and shape',
    'statistics',
    'AC9M6ST01',
    investigate,
    ['math.statistics.data-mode-shape'],
  ),
  node(
    'math.statistics.critique-media',
    'Critique statistically informed media arguments',
    'statistics',
    'AC9M6ST02',
    explain,
    ['math.statistics.compare-distributions'],
  ),
  node(
    'math.statistics.investigation-y6',
    'Plan, conduct and communicate a statistical investigation',
    'statistics',
    'AC9M6ST03',
    investigate,
    ['math.statistics.investigation'],
  ),

  // Probability
  node(
    'math.probability.numeric-scales',
    'Assign probability using fractions, decimals and percentages',
    'probability',
    'AC9M6P01',
    explain,
    ['math.probability.outcomes-likelihood', 'math.percentages.fraction-decimal-equivalence'],
  ),
  node(
    'math.probability.simulation-frequency',
    'Chance simulations and expected versus observed frequency',
    'probability',
    'AC9M6P02',
    investigate,
    ['math.probability.repeated-experiments', 'math.probability.numeric-scales'],
  ),
] as const;

export const AUSTRALIA_YEAR6_MATHS_CODES = AUSTRALIA_YEAR6_MATHS_NODES.map(
  (item) => item.curriculumRefs[0].slice(AU.length),
);
