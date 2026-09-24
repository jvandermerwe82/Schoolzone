import { describe, expect, it } from 'vitest';
import { validateLearningGraph } from './graph';
import { AUSTRALIA_YEARS4_6_MATHS_NODES, australianMathNode } from './australia-maths';

describe('Australian Years 4-6 Mathematics learning graph', () => {
  it('has no duplicate ids, missing prerequisites or cycles', () => {
    expect(validateLearningGraph(AUSTRALIA_YEARS4_6_MATHS_NODES)).toEqual({
      duplicateIds: [],
      missingPrerequisites: [],
      cycles: [],
    });
  });

  it('forms an explicit Year 4 to Year 5 to Year 6 progression for representative concepts', () => {
    expect(australianMathNode('math.decimals.place-value-order')?.prerequisites)
      .toContain('math.decimals.tenths-hundredths');
    expect(australianMathNode('math.decimals.add-subtract')?.prerequisites)
      .toContain('math.decimals.place-value-order');

    expect(australianMathNode('math.probability.outcomes-likelihood')?.prerequisites)
      .toContain('math.probability.likelihood-dependence');
    expect(australianMathNode('math.probability.simulation-frequency')?.prerequisites)
      .toContain('math.probability.repeated-experiments');
  });

  it('contains 71 canonical maths nodes across the first three Australian launch years', () => {
    expect(AUSTRALIA_YEARS4_6_MATHS_NODES).toHaveLength(71);
  });
});
