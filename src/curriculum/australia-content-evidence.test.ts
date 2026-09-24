import { describe, expect, it } from 'vitest';
import type { Level, Question } from '../brain/types';
import { australianEvidenceForQuestion, isKnownAustralianEvidenceTarget } from './australia-content-evidence';

const q = (skillId: string, level: Level, prompt: string): Question => ({
  skillId,
  level,
  id: `${skillId}:${prompt}`,
  prompt,
  answer: 'x',
  explanation: '',
});

describe('Australian content evidence mapping', () => {
  it('maps only to canonical nodes that exist', () => {
    const samples = [
      q('negative-numbers', 3, 'What is the difference between −5 °C and 8 °C?'),
      q('decimals-percentages', 3, 'What is 25% of 80?'),
      q('forces-energy', 2, 'Which force pulls things down towards the Earth?'),
      q('reading-y6', 3, 'Why did the character leave?'),
      q('spelling-patterns', 3, 'Choose the correct spelling.'),
    ];
    for (const sample of samples) {
      for (const evidence of australianEvidenceForQuestion(sample, '5')) {
        expect(isKnownAustralianEvidenceTarget(evidence.canonicalNodeId)).toBe(true);
      }
    }
  });

  it('marks partial integer coverage as supporting rather than full direct mastery evidence', () => {
    expect(australianEvidenceForQuestion(q('negative-numbers', 4, 'What is −5 + 7?'), '6')).toEqual([
      expect.objectContaining({ canonicalNodeId: 'math.integers.number-line-cartesian', strength: 'supporting' }),
    ]);
  });

  it('does not rebadge UK fraction multiplication as Australian Year 6 fraction addition/subtraction', () => {
    expect(australianEvidenceForQuestion(q('fractions-y6', 4, '2/3 × 3/4 = ?'), '6')).toEqual([]);
  });

  it('maps precise existing maths generators when the construct is aligned', () => {
    expect(australianEvidenceForQuestion(q('decimals-percentages', 2, '3.4 × 100 = ?'), '6')[0]).toMatchObject({
      canonicalNodeId: 'math.decimals.mul-div-powers-10',
      strength: 'direct',
    });
    expect(australianEvidenceForQuestion(q('algebra', 2, '4n = 28. What is n?'), '5')[0]).toMatchObject({
      canonicalNodeId: 'math.equations.mul-div-unknowns',
      strength: 'direct',
    });
  });

  it('splits mixed legacy science banks by the actual question construct', () => {
    expect(australianEvidenceForQuestion(q('earth-space', 5, 'In the water cycle, how do clouds form?'), '4')[0])
      .toMatchObject({ canonicalNodeId: 'science.earth.water-cycle' });
    expect(australianEvidenceForQuestion(q('earth-space', 3, 'What causes day and night?'), '6')[0])
      .toMatchObject({ canonicalNodeId: 'science.space.earth-sun-cycles' });
    expect(australianEvidenceForQuestion(q('forces-energy', 2, 'Which force slows down a ball rolling on grass?'), '4')[0])
      .toMatchObject({ canonicalNodeId: 'science.forces.friction-gravity-magnetism', strength: 'direct' });
  });

  it('maps reading by learner year instead of duplicating the same answer into three year levels', () => {
    const sample = q('reading-y6', 3, 'What can you infer?');
    expect(australianEvidenceForQuestion(sample, '4')[0].canonicalNodeId).toBe('english.reading.comprehension-y4');
    expect(australianEvidenceForQuestion(sample, '5')[0].canonicalNodeId).toBe('english.reading.comprehension-y5');
    expect(australianEvidenceForQuestion(sample, '6')[0].canonicalNodeId).toBe('english.reading.comprehension-y6');
  });

  it('never treats the England statutory spelling list as Australian curriculum evidence', () => {
    expect(australianEvidenceForQuestion(q('spelling-words', 3, 'Spell accommodate.'), '5')).toEqual([]);
  });

  it('does not overclaim England semicolon content as Australian Year 6 comma mastery', () => {
    expect(australianEvidenceForQuestion(q('punctuation-y6', 5, 'Which sentence uses semi-colons correctly?'), '6')).toEqual([]);
  });
});
