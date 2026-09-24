import { describe, expect, it } from 'vitest';
import type { AnswerRecord, Profile } from '../brain/types';
import { newProfile } from '../storage';
import { australianTeacherObjective, structuredHomework } from './australia-teacher-objectives';
import { routeAustralianTeacherHomework } from './australia-intent-routing';

const evidence = (nodeId: string, at: number): AnswerRecord => ({
  at,
  skillId: 'legacy',
  level: 3,
  correct: true,
  timeMs: 3000,
  predicted: 0.7,
  curriculumEvidence: [{
    curriculumId: 'au-ac-v9',
    canonicalNodeId: nodeId,
    strength: 'direct',
  }],
});

const homework = (id: string) => structuredHomework(australianTeacherObjective(id)!, 100, {});

describe('canonical Australian teacher-intent routing', () => {
  it('routes Year 6 fraction addition through the unmet Year 5 fraction prerequisite first', () => {
    const profile = newProfile('Ava', '🦊', 6);
    const route = routeAustralianTeacherHomework(profile, homework('au6-fractions-add-subtract'))!;
    expect(route).toMatchObject({
      reason: 'prerequisite',
      targetCanonicalNodeId: 'math.fractions.add-subtract-equivalent',
      activeCanonicalNodeId: 'math.fractions.add-subtract-related',
      practiceSkillId: 'fractions-y6',
      practiceLevels: [2],
      evidenceStrength: 'direct',
    });
  });

  it('returns to the teacher destination once the prerequisite has strong direct evidence', () => {
    const profile = newProfile('Ava', '🦊', 6);
    profile.history = Array.from({ length: 4 }, (_, i) => evidence('math.fractions.add-subtract-related', i));
    const route = routeAustralianTeacherHomework(profile, homework('au6-fractions-add-subtract'))!;
    expect(route).toMatchObject({
      reason: 'target',
      activeCanonicalNodeId: 'math.fractions.add-subtract-equivalent',
      practiceLevels: [2, 3],
    });
  });

  it('uses another routable immediate prerequisite when one branch has no executable content', () => {
    const profile = newProfile('Ava', '🦊', 6);
    const route = routeAustralianTeacherHomework(profile, homework('au6-decimal-powers'))!;
    expect(route.reason).toBe('prerequisite');
    expect(route.activeCanonicalNodeId).toBe('math.multiplication.large-numbers');
    expect(route.practiceSkillId).toBe('long-multiplication-division');
  });

  it('does not invent a prerequisite route when the canonical prerequisites have no safe practice route', () => {
    const profile = newProfile('Ava', '🦊', 6);
    const route = routeAustralianTeacherHomework(profile, homework('au6-angle-relationships'))!;
    expect(route.reason).toBe('target');
    expect(route.activeCanonicalNodeId).toBe('math.angles.relationships');
  });

  it('ignores legacy homework because it has no canonical destination contract', () => {
    const profile = newProfile('Ava', '🦊', 6);
    expect(routeAustralianTeacherHomework(profile, {
      skillId: 'fractions-y6',
      note: '',
      setAt: 1,
    })).toBeNull();
  });
});
