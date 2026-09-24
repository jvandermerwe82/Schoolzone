import { describe, expect, it } from 'vitest';
import { validateLearningGraph } from './graph';
import type { CanonicalLearningNode } from './types';

const make = (id: string, prerequisites: string[] = []): CanonicalLearningNode => ({
  id,
  subject: 'test',
  name: id,
  strand: 'test',
  prerequisites,
  evidenceModes: ['typed-response'],
  curriculumRefs: [],
});

describe('learning graph validation', () => {
  it('finds duplicate ids and missing prerequisites', () => {
    const result = validateLearningGraph([
      make('a', ['missing']),
      make('a'),
    ]);
    expect(result.duplicateIds).toEqual(['a']);
    expect(result.missingPrerequisites).toEqual([{ nodeId: 'a', prerequisiteId: 'missing' }]);
  });

  it('finds prerequisite cycles', () => {
    const result = validateLearningGraph([
      make('a', ['b']),
      make('b', ['c']),
      make('c', ['a']),
    ]);
    expect(result.cycles).toHaveLength(1);
    expect(new Set(result.cycles[0])).toEqual(new Set(['a', 'b', 'c']));
  });

  it('accepts an acyclic progression', () => {
    const result = validateLearningGraph([
      make('a'),
      make('b', ['a']),
      make('c', ['b']),
    ]);
    expect(result).toEqual({ duplicateIds: [], missingPrerequisites: [], cycles: [] });
  });
});
