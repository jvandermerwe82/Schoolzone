import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from './types';
import type { CanonicalLearningNode } from '../curriculum/types';
import {
  CANONICAL_STRONG_DIRECT_COUNT,
  canonicalProgress,
  canAutoMasterCanonicalNode,
} from './canonical-progress';

const node = (modes: CanonicalLearningNode['evidenceModes']): CanonicalLearningNode => ({
  id: 'math.test',
  subject: 'mathematics',
  name: 'Test concept',
  strand: 'number',
  prerequisites: [],
  evidenceModes: modes,
  curriculumRefs: ['au-ac-v9:TEST'],
});

const answer = (
  correct: boolean,
  at: number,
  strength: 'direct' | 'supporting' = 'direct',
  patch: Partial<AnswerRecord> = {},
): AnswerRecord => ({
  at,
  skillId: 'legacy',
  level: 3,
  correct,
  timeMs: 3000,
  predicted: 0.5,
  curriculumEvidence: [{
    curriculumId: 'au-ac-v9',
    canonicalNodeId: 'math.test',
    strength,
  }],
  ...patch,
});

describe('canonical concept progress', () => {
  it('starts with no evidence and no mastery claim', () => {
    expect(canonicalProgress(node(['typed-response']), 'au-ac-v9', [])).toMatchObject({
      status: 'not-started',
      directEvidenceCount: 0,
      supportingEvidenceCount: 0,
      weightedSuccess: null,
      confidence: 0,
    });
  });

  it('requires repeated direct evidence before mastery', () => {
    const history = Array.from({ length: CANONICAL_STRONG_DIRECT_COUNT }, (_, i) => answer(true, i));
    const summary = canonicalProgress(node(['typed-response']), 'au-ac-v9', history);
    expect(summary.status).toBe('mastered');
    expect(summary.weightedSuccess).toBe(1);
    expect(summary.confidence).toBeGreaterThan(0.55);
  });

  it('supporting evidence can inform progress but can never satisfy the direct-evidence gate', () => {
    const history = Array.from({ length: 20 }, (_, i) => answer(true, i, 'supporting'));
    const summary = canonicalProgress(node(['typed-response']), 'au-ac-v9', history);
    expect(summary.supportingEvidenceCount).toBe(20);
    expect(summary.directEvidenceCount).toBe(0);
    expect(summary.status).toBe('developing');
    expect(summary.confidence).toBe(0);
  });

  it('does not auto-master practical or investigation outcomes from quiz history', () => {
    const practical = node(['constructed-response', 'practical', 'teacher-observation']);
    const history = Array.from({ length: 8 }, (_, i) => answer(true, i));
    const summary = canonicalProgress(practical, 'au-ac-v9', history);
    expect(canAutoMasterCanonicalNode(practical)).toBe(false);
    expect(summary.status).toBe('requires-broader-evidence');
  });

  it('treats hinted and rapid answers as lower-reliability evidence', () => {
    const hinted = Array.from({ length: 4 }, (_, i) => answer(true, i, 'direct', { hinted: true }));
    const rapid = Array.from({ length: 4 }, (_, i) => answer(false, i, 'direct', { rapid: true }));
    const clean = Array.from({ length: 4 }, (_, i) => answer(true, i));
    expect(canonicalProgress(node(['typed-response']), 'au-ac-v9', hinted).confidence)
      .toBeLessThan(canonicalProgress(node(['typed-response']), 'au-ac-v9', clean).confidence);
    expect(canonicalProgress(node(['typed-response']), 'au-ac-v9', rapid).directWeight).toBeCloseTo(0.8);
  });

  it('identifies repeated low-success direct evidence as needing support', () => {
    const history = [answer(false, 1), answer(false, 2), answer(true, 3)];
    const summary = canonicalProgress(node(['typed-response']), 'au-ac-v9', history);
    expect(summary.weightedSuccess).toBeCloseTo(1 / 3);
    expect(summary.status).toBe('needs-support');
  });

  it('ignores evidence from another curriculum pack or node', () => {
    const wrongNode = answer(true, 1);
    wrongNode.curriculumEvidence![0].canonicalNodeId = 'math.other';
    const summary = canonicalProgress(node(['typed-response']), 'au-ac-v9', [wrongNode]);
    expect(summary.status).toBe('not-started');
  });
});
