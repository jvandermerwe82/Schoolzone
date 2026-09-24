import { describe, expect, it } from 'vitest';
import { AUSTRALIAN_YEARS4_6_SCIENCE_NODES } from './australia-science';
import { AUSTRALIAN_SCIENCE_EXISTING_REUSE, AUSTRALIAN_SCIENCE_LAUNCH_CRITICAL_GAPS } from './australia-science-reuse';

describe('Australian science reuse audit', () => {
  it('maps only to canonical nodes that exist', () => {
    const ids = new Set(AUSTRALIAN_YEARS4_6_SCIENCE_NODES.map((node) => node.id));
    for (const mapping of AUSTRALIAN_SCIENCE_EXISTING_REUSE) {
      expect(ids.has(mapping.canonicalNodeId)).toBe(true);
    }
  });

  it('keeps every launch-critical gap attached to a canonical node', () => {
    const ids = new Set(AUSTRALIAN_YEARS4_6_SCIENCE_NODES.map((node) => node.id));
    for (const gap of AUSTRALIAN_SCIENCE_LAUNCH_CRITICAL_GAPS) {
      expect(ids.has(gap)).toBe(true);
    }
  });

  it('does not claim strong reuse for the new Australian habitat-conditions and chemical-change outcomes', () => {
    expect(AUSTRALIAN_SCIENCE_EXISTING_REUSE.some((mapping) =>
      mapping.canonicalNodeId === 'science.biology.habitat-conditions' && mapping.coverage === 'strong')).toBe(false);
    expect(AUSTRALIAN_SCIENCE_EXISTING_REUSE.some((mapping) =>
      mapping.canonicalNodeId === 'science.chemistry.reversible-irreversible-change' && mapping.coverage === 'strong')).toBe(false);
  });
});
