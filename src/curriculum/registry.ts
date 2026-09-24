import { AUSTRALIAN_CURRICULUM_V9 } from './australia';
import type { CurriculumFramework } from './types';

const FRAMEWORKS: readonly CurriculumFramework[] = [
  AUSTRALIAN_CURRICULUM_V9,
];

export function curriculumFrameworks(): readonly CurriculumFramework[] {
  return FRAMEWORKS;
}

export function curriculumFramework(id: string): CurriculumFramework | null {
  return FRAMEWORKS.find((framework) => framework.id === id) ?? null;
}
