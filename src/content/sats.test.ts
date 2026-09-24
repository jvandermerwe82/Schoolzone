import { describe, expect, it } from 'vitest';
import type { SatsResult } from '../brain/types';
import { newProfile } from '../storage';
import { checkAnswer } from '.';
import { PASSAGES } from './reading';
import {
  ARITHMETIC_LENGTH, arithmeticPaper, DICTATION, gapped, markSpelling, nextPassage, readingPaper,
  SPELLING_TEST_LENGTH, spellingTest, wordsToLearn,
} from './sats';
import { SPELLING_WORDS } from './english';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('SATs spelling test', () => {
  it('has all 100 words of the Year 5 and 6 statutory list, each in its own sentence', () => {
    expect(DICTATION).toHaveLength(100);
    expect(new Set(DICTATION.map(([w]) => w)).size).toBe(100);
    for (const [word, sentence] of DICTATION) {
      expect(sentence.toLowerCase(), word).toContain(word);
      expect(gapped(word, sentence)).not.toMatch(new RegExp(word, 'i'));
      expect(gapped(word, sentence)).toContain('________');
    }
  });

  it('matches the words already used in practice', () => {
    // The practice bank uses the same statutory list (base forms).
    const list = new Set(DICTATION.map(([w]) => w));
    for (const [, word] of SPELLING_WORDS) expect(list.has(word) || ['equip', 'immediate', 'sincere'].some((b) => word.startsWith(b)), word).toBe(true);
  });

  it('marks exactly, ignoring capitals and spaces, with a note for American spellings', () => {
    expect(markSpelling('rhythm', ' Rhythm ')).toEqual({ correct: true });
    expect(markSpelling('rhythm', 'rythm').correct).toBe(false);
    expect(markSpelling('recognise', 'recognize')).toMatchObject({ correct: false, note: expect.stringContaining('British') });
  });

  it('puts words the child got wrong first, then new words', () => {
    let p = newProfile('Ava', '🦊', 6);
    const first = spellingTest(p, seeded());
    expect(first).toHaveLength(SPELLING_TEST_LENGTH);
    const result: SatsResult = {
      kind: 'spelling', at: 1, timeMs: 1000,
      items: first.map(([w], i) => ({ id: w, correct: i >= 2, given: i >= 2 ? w : 'x' })),
    };
    p = { ...p, sats: [result] };
    expect(wordsToLearn(p).sort()).toEqual([first[0][0], first[1][0]].sort());
    const next = spellingTest(p, seeded(2)).map(([w]) => w);
    expect(next.slice(0, 2).sort()).toEqual([first[0][0], first[1][0]].sort());
    const right = new Set(first.slice(2).map(([w]) => w));
    expect(next.slice(2).some((w) => right.has(w))).toBe(false); // new words before ones already right
  });
});

describe('SATs arithmetic and reading papers', () => {
  it('builds an arithmetic paper of typed questions, easier first, whose answers mark as right', () => {
    const paper = arithmeticPaper(seeded(3));
    expect(paper).toHaveLength(ARITHMETIC_LENGTH);
    expect(new Set(paper.map((q) => q.id)).size).toBe(ARITHMETIC_LENGTH);
    for (let i = 1; i < paper.length; i++) expect(paper[i].level).toBeGreaterThanOrEqual(paper[i - 1].level);
    for (const q of paper) expect(checkAnswer(q, q.answer)).toBe(true);
  });

  it('shuffles the choices on reading papers, so the answer isn\'t always in the same place', () => {
    const places = PASSAGES.flatMap((p) => readingPaper(p.id, seeded(7)).map((q) => q.choices!.indexOf(q.answer)));
    expect(new Set(places).size).toBe(4);
    for (const p of PASSAGES) for (const q of readingPaper(p.id)) expect(q.choices).toContain(q.answer);
  });

  it('reading papers give every text in turn', () => {
    let p = newProfile('Ava', '🦊', 6);
    const seen: string[] = [];
    for (let i = 0; i < PASSAGES.length; i++) {
      const id = nextPassage(p);
      seen.push(id);
      expect(readingPaper(id).length).toBeGreaterThanOrEqual(8);
      p = { ...p, sats: [...p.sats, { kind: 'reading', at: i, timeMs: 1, passageId: id, items: [] }] };
    }
    expect(new Set(seen).size).toBe(PASSAGES.length);
  });
});
