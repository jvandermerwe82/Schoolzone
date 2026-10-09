import { describe, expect, it } from 'vitest';
import { diagnose } from '../brain/misconceptions';
import type { Level, Question } from '../brain/types';
import { seededRng } from '../brain-lab/rng';
import { checkAnswer, parseNumber } from './index';
import {
  barPieces,
  combinedPart,
  describeBar,
  fractionBarsFor,
  MAX_BAR_PIECES,
  sameSizePieces,
  splitOptions,
  splitPart,
} from './fraction-bars';
import { MATHS_GENERATORS } from './maths';
import { MATHS_Y6_GENERATORS } from './maths-y6';

const make = (skill: 'fractions' | 'fractions-y6', level: Level, seed: number): Question =>
  (skill === 'fractions' ? MATHS_GENERATORS : MATHS_Y6_GENERATORS)[skill](level, seededRng(seed));

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

describe('fraction bars: exact equal-piece geometry', () => {
  it('draws exactly d equal pieces that cover the whole bar, with n shaded', () => {
    for (let d = 2; d <= MAX_BAR_PIECES; d++) {
      for (let n = 0; n <= d; n++) {
        const pieces = barPieces(d, n);
        expect(pieces).toHaveLength(d);
        expect(new Set(pieces.map((p) => p.width)).size).toBe(1);
        expect(pieces.reduce((sum, p) => sum + p.width, 0)).toBeCloseTo(1, 10);
        expect(pieces.filter((p) => p.shaded)).toHaveLength(n);
        // Pieces tile the bar with no gap or overlap.
        pieces.forEach((p, i) => expect(p.start).toBeCloseTo(i / d, 10));
      }
    }
  });

  it('never treats different-size pieces as the same size', () => {
    expect(sameSizePieces({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toBe(false);
    expect(sameSizePieces({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 })).toBe(false);
    expect(sameSizePieces({ numerator: 1, denominator: 4 }, { numerator: 3, denominator: 4 })).toBe(true);
  });

  it('keeps the amount the same when every piece is cut into k equal pieces', () => {
    for (const d of [2, 3, 4, 5, 6, 8]) {
      for (let n = 1; n < d; n++) {
        for (const k of [1, 2, 3, 4, 5, 6]) {
          const cut = splitPart({ numerator: n, denominator: d }, k);
          expect(cut.numerator / cut.denominator).toBeCloseTo(n / d, 10);
        }
      }
    }
  });

  it('only offers cuts that stay within the drawable bar size', () => {
    expect(splitOptions({ numerator: 1, denominator: 2 })).toEqual([1, 2, 3, 4, 5, 6]);
    expect(splitOptions({ numerator: 1, denominator: 8 })).toEqual([1, 2, 3]);
    expect(splitOptions({ numerator: 1, denominator: 12 })).toEqual([1, 2]);
    expect(splitOptions({ numerator: 1, denominator: 30 })).toEqual([]);
  });
});

describe('fraction bars: parsing real generator questions', () => {
  it('represents every Year 5 related-denominator addition (fractions-y6 level 2) and matches the real answer', () => {
    for (const seed of SEEDS) {
      const question = make('fractions-y6', 2, seed);
      const model = fractionBarsFor(question);
      expect(model, question.prompt).not.toBeNull();
      const m = model!;
      const left = splitPart(m.parts[0], m.matchingSplits[0]);
      const right = splitPart(m.parts[1], m.matchingSplits[1]);
      expect(left.denominator).toBe(right.denominator);
      expect(left.denominator).toBe(m.commonDenominator);
      const total = combinedPart(m, m.matchingSplits)!;
      expect(total.numerator / total.denominator).toBeCloseTo(parseNumber(question.answer)!, 10);
    }
  });

  it('is exact for unlike-denominator addition and subtraction, or declines when the bar would be too fine', () => {
    let represented = 0;
    let declined = 0;
    for (const seed of SEEDS) {
      const question = make('fractions-y6', 3, seed);
      const model = fractionBarsFor(question);
      if (!model) { declined++; continue; }
      represented++;
      const total = combinedPart(model, model.matchingSplits)!;
      expect(total.numerator / total.denominator).toBeCloseTo(parseNumber(question.answer)!, 10);
    }
    expect(represented).toBeGreaterThan(0);
    expect(declined).toBeGreaterThan(0); // 5ths and 6ths need 30 pieces, so the static fallback is used
  });

  it('handles same-denominator addition from the Year 4-5 fractions skill', () => {
    for (const seed of SEEDS) {
      const question = make('fractions', 5, seed);
      const model = fractionBarsFor(question)!;
      expect(model.matchingSplits).toEqual([1, 1]);
      const total = combinedPart(model, [1, 1])!;
      expect(total.numerator / total.denominator).toBeCloseTo(parseNumber(question.answer)!, 10);
    }
  });

  it('refuses to combine bars whose pieces are not the same size', () => {
    const model = fractionBarsFor(make('fractions-y6', 2, 7))!;
    const unmatched = model.matchingSplits[0] === 1 && model.matchingSplits[1] === 1 ? [2, 1] as const : [1, 1] as const;
    expect(combinedPart(model, unmatched)).toBeNull();
  });

  it('falls back (null) for questions it cannot show exactly', () => {
    const base = make('fractions-y6', 2, 1);
    for (const prompt of [
      'What is half of 10?',
      '2 1/3 + 1 1/2 = ?',
      '1/2 × 1/3 = ?  Give your answer in its simplest form.',
      'Write 6/8 in its simplest form.',
      'Which fraction is bigger?',
      '1/2 + 1/3 = 5/6',
    ]) {
      expect(fractionBarsFor({ ...base, prompt }), prompt).toBeNull();
    }
    expect(fractionBarsFor({ ...base, skillId: 'coordinates' })).toBeNull();
  });

  it('describes bars in plain words for screen readers', () => {
    expect(describeBar({ numerator: 1, denominator: 2 }, 1)).toBe('1 out of 2 equal pieces shaded (1/2)');
    expect(describeBar({ numerator: 1, denominator: 2 }, 2)).toBe(
      '2 out of 4 equal pieces shaded (2/4, the same amount as 1/2)',
    );
  });
});

describe('fractions-y6 addition: observable "tops and bottoms" mistake', () => {
  const additions = (level: 2 | 3) =>
    SEEDS.map((seed) => make('fractions-y6', level, seed)).filter((q) => q.prompt.includes(' + '));

  it('lists the add-across answer as a catalogued mistake that differs from the correct answer', () => {
    for (const level of [2, 3] as const) {
      const questions = additions(level);
      expect(questions.length).toBeGreaterThan(50);
      let withBug = 0;
      for (const question of questions) {
        const bug = question.bugs?.find(([id]) => id === 'frac-add-across');
        if (!bug) continue;
        withBug++;
        expect(checkAnswer(question, bug[1]), question.prompt).toBe(false);
        expect(diagnose(question, bug[1], false)).toBe('frac-add-across');
      }
      expect(withBug / questions.length).toBeGreaterThan(0.9);
    }
  });

  it('never attaches the mistake to subtraction, and never to a case where it is actually correct', () => {
    for (const seed of SEEDS) {
      const question = make('fractions-y6', 3, seed);
      if (question.prompt.includes('−')) expect(question.bugs ?? []).toEqual([]);
      for (const [, wrong] of question.bugs ?? []) expect(checkAnswer(question, wrong)).toBe(false);
    }
  });

  it('leaves the correct answer and explanation of existing questions untouched', () => {
    const question = make('fractions-y6', 2, 11);
    const [, a, d1, b, d2] = question.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)/)!.map(Number) as number[];
    const m = d2 / d1;
    const top = a * m + b;
    expect(parseNumber(question.answer)).toBeCloseTo(top / d2, 10);
    expect(question.explanation).toContain(`${top}/${d2}`);
  });
});
