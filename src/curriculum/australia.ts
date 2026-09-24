import type { CurriculumFramework } from './types';

/**
 * First SchoolZone curriculum pack.
 *
 * Content-description mappings are added only after editorial verification.
 * Keeping framework metadata separate prevents the learner model from being
 * tied to one country's year structure.
 */
export const AUSTRALIAN_CURRICULUM_V9: CurriculumFramework = {
  id: 'au-ac-v9',
  name: 'Australian Curriculum',
  jurisdiction: 'AU',
  version: '9.0',
  source: 'https://www.australiancurriculum.edu.au/',
};

export const AUSTRALIA_INITIAL_SCOPE = {
  yearLevels: ['4', '5', '6'],
  subjects: ['mathematics', 'english', 'science'],
} as const;

export type AustraliaInitialYearLevel = (typeof AUSTRALIA_INITIAL_SCOPE.yearLevels)[number];
export type AustraliaInitialSubject = (typeof AUSTRALIA_INITIAL_SCOPE.subjects)[number];
