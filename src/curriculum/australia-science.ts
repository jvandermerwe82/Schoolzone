import type { CanonicalLearningNode, EvidenceMode } from './types';

const AU = 'au-ac-v9:';
const q = (code: string) => `${AU}${code}`;

const knowledge: EvidenceMode[] = ['selected-response', 'typed-response', 'constructed-response'];
const applied: EvidenceMode[] = ['constructed-response', 'practical', 'teacher-observation'];
const inquiry: EvidenceMode[] = ['constructed-response', 'practical', 'investigation', 'teacher-observation'];
const communicate: EvidenceMode[] = ['constructed-response', 'teacher-observation'];

const node = (
  id: string,
  name: string,
  strand: string,
  codes: string[],
  evidenceModes: EvidenceMode[],
  prerequisites: string[] = [],
): CanonicalLearningNode => ({
  id,
  subject: 'science',
  name,
  strand,
  prerequisites,
  evidenceModes,
  curriculumRefs: codes.map(q),
});

/**
 * Australian Curriculum v9 — Years 4-6 Science canonical SchoolZone graph.
 *
 * Science Understanding is year-specific. Science as a Human Endeavour and
 * Science Inquiry are intentionally shared across Years 5-6 where AC v9 uses
 * the same banded content descriptions under separate Year 5 and Year 6 codes.
 */
export const AUSTRALIA_YEARS4_6_SCIENCE_NODES: readonly CanonicalLearningNode[] = [
  // ----- Year 4: Science Understanding -----
  node(
    'science.ecology.roles-food-chains',
    'Organism roles, habitats and food chains',
    'science-understanding',
    ['AC9S4U01'],
    knowledge,
  ),
  node(
    'science.earth.water-cycle',
    'Water sources and the water cycle',
    'science-understanding',
    ['AC9S4U02'],
    knowledge,
  ),
  node(
    'science.forces.friction-gravity-magnetism',
    'Frictional, gravitational and magnetic forces',
    'science-understanding',
    ['AC9S4U03'],
    applied,
  ),
  node(
    'science.materials.properties-use',
    'Material properties and their uses',
    'science-understanding',
    ['AC9S4U04'],
    applied,
  ),

  // ----- Year 4: Science as a Human Endeavour -----
  node(
    'science.human-endeavour.data-explanations',
    'How data supports scientific explanations',
    'science-as-a-human-endeavour',
    ['AC9S4H01'],
    communicate,
  ),
  node(
    'science.human-endeavour.explanations-solutions',
    'Using scientific explanations to meet needs and solve problems',
    'science-as-a-human-endeavour',
    ['AC9S4H02'],
    communicate,
    ['science.human-endeavour.data-explanations'],
  ),

  // ----- Year 4: Science Inquiry -----
  node(
    'science.inquiry.questions-patterns-y4',
    'Ask questions about patterns and make predictions',
    'science-inquiry',
    ['AC9S4I01'],
    inquiry,
  ),
  node(
    'science.inquiry.fair-tests-y4',
    'Plan fair and safe investigations with scaffolds',
    'science-inquiry',
    ['AC9S4I02'],
    inquiry,
    ['science.inquiry.questions-patterns-y4'],
  ),
  node(
    'science.inquiry.measurement-y4',
    'Observe and measure accurately with familiar instruments',
    'science-inquiry',
    ['AC9S4I03'],
    inquiry,
    ['science.inquiry.fair-tests-y4'],
  ),
  node(
    'science.inquiry.represent-data-y4',
    'Represent data and identify simple patterns',
    'science-inquiry',
    ['AC9S4I04'],
    inquiry,
    ['science.inquiry.measurement-y4'],
  ),
  node(
    'science.inquiry.evaluate-y4',
    'Compare findings, assess fairness and draw conclusions',
    'science-inquiry',
    ['AC9S4I05'],
    inquiry,
    ['science.inquiry.represent-data-y4'],
  ),
  node(
    'science.inquiry.communicate-y4',
    'Communicate scientific findings for an audience and purpose',
    'science-inquiry',
    ['AC9S4I06'],
    communicate,
    ['science.inquiry.evaluate-y4'],
  ),

  // ----- Year 5: Science Understanding -----
  node(
    'science.biology.adaptations-survival',
    'Structural and behavioural adaptations for survival',
    'science-understanding',
    ['AC9S5U01'],
    knowledge,
    ['science.ecology.roles-food-chains'],
  ),
  node(
    'science.earth.surface-change',
    'Weathering, erosion, transportation and deposition',
    'science-understanding',
    ['AC9S5U02'],
    applied,
    ['science.earth.water-cycle'],
  ),
  node(
    'science.light.travel-shadows-reflection-refraction',
    'Light travel, shadows, reflection and refraction',
    'science-understanding',
    ['AC9S5U03'],
    applied,
  ),
  node(
    'science.matter.particle-states',
    'Particle model of solids, liquids and gases',
    'science-understanding',
    ['AC9S5U04'],
    knowledge,
    ['science.materials.properties-use'],
  ),

  // ----- Years 5-6: shared Science as a Human Endeavour -----
  node(
    'science.human-endeavour.collaboration',
    'Scientific collaboration and building on prior work',
    'science-as-a-human-endeavour',
    ['AC9S5H01', 'AC9S6H01'],
    communicate,
    ['science.human-endeavour.data-explanations'],
  ),
  node(
    'science.human-endeavour.decisions',
    'Using science to identify problems, consider responses and make decisions',
    'science-as-a-human-endeavour',
    ['AC9S5H02', 'AC9S6H02'],
    communicate,
    ['science.human-endeavour.explanations-solutions'],
  ),

  // ----- Years 5-6: shared Science Inquiry -----
  node(
    'science.inquiry.investigable-questions',
    'Pose investigable questions and reasoned predictions',
    'science-inquiry',
    ['AC9S5I01', 'AC9S6I01'],
    inquiry,
    ['science.inquiry.questions-patterns-y4'],
  ),
  node(
    'science.inquiry.repeatable-investigations',
    'Plan repeatable, safe investigations with variables and permissions',
    'science-inquiry',
    ['AC9S5I02', 'AC9S6I02'],
    inquiry,
    ['science.inquiry.fair-tests-y4', 'science.inquiry.investigable-questions'],
  ),
  node(
    'science.inquiry.precision',
    'Observe and measure with reasonable precision',
    'science-inquiry',
    ['AC9S5I03', 'AC9S6I03'],
    inquiry,
    ['science.inquiry.measurement-y4'],
  ),
  node(
    'science.inquiry.represent-analyse',
    'Represent and analyse patterns, trends and relationships',
    'science-inquiry',
    ['AC9S5I04', 'AC9S6I04'],
    inquiry,
    ['science.inquiry.represent-data-y4', 'science.inquiry.precision'],
  ),
  node(
    'science.inquiry.evaluate-evidence',
    'Evaluate methods, error and evidence to draw conclusions',
    'science-inquiry',
    ['AC9S5I05', 'AC9S6I05'],
    inquiry,
    ['science.inquiry.evaluate-y4', 'science.inquiry.represent-analyse'],
  ),
  node(
    'science.inquiry.communicate-specific',
    'Communicate findings for specific purposes and audiences',
    'science-inquiry',
    ['AC9S5I06', 'AC9S6I06'],
    communicate,
    ['science.inquiry.communicate-y4', 'science.inquiry.evaluate-evidence'],
  ),

  // ----- Year 6: Science Understanding -----
  node(
    'science.biology.habitat-conditions',
    'How changing habitat conditions affect growth and survival',
    'science-understanding',
    ['AC9S6U01'],
    inquiry,
    ['science.biology.adaptations-survival', 'science.inquiry.repeatable-investigations'],
  ),
  node(
    'science.space.earth-sun-cycles',
    'Earth, planets, the sun and observable cycles',
    'science-understanding',
    ['AC9S6U02'],
    applied,
  ),
  node(
    'science.electricity.energy-circuits',
    'Electrical energy transfer, circuits, conductors and insulators',
    'science-understanding',
    ['AC9S6U03'],
    applied,
    ['science.inquiry.repeatable-investigations'],
  ),
  node(
    'science.chemistry.reversible-irreversible-change',
    'Reversible and irreversible changes to substances',
    'science-understanding',
    ['AC9S6U04'],
    applied,
    ['science.matter.particle-states'],
  ),
] as const;

export const AUSTRALIA_YEARS4_6_SCIENCE_CODES = AUSTRALIA_YEARS4_6_SCIENCE_NODES.flatMap(
  (item) => item.curriculumRefs.map((reference) => reference.slice(AU.length)),
);

const byId = new Map(AUSTRALIA_YEARS4_6_SCIENCE_NODES.map((item) => [item.id, item]));

export function australianScienceNode(id: string): CanonicalLearningNode | null {
  return byId.get(id) ?? null;
}
