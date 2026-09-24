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

/** Australian Curriculum v9 — Year 4 Mathematics canonical SchoolZone nodes. */
export const AUSTRALIA_YEAR4_MATHS_NODES: readonly CanonicalLearningNode[] = [
  // Number
  node('math.decimals.tenths-hundredths', 'Tenths, hundredths and decimal notation', 'number', 'AC9M4N01', quiz),
  node('math.number.odd-even-properties', 'Odd and even number properties', 'number', 'AC9M4N02', quiz),
  node('math.fractions.equivalence-decimal-connections', 'Equivalent fractions and decimal connections', 'number', 'AC9M4N03', quiz),
  node('math.fractions.number-line-mixed', 'Fractions and mixed numerals on number lines', 'number', 'AC9M4N04', quiz),
  node('math.place-value.mul-div-powers-10', 'Multiply and divide by multiples and powers of 10', 'number', 'AC9M4N05', quiz),
  node('math.operations.efficient-four-no-remainder', 'Efficient addition, subtraction, multiplication and division', 'number', 'AC9M4N06', quiz),
  node('math.estimation.rounding-check', 'Rounding and estimation to check calculations', 'number', 'AC9M4N07', explain),
  node(
    'math.modelling.additive-multiplicative-y4',
    'Model practical additive and multiplicative problems',
    'number',
    'AC9M4N08',
    applied,
    ['math.operations.efficient-four-no-remainder'],
  ),
  node(
    'math.algorithms.addition-multiplication-patterns',
    'Algorithms that generate number sets and patterns',
    'number',
    'AC9M4N09',
    investigate,
  ),

  // Algebra
  node('math.equations.add-sub-unknowns', 'Unknowns in addition and subtraction equations', 'algebra', 'AC9M4A01', quiz),
  node('math.facts.mul-div-10x10', 'Multiplication facts and related division facts', 'algebra', 'AC9M4A02', quiz),

  // Measurement
  node('math.measure.scaled-instruments', 'Measure using scaled instruments and units', 'measurement', 'AC9M4M01', applied),
  node('math.measure.perimeter-area-approx', 'Measure and approximate perimeter and area', 'measurement', 'AC9M4M02', applied),
  node('math.time.duration-conversions', 'Duration and time-unit conversions', 'measurement', 'AC9M4M03', applied),
  node('math.angles.relative-right-angle', 'Compare and name angles relative to a right angle', 'measurement', 'AC9M4M04', applied),

  // Space
  node('math.space.composite-shapes', 'Represent composite shapes and objects', 'space', 'AC9M4SP01', applied),
  node('math.space.grid-references', 'Grid references, positions and pathways', 'space', 'AC9M4SP02', applied),
  node('math.space.symmetry-line-rotational', 'Line and rotational symmetry', 'space', 'AC9M4SP03', applied),

  // Statistics
  node('math.statistics.many-to-one-displays', 'Collect and represent data in many-to-one displays', 'statistics', 'AC9M4ST01', investigate),
  node(
    'math.statistics.compare-displays',
    'Evaluate data displays and variation',
    'statistics',
    'AC9M4ST02',
    explain,
    ['math.statistics.many-to-one-displays'],
  ),
  node(
    'math.statistics.investigation-y4',
    'Conduct and communicate a statistical investigation',
    'statistics',
    'AC9M4ST03',
    investigate,
    ['math.statistics.many-to-one-displays'],
  ),

  // Probability
  node('math.probability.likelihood-dependence', 'Likelihood and independent or dependent events', 'probability', 'AC9M4P01', explain),
  node(
    'math.probability.repeated-variation',
    'Repeated chance experiments and variation',
    'probability',
    'AC9M4P02',
    investigate,
    ['math.probability.likelihood-dependence'],
  ),
] as const;

export const AUSTRALIA_YEAR4_MATHS_CODES = AUSTRALIA_YEAR4_MATHS_NODES.map(
  (item) => item.curriculumRefs[0].slice(AU.length),
);
