import type { CurriculumSkillMapping } from './types';

/**
 * Reuse map from the current England-focused science bank into the new
 * Australian canonical science graph.
 *
 * Partial means useful questions/concepts exist, not that the current bank
 * demonstrates full Australian Curriculum mastery.
 */
export const AUSTRALIAN_SCIENCE_EXISTING_REUSE: readonly (CurriculumSkillMapping & {
  canonicalNodeId: string;
})[] = [
  {
    curriculumRefId: 'au-ac-v9:AC9S4U01',
    canonicalNodeId: 'science.ecology.roles-food-chains',
    skillId: 'living-things',
    coverage: 'partial',
    rationale: 'The current living-things bank provides biological foundations but needs explicit producers, consumers, decomposers and food-chain coverage.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9S4U04',
    canonicalNodeId: 'science.materials.properties-use',
    skillId: 'materials',
    coverage: 'partial',
    rationale: 'Current materials content is reusable but needs explicit natural/made materials and property-to-use reasoning.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9S5U03',
    canonicalNodeId: 'science.light.travel-shadows-reflection-refraction',
    skillId: 'light-y6',
    coverage: 'strong',
    rationale: 'Current light content substantially overlaps Year 5 light, with refraction requiring question-bank confirmation.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9S5U04',
    canonicalNodeId: 'science.matter.particle-states',
    skillId: 'materials',
    coverage: 'partial',
    rationale: 'States of matter are present; explicit particle-motion and arrangement models need expansion.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9S6U02',
    canonicalNodeId: 'science.space.earth-sun-cycles',
    skillId: 'earth-space',
    coverage: 'partial',
    rationale: 'Solar-system content is reusable but Earth tilt, rotation, revolution and variable day/night length need explicit treatment.',
    confidence: 'verified',
  },
  {
    curriculumRefId: 'au-ac-v9:AC9S6U03',
    canonicalNodeId: 'science.electricity.energy-circuits',
    skillId: 'electricity-y6',
    coverage: 'strong',
    rationale: 'Series circuits and components are strong reuse; conductors, insulators and energy-transfer language need explicit audit.',
    confidence: 'verified',
  },
];

export const AUSTRALIAN_SCIENCE_LAUNCH_CRITICAL_GAPS = [
  'science.ecology.roles-food-chains',
  'science.earth.water-cycle',
  'science.forces.friction-gravity-magnetism',
  'science.biology.adaptations-survival',
  'science.earth.surface-change',
  'science.biology.habitat-conditions',
  'science.chemistry.reversible-irreversible-change',
  'science.human-endeavour.collaboration',
  'science.human-endeavour.decisions',
  'science.inquiry.investigable-questions',
  'science.inquiry.repeatable-investigations',
  'science.inquiry.precision',
  'science.inquiry.represent-analyse',
  'science.inquiry.evaluate-evidence',
  'science.inquiry.communicate-specific',
] as const;
