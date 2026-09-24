import { describe, expect, it } from 'vitest';
import { getMisconception } from '../brain/misconceptions';
import { makeQuestion } from '.';
import { checkpointQuestions } from './checkpoint';
import { DOMAIN_NAMES, getPassage, PASSAGES, readingQuestions } from './reading';

describe('reading comprehension', () => {
  const all = readingQuestions();

  it('every question has four different choices, one right answer, and a passage', () => {
    expect(all.length).toBeGreaterThanOrEqual(40);
    for (const q of all) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices!.filter((c) => c === q.answer)).toHaveLength(1);
      expect(getPassage(q.passageId!)).toBeDefined();
      expect(Object.keys(DOMAIN_NAMES)).toContain(q.domain);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it('mistake tags point at real wrong choices and known mistake patterns', () => {
    for (const q of all) {
      for (const [id, wrong] of q.bugs ?? []) {
        expect(q.choices).toContain(wrong);
        expect(wrong).not.toBe(q.answer);
        expect(getMisconception(id)).toBeDefined();
      }
    }
  });

  it('covers every level and the main reading skills, in every kind of text', () => {
    expect(new Set(all.map((q) => q.level))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const d of ['2a', '2b', '2c', '2d', '2e', '2f', '2g', '2h']) expect(all.some((q) => q.domain === d)).toBe(true);
    expect(new Set(PASSAGES.map((p) => p.kind))).toEqual(new Set(['Story', 'Information', 'Poem', 'Letter']));
  });

  it('retrieval questions quote the text', () => {
    // Level-1 "find it" answers should be checkable against the passage.
    const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 3);
    for (const p of PASSAGES) {
      for (const [level, domain, , answer] of p.questions) {
        if (level !== 1 || domain !== '2b') continue;
        const text = p.text.toLowerCase();
        const found = words(answer).filter((w) => text.includes(w));
        expect(found.length, `${p.id}: ${answer}`).toBeGreaterThanOrEqual(Math.min(1, words(answer).length));
      }
    }
  });

  it('is part of practice and of the English checkpoints (different questions on forms A and B)', () => {
    const q = makeQuestion('reading-y6', 3, [], Math.random);
    expect(q.passageId).toBeDefined();
    const a = checkpointQuestions('english', 'A').filter((x) => x.skillId === 'reading-y6');
    const b = checkpointQuestions('english', 'B').filter((x) => x.skillId === 'reading-y6');
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a.map((x) => x.id)).not.toEqual(b.map((x) => x.id));
  });
});
