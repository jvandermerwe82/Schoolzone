import { describe, expect, it } from 'vitest';
import { LEVELS, type Question } from '../brain/types';
import { englishQuestions, englishSkillIds } from './english';
import { MATHS_GENERATORS } from './maths';
import { MATHS_Y6_GENERATORS } from './maths-y6';
import { scienceQuestions, scienceSkillIds } from './science';
import { SKILLS } from './skills';
import { skillTip } from './hints';
import { hintLadder, stepHint, topicNotes, wordsIn } from './solver';

function seeded(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Independent check: does the text contain the answer as a standalone value or word? */
function containsAnswer(text: string, answer: string): boolean {
  const t = text.replace(/−/g, '-').toLowerCase();
  const a = answer.replace(/%$/, '').toLowerCase();
  if (/^-?[\d.]/.test(a)) return t.split(/[^\d./-]+/).some((tok) => tok.replace(/[.]$/, '') === a);
  return t.includes(a);
}

const allQuestions = (): Question[] => {
  const rng = seeded(99);
  const qs: Question[] = [];
  for (const gen of Object.values({ ...MATHS_GENERATORS, ...MATHS_Y6_GENERATORS })) {
    for (const level of LEVELS) for (let i = 0; i < 150; i++) qs.push(gen(level, rng));
  }
  return [...qs, ...englishSkillIds().flatMap(englishQuestions), ...scienceSkillIds().flatMap(scienceQuestions)];
};

describe('Problem Solver', () => {
  it('every skill has topic notes and a strategy tip', () => {
    for (const s of SKILLS) {
      expect(topicNotes(s.id).length, s.id).toBeGreaterThan(0);
      expect(skillTip(s.id)).not.toMatch(/Read the question carefully/);
    }
  });

  it('no hint ever gives the answer away', () => {
    const rng = seeded(1);
    let steps = 0, mathsSteps = 0, maths = 0;
    for (const q of allQuestions()) {
      const isMaths = SKILLS.find((s) => s.id === q.skillId)!.subject === 'maths';
      if (isMaths) maths++;
      for (const h of hintLadder(q, rng)) {
        if (h.kind === 'remove') expect(h.choice).not.toBe(q.answer);
        // The skill tip is the same general text for every question, so only
        // the question-specific step could leak an answer.
        if (h.kind === 'step') expect(containsAnswer(h.text, q.answer), `${q.prompt} → ${h.text}`).toBe(false);
        if (h.kind === 'step') { steps++; if (isMaths) mathsSteps++; }
      }
    }
    // Question-specific first steps exist for most maths questions.
    expect(mathsSteps / maths).toBeGreaterThan(0.5);
    expect(steps).toBeGreaterThan(0);
  });

  it('gives a first step for a sum without the answer', () => {
    const q: Question = { skillId: 'addition', level: 4, id: 'x', prompt: '47 + 38 = ?', answer: '85',
      explanation: 'Add the ones first: 7 + 8 = 15. That makes 15, so write 5 and carry 1. Then add the rest: 47 + 38 = 85.' };
    expect(stepHint(q)).toBe('Add the ones first: 7 + 8 = 15. That makes 15, so write 5 and carry 1.');
  });

  it('explains words with the meaning that fits the subject', () => {
    const shadow = scienceQuestions('light-y6').find((q) => q.prompt.includes('shape as the object'))!;
    expect(wordsIn(shadow).map((w) => w.term)).not.toContain('Object');
    const plantCell = scienceQuestions('living-things').find((q) => q.prompt.includes('plant cell'))!;
    expect(wordsIn(plantCell).map((w) => w.term)).not.toContain('Cell (in electricity)');
    const bulbs = scienceQuestions('electricity-y6').find((q) => q.prompt.includes('another cell'))!;
    expect(wordsIn(bulbs).map((w) => w.term)).toContain('Cell (in electricity)');
    const semi = englishQuestions('punctuation-y6').find((q) => q.prompt.includes('uses a semi-colon correctly'))!;
    const terms = wordsIn(semi).map((w) => w.term);
    expect(terms).toContain('Semi-colon (;)');
    expect(terms).not.toContain('Colon (:)');
    const hcf = MATHS_Y6_GENERATORS['factors-primes'](3, seeded(2));
    expect(wordsIn(hcf).map((w) => w.term)).toContain('Highest common factor (HCF)');
  });
});
