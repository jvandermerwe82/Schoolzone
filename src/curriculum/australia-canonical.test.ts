import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { validateLearningGraph } from './graph';
import {
  AUSTRALIA_CANONICAL_NODES,
  australianCanonicalNode,
  australianCanonicalProgress,
} from './australia-canonical';

describe('Australian canonical registry', () => {
  it('has globally unique ids across Maths, Science and English', () => {
    const ids = AUSTRALIA_CANONICAL_NODES.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no missing prerequisite links or cycles across the combined graph', () => {
    expect(validateLearningGraph(AUSTRALIA_CANONICAL_NODES)).toEqual({
      duplicateIds: [],
      missingPrerequisites: [],
      cycles: [],
    });
  });

  it('finds canonical nodes and returns no invented node', () => {
    expect(australianCanonicalNode('math.fractions.add-subtract-equivalent')?.subject).toBe('mathematics');
    expect(australianCanonicalNode('missing')).toBeNull();
  });

  it('summarises learner history for a canonical objective', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.history.push({
      at: 1,
      skillId: 'fractions-y6',
      level: 3,
      correct: true,
      timeMs: 3000,
      predicted: 0.7,
      curriculumEvidence: [{
        curriculumId: 'au-ac-v9',
        canonicalNodeId: 'math.fractions.add-subtract-equivalent',
        strength: 'direct',
      }],
    });
    expect(australianCanonicalProgress(profile, 'math.fractions.add-subtract-equivalent')).toMatchObject({
      nodeId: 'math.fractions.add-subtract-equivalent',
      directEvidenceCount: 1,
      status: 'developing',
    });
  });
});
