import { describe, expect, it } from 'vitest';
import { validateLearningGraph } from './graph';
import {
  AUSTRALIA_YEARS4_6_SCIENCE_CODES,
  AUSTRALIA_YEARS4_6_SCIENCE_NODES,
  australianScienceNode,
} from './australia-science';

const YEAR4_CODES = [
  'AC9S4U01', 'AC9S4U02', 'AC9S4U03', 'AC9S4U04',
  'AC9S4H01', 'AC9S4H02',
  'AC9S4I01', 'AC9S4I02', 'AC9S4I03', 'AC9S4I04', 'AC9S4I05', 'AC9S4I06',
];

const YEAR5_CODES = [
  'AC9S5U01', 'AC9S5U02', 'AC9S5U03', 'AC9S5U04',
  'AC9S5H01', 'AC9S5H02',
  'AC9S5I01', 'AC9S5I02', 'AC9S5I03', 'AC9S5I04', 'AC9S5I05', 'AC9S5I06',
];

const YEAR6_CODES = [
  'AC9S6U01', 'AC9S6U02', 'AC9S6U03', 'AC9S6U04',
  'AC9S6H01', 'AC9S6H02',
  'AC9S6I01', 'AC9S6I02', 'AC9S6I03', 'AC9S6I04', 'AC9S6I05', 'AC9S6I06',
];

describe('Australian Years 4-6 Science graph', () => {
  it('covers all 36 verified curriculum references exactly once', () => {
    const expected = [...YEAR4_CODES, ...YEAR5_CODES, ...YEAR6_CODES];
    expect(AUSTRALIA_YEARS4_6_SCIENCE_CODES).toHaveLength(expected.length);
    expect(new Set(AUSTRALIA_YEARS4_6_SCIENCE_CODES)).toEqual(new Set(expected));
  });

  it('uses shared canonical nodes for identical Years 5-6 banded inquiry and human-endeavour content', () => {
    const node = australianScienceNode('science.inquiry.investigable-questions')!;
    expect(node.curriculumRefs).toEqual(['au-ac-v9:AC9S5I01', 'au-ac-v9:AC9S6I01']);
    expect(AUSTRALIA_YEARS4_6_SCIENCE_NODES).toHaveLength(28);
  });

  it('has no duplicate ids, missing prerequisites or cycles', () => {
    expect(validateLearningGraph(AUSTRALIA_YEARS4_6_SCIENCE_NODES)).toEqual({
      duplicateIds: [],
      missingPrerequisites: [],
      cycles: [],
    });
  });

  it('creates explicit conceptual progression from Year 4 to Year 6', () => {
    expect(australianScienceNode('science.biology.adaptations-survival')?.prerequisites)
      .toContain('science.ecology.roles-food-chains');
    expect(australianScienceNode('science.biology.habitat-conditions')?.prerequisites)
      .toContain('science.biology.adaptations-survival');
    expect(australianScienceNode('science.chemistry.reversible-irreversible-change')?.prerequisites)
      .toContain('science.matter.particle-states');
  });

  it('requires investigation/practical evidence for inquiry-heavy learning', () => {
    for (const node of AUSTRALIA_YEARS4_6_SCIENCE_NODES.filter((item) => item.strand === 'science-inquiry')) {
      expect(node.evidenceModes.some((mode) => mode === 'investigation' || mode === 'practical')).toBe(true);
    }
  });
});
