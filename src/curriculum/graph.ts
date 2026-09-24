import type { CanonicalLearningNode } from './types';

export interface MissingPrerequisite {
  nodeId: string;
  prerequisiteId: string;
}

export interface LearningGraphValidation {
  duplicateIds: string[];
  missingPrerequisites: MissingPrerequisite[];
  cycles: string[][];
}

/** Validate identity and prerequisite integrity before a curriculum graph is used by the Brain. */
export function validateLearningGraph(nodes: readonly CanonicalLearningNode[]): LearningGraphValidation {
  const counts = new Map<string, number>();
  for (const node of nodes) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
  const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const missingPrerequisites: MissingPrerequisite[] = [];
  for (const node of nodes) {
    for (const prerequisiteId of node.prerequisites) {
      if (!byId.has(prerequisiteId)) missingPrerequisites.push({ nodeId: node.id, prerequisiteId });
    }
  }

  const cycles: string[][] = [];
  const done = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const seenCycles = new Set<string>();

  const visit = (id: string) => {
    if (done.has(id)) return;
    if (active.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = [...new Set(cycle)].sort().join('|');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push(cycle);
      }
      return;
    }

    const node = byId.get(id);
    if (!node) return;
    active.add(id);
    stack.push(id);
    for (const prerequisiteId of node.prerequisites) {
      if (byId.has(prerequisiteId)) visit(prerequisiteId);
    }
    stack.pop();
    active.delete(id);
    done.add(id);
  };

  for (const node of nodes) visit(node.id);
  return { duplicateIds, missingPrerequisites, cycles };
}
