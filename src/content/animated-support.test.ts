import { describe, expect, it } from 'vitest';
import type { Question } from '../brain/types';
import { revealsAnswer } from './solver';
import { animatedSupportFor } from './animated-support';

const question = (patch: Partial<Question>): Question => ({
  skillId: 'addition',
  level: 3,
  id: 'test',
  prompt: '47 + 38 = ?',
  answer: '85',
  explanation: 'Add the ones, then the tens.',
  ...patch,
});

describe('Animated Support v1', () => {
  it('builds a place-value visual from the real prompt', () => {
    const support = animatedSupportFor(question({
      skillId: 'place-value',
      prompt: 'What digit is in the hundreds place of 742?',
      answer: '7',
    }));
    expect(support?.kind).toBe('place-value');
    if (support?.kind === 'place-value') {
      expect(support.digits).toEqual(['7', '4', '2']);
      expect(support.targetPlace).toBe('hundreds');
    }
  });

  it('detects regrouping in column subtraction', () => {
    const support = animatedSupportFor(question({
      skillId: 'subtraction',
      prompt: '52 − 27 = ?',
      answer: '25',
    }));
    expect(support).toMatchObject({
      kind: 'column',
      operation: '−',
      regroup: true,
    });
  });

  it('detects carrying in column addition', () => {
    const support = animatedSupportFor(question({
      prompt: '47 + 38 = ?',
      answer: '85',
    }));
    expect(support).toMatchObject({
      kind: 'column',
      operation: '+',
      regroup: true,
    });
  });

  it('builds fraction-of-an-amount support', () => {
    const support = animatedSupportFor(question({
      skillId: 'fractions',
      prompt: 'What is 3/4 of 20?',
      answer: '15',
    }));
    expect(support).toMatchObject({
      kind: 'fraction',
      operation: 'of',
      amount: 20,
      fractions: [{ numerator: 3, denominator: 4 }],
    });
  });

  it('builds Year 6 fraction-operation support', () => {
    const support = animatedSupportFor(question({
      skillId: 'fractions-y6',
      prompt: '2/3 + 1/4 = ?',
      answer: '11/12',
    }));
    expect(support).toMatchObject({
      kind: 'fraction',
      operation: '+',
    });
  });

  it('builds multiplication and division group visuals', () => {
    expect(animatedSupportFor(question({
      skillId: 'multiplication',
      prompt: '8 × 7 = ?',
      answer: '56',
    }))).toMatchObject({ kind: 'groups', operation: 'multiply', left: 8, right: 7 });

    expect(animatedSupportFor(question({
      skillId: 'division',
      prompt: '56 ÷ 7 = ?',
      answer: '8',
    }))).toMatchObject({ kind: 'groups', operation: 'divide', left: 56, right: 7 });
  });

  it('keeps hint narration answer-safe for representative questions', () => {
    const samples = [
      question({ skillId: 'addition', prompt: '47 + 38 = ?', answer: '85' }),
      question({ skillId: 'subtraction', prompt: '52 − 27 = ?', answer: '25' }),
      question({ skillId: 'fractions', prompt: 'What is 3/4 of 20?', answer: '15' }),
      question({ skillId: 'multiplication', prompt: '8 × 7 = ?', answer: '56' }),
      question({ skillId: 'division', prompt: '56 ÷ 7 = ?', answer: '8' }),
    ];

    for (const sample of samples) {
      const support = animatedSupportFor(sample);
      expect(support).not.toBeNull();
      const narration = support!.steps.map((step) => `${step.title}. ${step.text}`).join(' ');
      expect(revealsAnswer(narration, sample.answer)).toBe(false);
    }
  });

  it('does not invent animated maths support for non-maths skills', () => {
    expect(animatedSupportFor(question({
      skillId: 'reading-y6',
      prompt: 'Why did the character leave?',
      answer: 'Because it was late',
      choices: ['Because it was late', 'Because it was raining'],
    }))).toBeNull();
  });
});
