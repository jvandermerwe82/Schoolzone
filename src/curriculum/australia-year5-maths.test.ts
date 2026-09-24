import { describe, expect, it } from 'vitest';
import { AUSTRALIA_YEAR5_MATHS_CODES, AUSTRALIA_YEAR5_MATHS_NODES } from './australia-year5-maths';

describe('Australian Year 5 Mathematics canonical nodes', () => {
  it('covers each Year 5 Mathematics v9 content code exactly once', () => {
    const expected = [
      'AC9M5N01', 'AC9M5N02', 'AC9M5N03', 'AC9M5N04', 'AC9M5N05',
      'AC9M5N06', 'AC9M5N07', 'AC9M5N08', 'AC9M5N09', 'AC9M5N010',
      'AC9M5A01', 'AC9M5A02',
      'AC9M5M01', 'AC9M5M02', 'AC9M5M03', 'AC9M5M04',
      'AC9M5SP01', 'AC9M5SP02', 'AC9M5SP03',
      'AC9M5ST01', 'AC9M5ST02', 'AC9M5ST03',
      'AC9M5P01', 'AC9M5P02',
    ];
    expect(new Set(AUSTRALIA_YEAR5_MATHS_CODES)).toEqual(new Set(expected));
    expect(AUSTRALIA_YEAR5_MATHS_CODES).toHaveLength(expected.length);
  });

  it('uses unique curriculum-independent node ids', () => {
    const ids = AUSTRALIA_YEAR5_MATHS_NODES.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('math.'))).toBe(true);
  });

  it('does not pretend practical and investigation outcomes are quiz-only', () => {
    const investigation = AUSTRALIA_YEAR5_MATHS_NODES.find((node) => node.id === 'math.statistics.investigation')!;
    const angles = AUSTRALIA_YEAR5_MATHS_NODES.find((node) => node.id === 'math.angles.measure-degrees')!;
    expect(investigation.evidenceModes).toContain('investigation');
    expect(angles.evidenceModes).toContain('practical');
  });

  it('makes key within-year dependencies explicit', () => {
    const fractionAddition = AUSTRALIA_YEAR5_MATHS_NODES.find((node) => node.id === 'math.fractions.add-subtract-related')!;
    expect(fractionAddition.prerequisites).toContain('math.fractions.compare-order-related');
  });
});
