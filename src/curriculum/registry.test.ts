import { describe, expect, it } from 'vitest';
import { AUSTRALIAN_CURRICULUM_V9, AUSTRALIA_INITIAL_SCOPE } from './australia';
import { curriculumFramework } from './registry';

describe('Australian curriculum pack', () => {
  it('registers Australian Curriculum version 9 as the first external curriculum pack', () => {
    expect(curriculumFramework('au-ac-v9')).toEqual(AUSTRALIAN_CURRICULUM_V9);
    expect(AUSTRALIAN_CURRICULUM_V9.jurisdiction).toBe('AU');
    expect(AUSTRALIAN_CURRICULUM_V9.version).toBe('9.0');
  });

  it('starts with Years 4-6 across Maths, English and Science', () => {
    expect(AUSTRALIA_INITIAL_SCOPE.yearLevels).toEqual(['4', '5', '6']);
    expect(AUSTRALIA_INITIAL_SCOPE.subjects).toEqual(['mathematics', 'english', 'science']);
  });

  it('does not invent unknown curriculum frameworks', () => {
    expect(curriculumFramework('missing')).toBeNull();
  });
});
