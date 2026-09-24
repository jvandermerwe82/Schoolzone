import { AUSTRALIA_YEAR4_MATHS_NODES } from './australia-year4-maths';
import { AUSTRALIA_YEAR5_MATHS_NODES } from './australia-year5-maths';
import { AUSTRALIA_YEAR6_MATHS_NODES } from './australia-year6-maths';
import type { CanonicalLearningNode } from './types';

export const AUSTRALIA_YEARS4_6_MATHS_NODES: readonly CanonicalLearningNode[] = [
  ...AUSTRALIA_YEAR4_MATHS_NODES,
  ...AUSTRALIA_YEAR5_MATHS_NODES,
  ...AUSTRALIA_YEAR6_MATHS_NODES,
] as const;

const byId = new Map(AUSTRALIA_YEARS4_6_MATHS_NODES.map((node) => [node.id, node]));

export function australianMathNode(id: string): CanonicalLearningNode | null {
  return byId.get(id) ?? null;
}
