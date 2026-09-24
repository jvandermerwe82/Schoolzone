import { describe, expect, it } from 'vitest';
import type { Question } from '../brain/types';
import { newProfile } from '../storage';
import { setCurriculumContext } from '../brain/learning-intelligence';
import { recordAnswer } from '../brain/tutor';
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


describe('curriculum evidence answer persistence', () => {
  it('persists dispatched evidence on the answer record without replacing the academic update', () => {
    const profile = newProfile('Ava', '🦊', 5);
    profile.learningIntelligence = setCurriculumContext(profile.learningIntelligence!, {
      jurisdiction: 'AU',
      curriculumId: 'au-ac-v9',
      curriculumVersion: '9.0',
      yearLevel: '5',
    });
    const evidence = curriculumEvidenceForQuestion(profile, question);
    const result = recordAnswer(profile, question, true, 4000, 1000, {
      given: '20',
      curriculumEvidence: evidence,
    });
    expect(result.profile.history.at(-1)?.curriculumEvidence).toEqual(evidence);
    expect(result.profile.skills['decimals-percentages'].attempts).toBe(1);
  });
});


describe('structured curriculum focus evidence', () => {
  const fractionQuestion: Question = {
    skillId: 'fractions-y6',
    level: 2,
    id: 'fraction-related',
    prompt: '1/2 + 1/4 = ?',
    answer: '3/4',
    explanation: '',
  };

  const profile = () => {
    const p = newProfile('Ava', '🦊', 6);
    p.learningIntelligence = setCurriculumContext(p.learningIntelligence!, {
      jurisdiction: 'AU',
      curriculumId: 'au-ac-v9',
      curriculumVersion: '9.0',
      yearLevel: '6',
    });
    return p;
  };

  it('credits only the active prerequisite when a verified structured route is active', () => {
    expect(curriculumEvidenceForQuestion(profile(), fractionQuestion, {
      curriculumId: 'au-ac-v9',
      canonicalNodeId: 'math.fractions.add-subtract-related',
      practiceSkillId: 'fractions-y6',
      practiceLevels: [2],
      strength: 'direct',
    })).toEqual([{
      curriculumId: 'au-ac-v9',
      canonicalNodeId: 'math.fractions.add-subtract-related',
      strength: 'direct',
    }]);
  });

  it('does not credit an easier helper question to the active objective when it falls outside the verified levels', () => {
    const helper = { ...fractionQuestion, id: 'fraction-helper', level: 1 as const };
    const evidence = curriculumEvidenceForQuestion(profile(), helper, {
      curriculumId: 'au-ac-v9',
      canonicalNodeId: 'math.fractions.add-subtract-related',
      practiceSkillId: 'fractions-y6',
      practiceLevels: [2],
      strength: 'direct',
    });
    expect(evidence.some((item) => item.canonicalNodeId === 'math.fractions.add-subtract-related')).toBe(false);
  });
});
