import { describe, expect, it } from 'vitest';
import { initialSkillState, updateSkill } from './brain/model';
import { pilotAnswerEvent, newMissionEvidenceId } from './pilot-evidence';

describe('Pilot Evidence v1', () => {
  it('creates deterministic-format mission ids without personal data', () => {
    const id = newMissionEvidenceId(12345, () => 0.5);
    expect(id).toMatch(/^m-[a-z0-9]+-[a-z0-9]+$/);
    expect(id).not.toContain('child');
  });

  it('builds structured learning telemetry with no raw answer or free text', () => {
    const before = initialSkillState(6, 5);
    const after = updateSkill(before, 3, true, 0.15, 3200, 10_000);

    const event = pilotAnswerEvent({
      at: 10_000,
      timeMs: 3200,
      sessionId: 'm-test',
      sessionPosition: 2,
      missionLength: 8,
      question: {
        id: 'q1',
        skillId: 'fractions-y6',
        level: 3,
        prompt: 'Private question text should not be exported',
        answer: '3/4',
        explanation: 'Private explanation',
      },
      itemKey: 'fractions-y6:L3',
      correct: true,
      hinted: false,
      plan: {
        skillId: 'fractions-y6',
        level: 3,
        reason: 'continue',
        message: 'Kid-facing message should not be exported',
        diagnostic: true,
      },
      result: {
        predicted: 0.71,
        misconception: null,
        rapid: false,
        event: null,
      },
      before,
      after,
      curriculumEvidence: [{
        curriculumId: 'au-ac-v9',
        canonicalNodeId: 'math.fractions.add-subtract-equivalent',
        strength: 'direct',
      }],
      teacherRoute: {
        reason: 'target',
        targetCanonicalNodeId: 'math.fractions.add-subtract-equivalent',
        targetTitle: 'Teacher-facing title should not be exported',
        activeCanonicalNodeId: 'math.fractions.add-subtract-equivalent',
        activeTitle: 'Teacher-facing active title',
        subject: 'maths',
        practiceSkillId: 'fractions-y6',
        evidenceStrength: 'direct',
        targetProgress: null,
        activeProgress: null,
      },
    });

    expect(event).toMatchObject({
      eventVersion: 1,
      sessionId: 'm-test',
      sessionPosition: 2,
      missionLength: 8,
      planReason: 'continue',
      diagnostic: true,
      dueReview: false,
      curriculumId: 'au-ac-v9',
      canonicalNodeId: 'math.fractions.add-subtract-equivalent',
      evidenceStrength: 'direct',
      teacherTargetNodeId: 'math.fractions.add-subtract-equivalent',
      teacherRouteReason: 'target',
      pKnownBefore: before.pKnown,
      pKnownAfter: after.pKnown,
      abilityBefore: before.ability,
      abilityAfter: after.ability,
    });
    expect(JSON.stringify(event)).not.toContain('Private question text');
    expect(JSON.stringify(event)).not.toContain('Private explanation');
    expect(JSON.stringify(event)).not.toContain('Kid-facing message');
    expect(JSON.stringify(event)).not.toContain('Teacher-facing title');
  });

  it('marks a due mastered review from pre-answer state', () => {
    const before = {
      ...initialSkillState(6, 3),
      masteredAt: 100,
      nextReviewAt: 500,
      pKnown: 0.99,
      ability: 2,
    };
    const after = { ...before, nextReviewAt: 1000 };

    const event = pilotAnswerEvent({
      at: 600,
      timeMs: 2000,
      sessionId: 'm-review',
      sessionPosition: 1,
      missionLength: 6,
      question: {
        id: 'q2',
        skillId: 'number-sense',
        level: 3,
        prompt: 'x',
        answer: '1',
        explanation: 'x',
      },
      itemKey: 'number-sense:L3',
      correct: true,
      hinted: false,
      plan: {
        skillId: 'number-sense',
        level: 3,
        reason: 'review',
        message: '',
      },
      result: {
        predicted: 0.9,
        misconception: null,
        rapid: false,
        event: null,
      },
      before,
      after,
      curriculumEvidence: [],
    });

    expect(event.dueReview).toBe(true);
    expect(event.planReason).toBe('review');
  });
});
