import type { Profile } from '../brain/types';
import { canonicalProgress, type CanonicalProgressSummary } from '../brain/canonical-progress';
import { AUSTRALIA_YEARS4_6_MATHS_NODES } from './australia-maths';
import { AUSTRALIA_YEARS4_6_SCIENCE_NODES } from './australia-science';
import { AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES } from './australia-english-core';
import type { CanonicalLearningNode } from './types';

export const AUSTRALIA_CANONICAL_NODES: readonly CanonicalLearningNode[] = [
  ...AUSTRALIA_YEARS4_6_MATHS_NODES,
  ...AUSTRALIA_YEARS4_6_SCIENCE_NODES,
  ...AUSTRALIA_YEARS4_6_ENGLISH_CORE_NODES,
] as const;

const byId = new Map(AUSTRALIA_CANONICAL_NODES.map((node) => [node.id, node]));

export function australianCanonicalNode(id: string): CanonicalLearningNode | null {
  return byId.get(id) ?? null;
}

export function australianCanonicalProgress(
  profile: Pick<Profile, 'history'>,
  nodeId: string,
): CanonicalProgressSummary | null {
  const node = australianCanonicalNode(nodeId);
  return node ? canonicalProgress(node, 'au-ac-v9', profile.history) : null;
}
