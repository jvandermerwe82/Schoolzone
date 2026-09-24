import { describe, expect, it } from 'vitest';
import { AUSTRALIA_YEAR4_MATHS_CODES, AUSTRALIA_YEAR4_MATHS_NODES } from './australia-year4-maths';
import { AUSTRALIA_YEAR5_MATHS_NODES } from './australia-year5-maths';
import { AUSTRALIA_YEAR6_MATHS_CODES, AUSTRALIA_YEAR6_MATHS_NODES } from './australia-year6-maths';

describe('Australian Years 4-6 Mathematics progression', () => {
  it('covers every verified Year 4 content code once', () => {
    const expected = [
      'AC9M4N01', 'AC9M4N02', 'AC9M4N03', 'AC9M4N04', 'AC9M4N05', 'AC9M4N06', 'AC9M4N07', 'AC9M4N08', 'AC9M4N09',
      'AC9M4A01', 'AC9M4A02',
      'AC9M4M01', 'AC9M4M02', 'AC9M4M03', 'AC9M4M04',
      'AC9M4SP01', 'AC9M4SP02', 'AC9M4SP03',
      'AC9M4ST01', 'AC9M4ST02', 'AC9M4ST03',
      'AC9M4P01', 'AC9M4P02',
    ];
    expect(AUSTRALIA_YEAR4_MATHS_CODES).toHaveLength(expected.length);
    expect(new Set(AUSTRALIA_YEAR4_MATHS_CODES)).toEqual(new Set(expected));
  });

  it('covers every verified Year 6 content code once', () => {
    const expected = [
      'AC9M6N01', 'AC9M6N02', 'AC9M6N03', 'AC9M6N04', 'AC9M6N05', 'AC9M6N06', 'AC9M6N07', 'AC9M6N08', 'AC9M6N09',
      'AC9M6A01', 'AC9M6A02', 'AC9M6A03',
      'AC9M6M01', 'AC9M6M02', 'AC9M6M03', 'AC9M6M04',
      'AC9M6SP01', 'AC9M6SP02', 'AC9M6SP03',
      'AC9M6ST01', 'AC9M6ST02', 'AC9M6ST03',
      'AC9M6P01', 'AC9M6P02',
    ];
    expect(AUSTRALIA_YEAR6_MATHS_CODES).toHaveLength(expected.length);
    expect(new Set(AUSTRALIA_YEAR6_MATHS_CODES)).toEqual(new Set(expected));
  });

  it('uses globally unique canonical ids across the three launch years', () => {
    const all = [...AUSTRALIA_YEAR4_MATHS_NODES, ...AUSTRALIA_YEAR5_MATHS_NODES, ...AUSTRALIA_YEAR6_MATHS_NODES];
    const ids = all.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links Year 6 concepts back to Year 5 prerequisites', () => {
    const y6 = new Map(AUSTRALIA_YEAR6_MATHS_NODES.map((node) => [node.id, node]));
    expect(y6.get('math.number.prime-composite-square')?.prerequisites)
      .toContain('math.number.factors-multiples-divisibility');
    expect(y6.get('math.fractions.add-subtract-equivalent')?.prerequisites)
      .toContain('math.fractions.add-subtract-related');
    expect(y6.get('math.probability.simulation-frequency')?.prerequisites)
      .toContain('math.probability.repeated-experiments');
  });

  it('keeps investigation-heavy outcomes from being quiz-only', () => {
    const nodes = [...AUSTRALIA_YEAR4_MATHS_NODES, ...AUSTRALIA_YEAR6_MATHS_NODES];
    for (const node of nodes.filter((item) => item.id.includes('investigation') || item.id.includes('simulation'))) {
      expect(node.evidenceModes.some((mode) => mode === 'investigation' || mode === 'teacher-observation')).toBe(true);
    }
  });
});
