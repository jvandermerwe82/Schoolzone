import { describe, expect, it } from 'vitest';
import type { Question } from '../brain/types';
import { newProfile } from '../storage';
import { setCurriculumContext } from '../brain/learning-intelligence';
import { curriculumEvidenceForQuestion } from './evidence';

const question: Question = {
  skillId: 'decimals-percentages',
  level: 3,
  id: 'pct',
  prompt: 'What is 25% of 80?',
  answer: '20',
  explanation: '',
};

describe('curriculum evidence dispatcher', () => {
  it('returns no curriculum evidence without explicit curriculum context', () => {
    expect(curriculumEvidenceForQuestion(newProfile('Ava', '🦊', 5), question)).toEqual([]);
  });

  it('dispatches Australian evidence only after the learner is explicitly attached to AC v9', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = setCurriculumContext(profile.learningIntelligence!, {
      jurisdiction: 'AU',
      curriculumId: 'au-ac-v9',
      curriculumVersion: '9.0',
      yearLevel: '5',
    });
    expect(curriculumEvidenceForQuestion(profile, question)).toEqual([
      {
        curriculumId: 'au-ac-v9',
        canonicalNodeId: 'math.quantities.fraction-decimal-percent',
        strength: 'direct',
      },
    ]);
  });

  it('does not guess unsupported curricula', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = setCurriculumContext(profile.learningIntelligence!, {
      jurisdiction: 'XX',
      curriculumId: 'future-pack',
      curriculumVersion: '1',
      yearLevel: '5',
    });
    expect(curriculumEvidenceForQuestion(profile, question)).toEqual([]);
  });
});
