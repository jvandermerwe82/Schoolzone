import { describe, expect, it } from 'vitest';
import { validateLearningGraph } from './graph';
import {
  AUSTRALIA_YEARS4_6_ENGLISH_CORE_CODES,
  AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES,
  australianEnglishCoreNode,
} from './australia-english-core';

const EXPECTED_CODES = [
  'AC9E4LA03', 'AC9E5LA03', 'AC9E6LA03',
  'AC9E4LY05', 'AC9E5LY05', 'AC9E6LY05',
  'AC9E4LY09', 'AC9E4LY10', 'AC9E4LY11',
  'AC9E5LY08', 'AC9E5LY09', 'AC9E5LY10',
  'AC9E6LY08', 'AC9E6LY09',
  'AC9E4LA06', 'AC9E4LA07', 'AC9E4LA08', 'AC9E4LA09',
  'AC9E5LA05', 'AC9E5LA06', 'AC9E6LA05', 'AC9E6LA06',
  'AC9E4LA12', 'AC9E5LA09', 'AC9E6LA09',
  'AC9E4LA11', 'AC9E5LA08', 'AC9E6LA08',
];

describe('Australian Years 4-6 English core graph', () => {
  it('contains exactly the verified codes in the focused SchoolZone English scope', () => {
    expect(AUSTRALIA_YEARS4_6_ENGLISH_CORE_CODES).toHaveLength(EXPECTED_CODES.length);
    expect(new Set(AUSTRALIA_YEARS4_6_ENGLISH_CORE_CODES)).toEqual(new Set(EXPECTED_CODES));
  });

  it('has no duplicate ids, missing prerequisites or cycles', () => {
    expect(validateLearningGraph(AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES)).toEqual({
      duplicateIds: [],
      missingPrerequisites: [],
      cycles: [],
    });
  });

  it('creates explicit reading and spelling progression across Years 4-6', () => {
    expect(australianEnglishCoreNode('english.reading.comprehension-y6')?.prerequisites)
      .toContain('english.reading.comprehension-y5');
    expect(australianEnglishCoreNode('english.spelling.roots-technical-y6')?.prerequisites)
      .toContain('english.spelling.word-building-y5');
  });

  it('keeps spelling evidence as production, not recognition-only', () => {
    for (const node of AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES.filter((item) => item.id.startsWith('english.spelling.'))) {
      expect(node.evidenceModes).toContain('typed-response');
    }
  });
});
