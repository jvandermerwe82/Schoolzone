import { describe, expect, it } from 'vitest';
import { AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES } from './australia-english-core';
import { AUSTRALIAN_ENGLISH_EXISTING_REUSE, AUSTRALIAN_ENGLISH_REPLACE_NOT_REBADGE } from './australia-english-reuse';

describe('Australian English reuse audit', () => {
  it('maps only to canonical English core nodes that exist', () => {
    const ids = new Set(AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES.map((node) => node.id));
    for (const mapping of AUSTRALIAN_ENGLISH_EXISTING_REUSE) {
      expect(ids.has(mapping.canonicalNodeId)).toBe(true);
    }
  });

  it('does not map the England statutory spelling-list skill to Australian curriculum content', () => {
    expect(AUSTRALIAN_ENGLISH_EXISTING_REUSE.some((mapping) => mapping.skillId === 'spelling-words')).toBe(false);
    expect(AUSTRALIAN_ENGLISH_REPLACE_NOT_REBADGE.some((item) => item.skillId === 'spelling-words')).toBe(true);
  });

  it('does not claim the current England punctuation skill fully covers Australian Year 6 punctuation', () => {
    const mapping = AUSTRALIAN_ENGLISH_EXISTING_REUSE.find((item) => item.skillId === 'punctuation-y6');
    expect(mapping?.coverage).toBe('partial');
  });
});
