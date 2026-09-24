import type { AnswerRecord } from './types';
import type { CanonicalLearningNode, EvidenceMode } from '../curriculum/types';

export type CanonicalProgressStatus =
  | 'not-started'
  | 'developing'
  | 'needs-support'
  | 'strong-evidence'
  | 'requires-broader-evidence'
  | 'mastered';

export interface CanonicalProgressSummary {
  nodeId: string;
  curriculumId: string;
  status: CanonicalProgressStatus;
  directEvidenceCount: number;
  supportingEvidenceCount: number;
  directWeight: number;
  totalWeight: number;
  weightedSuccess: number | null;
  confidence: number;
  autoMasterable: boolean;
  lastEvidenceAt: number | null;
}

export const CANONICAL_STRONG_DIRECT_COUNT = 4;
export const CANONICAL_STRONG_CONFIDENCE = 0.55;
export const CANONICAL_STRONG_SUCCESS = 0.8;
export const CANONICAL_NEEDS_SUPPORT_MAX_SUCCESS = 0.45;

const AUTO_EVIDENCE_MODES = new Set<EvidenceMode>([
  'selected-response',
  'typed-response',
  'constructed-response',
]);

export function canAutoMasterCanonicalNode(node: CanonicalLearningNode): boolean {
  return node.evidenceModes.length > 0 && node.evidenceModes.every((mode) => AUTO_EVIDENCE_MODES.has(mode));
}

const answerReliability = (answer: AnswerRecord): number => {
  if (answer.rapid) return 0.2;
  if (answer.hinted) return 0.5;
  return 1;
};

const evidenceStrengthWeight = (strength: 'direct' | 'supporting') => strength === 'direct' ? 1 : 0.3;

/**
 * Summarise canonical curriculum evidence conservatively.
 *
 * Direct evidence can establish strong academic evidence. Supporting evidence
 * helps the estimate but cannot satisfy the minimum direct-evidence gate.
 * Practical/investigation/teacher-observation nodes are never auto-mastered
 * from app question history alone.
 */
export function canonicalProgress(
  node: CanonicalLearningNode,
  curriculumId: string,
  history: readonly AnswerRecord[],
): CanonicalProgressSummary {
  let directEvidenceCount = 0;
  let supportingEvidenceCount = 0;
  let directWeight = 0;
  let totalWeight = 0;
  let weightedCorrect = 0;
  let lastEvidenceAt: number | null = null;

  for (const answer of history) {
    const evidence = answer.curriculumEvidence?.find(
      (item) => item.curriculumId === curriculumId && item.canonicalNodeId === node.id,
    );
    if (!evidence) continue;

    const reliability = answerReliability(answer);
    const strengthWeight = evidenceStrengthWeight(evidence.strength);
    const weight = reliability * strengthWeight;

    if (evidence.strength === 'direct') {
      directEvidenceCount++;
      directWeight += reliability;
    } else {
      supportingEvidenceCount++;
    }
    totalWeight += weight;
    weightedCorrect += (answer.correct ? 1 : 0) * weight;
    lastEvidenceAt = lastEvidenceAt === null ? answer.at : Math.max(lastEvidenceAt, answer.at);
  }

  const weightedSuccess = totalWeight > 0 ? weightedCorrect / totalWeight : null;
  const confidence = directWeight > 0 ? 1 - Math.exp(-directWeight / 4) : 0;
  const autoMasterable = canAutoMasterCanonicalNode(node);

  let status: CanonicalProgressStatus = 'not-started';
  if (totalWeight > 0) {
    const strong = directEvidenceCount >= CANONICAL_STRONG_DIRECT_COUNT
      && confidence >= CANONICAL_STRONG_CONFIDENCE
      && (weightedSuccess ?? 0) >= CANONICAL_STRONG_SUCCESS;

    if (strong) {
      status = autoMasterable ? 'mastered' : 'requires-broader-evidence';
    } else if (
      directEvidenceCount >= 2
      && weightedSuccess !== null
      && weightedSuccess < CANONICAL_NEEDS_SUPPORT_MAX_SUCCESS
    ) {
      status = 'needs-support';
    } else if (
      directEvidenceCount >= CANONICAL_STRONG_DIRECT_COUNT
      && weightedSuccess !== null
      && weightedSuccess >= CANONICAL_STRONG_SUCCESS
    ) {
      // Strong result but not enough reliable weight/confidence yet.
      status = 'strong-evidence';
    } else {
      status = 'developing';
    }
  }

  return {
    nodeId: node.id,
    curriculumId,
    status,
    directEvidenceCount,
    supportingEvidenceCount,
    directWeight,
    totalWeight,
    weightedSuccess,
    confidence,
    autoMasterable,
    lastEvidenceAt,
  };
}
