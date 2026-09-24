import { describe, expect, it } from 'vitest';
import { emptyLearningIntelligence } from '../brain/learning-intelligence';
import {
  AUSTRALIAN_TEACHER_OBJECTIVES,
  australianTeacherObjective,
  structuredHomework,
  syncTeacherHomeworkIntent,
} from './australia-teacher-objectives';

describe('Australian teacher objectives', () => {
  it('only exposes unique objectives with an executable practice route', () => {
    const ids = AUSTRALIAN_TEACHER_OBJECTIVES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(AUSTRALIAN_TEACHER_OBJECTIVES.every((item) => item.practiceSkillId && item.canonicalNodeId)).toBe(true);
  });

  it('does not expose the England statutory spelling list as an Australian objective', () => {
    expect(AUSTRALIAN_TEACHER_OBJECTIVES.some((item) => item.practiceSkillId === 'spelling-words')).toBe(false);
  });

  it('creates a stable structured homework payload from a verified objective', () => {
    const definition = australianTeacherObjective('au6-fractions-add-subtract')!;
    const homework = structuredHomework(definition, 1000, { priority: 1, dueAt: 5000, note: 'Friday focus' });
    expect(homework).toMatchObject({
      version: 2,
      objectiveId: 'au6-fractions-add-subtract',
      canonicalNodeId: 'math.fractions.add-subtract-equivalent',
      practiceSkillId: 'fractions-y6',
      priority: 1,
      dueAt: 5000,
      note: 'Friday focus',
    });
  });

  it('syncs teacher homework into Current Direction and cancels the old teacher intent', () => {
    const first = structuredHomework(australianTeacherObjective('au5-reading')!, 1000, {});
    const second = structuredHomework(australianTeacherObjective('au5-spelling')!, 2000, {});
    let state = syncTeacherHomeworkIntent(emptyLearningIntelligence(), first, 5);
    state = syncTeacherHomeworkIntent(state, second, 5);
    expect(state.intents.find((intent) => intent.id === first.id)?.status).toBe('cancelled');
    expect(state.intents.find((intent) => intent.id === second.id)).toMatchObject({
      source: 'teacher',
      status: 'active',
      canonicalNodeIds: ['english.spelling.word-building-y5'],
    });
    expect(state.curriculum).toEqual({
      jurisdiction: 'AU',
      curriculumId: 'au-ac-v9',
      curriculumVersion: '9.0',
      yearLevel: '5',
    });
  });
});
