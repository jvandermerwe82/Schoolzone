import { describe, expect, it } from 'vitest';
import { LEVELS, type Level, type Question } from '../brain/types';
import { checkAnswer, parseNumber } from '.';
import { englishQuestions, englishSkillIds, SPELLING_WORDS } from './english';
import { gcd } from './maths';
import { decimal, MATHS_Y6_GENERATORS, mixed } from './maths-y6';
import { scienceQuestions } from './science';
import { SKILLS, getSkill } from './skills';

function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (s: string) => Number(s.replace('−', '-'));
const isPrime = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);
const countFactors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0).length;
/** "2 1/3", "3/4" or "7" → number (written independently of the app's parser). */
const frac = (s: string) => {
  const [w, f] = s.includes(' ') ? s.split(' ') : s.includes('/') ? ['0', s] : [s, '0/1'];
  const [n, d] = f.split('/').map(Number);
  return Number(w) + n / d;
};
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * Recomputes the answer from the question text alone. Returns null when the
 * prompt is not recognised, which fails the test so no question goes unchecked.
 */
function independentAnswer(q: Question): number | null {
  const p = q.prompt;
  let m: RegExpMatchArray | null;
  // negative numbers
  if ((m = p.match(/^What is (−?\d+) ([+−]) (\d+)\?$/))) return m[2] === '+' ? num(m[1]) + num(m[3]) : num(m[1]) - num(m[3]);
  if ((m = p.match(/temperature is (−?\d+) °C\. It rises by (\d+) °C/))) return num(m[1]) + num(m[2]);
  if ((m = p.match(/difference between (−?\d+) °C and (−?\d+) °C/))) return Math.abs(num(m[2]) - num(m[1]));
  if ((m = p.match(/submarine is at (−?\d+) m .* rises (\d+) m/))) return num(m[1]) + num(m[2]);
  if ((m = p.match(/freezer is at (−?\d+) °C and the kitchen is (\d+) °C/))) return num(m[2]) - num(m[1]);
  // factors, multiples, primes
  if ((m = p.match(/next prime number after (\d+)/))) { let x = num(m[1]) + 1; while (!isPrime(x)) x++; return x; }
  if ((m = p.match(/How many factors does (\d+) have/))) return countFactors(num(m[1]));
  if ((m = p.match(/highest common factor \(HCF\) of (\d+) and (\d+)/))) {
    const [a, b] = [num(m[1]), num(m[2])];
    for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d;
  }
  if ((m = p.match(/lowest common multiple \(LCM\) of (\d+) and (\d+)/))) {
    const [a, b] = [num(m[1]), num(m[2])];
    for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x;
  }
  // order of operations / long multiplication and division: evaluate the expression
  if ((m = p.match(/^([\d\s()+−×÷]+) = \?$/))) {
    return Function(`return (${m[1].replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')})`)() as number;
  }
  // fractions
  if ((m = p.match(/^Write (\d+)\/(\d+) in its simplest form\.$/))) return num(m[1]) / num(m[2]);
  if ((m = p.match(/^((?:\d+ )?\d+\/\d+) ([+−×]) ((?:\d+ )?\d+\/\d+) = \?/))) {
    const [a, b] = [frac(m[1]), frac(m[3])];
    return m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b;
  }
  if ((m = p.match(/^(\d+)\/(\d+) ÷ (\d+) = \?$/))) return num(m[1]) / num(m[2]) / num(m[3]);
  // decimals and percentages
  if ((m = p.match(/^Write (\d+)\/(\d+) as a decimal\.$/))) return num(m[1]) / num(m[2]);
  if ((m = p.match(/^Write (\d+)\/(\d+) as a percentage\.$/))) return (100 * num(m[1])) / num(m[2]);
  if ((m = p.match(/^([\d.]+) ([×÷]) (\d+) = \?$/))) return m[2] === '×' ? num(m[1]) * num(m[3]) : num(m[1]) / num(m[3]);
  if ((m = p.match(/^What is (\d+)% of (\d+)\?$/))) return (num(m[1]) * num(m[2])) / 100;
  // algebra
  if ((m = p.match(/^n \+ (\d+) = (\d+)\. What is n\?$/))) return num(m[2]) - num(m[1]);
  if ((m = p.match(/^n − (\d+) = (\d+)\. What is n\?$/))) return num(m[2]) + num(m[1]);
  if ((m = p.match(/^(\d+)n = (\d+)\. What is n\?$/))) return num(m[2]) / num(m[1]);
  if ((m = p.match(/^(\d+)n \+ (\d+) = (\d+)\. What is n\?$/))) return (num(m[3]) - num(m[2])) / num(m[1]);
  if ((m = p.match(/^(\d+)n − (\d+) = (\d+)\. What is n\?$/))) return (num(m[3]) + num(m[2])) / num(m[1]);
  if ((m = p.match(/P = 4s\. What is P when s = (\d+)\?/))) return 4 * num(m[1]);
  if ((m = p.match(/C = (\d+)n \+ (\d+) pounds .* n = (\d+)\?/))) return num(m[1]) * num(m[3]) + num(m[2]);
  if ((m = p.match(/starts at (\d+) and goes up by (\d+) each time\. What is the 10th term/))) {
    let t = num(m[1]); for (let i = 1; i < 10; i++) t += num(m[2]); return t;
  }
  if ((m = p.match(/sequence goes (\d+), (\d+), (\d+), (\d+), … What is the 20th term/))) {
    const d = num(m[2]) - num(m[1]);
    expect(num(m[3]) - num(m[2])).toBe(d);
    let t = num(m[1]); for (let i = 1; i < 20; i++) t += d; return t;
  }
  // geometry and statistics
  if ((m = p.match(/straight line\. One is (\d+)°/))) return 180 - num(m[1]);
  if ((m = p.match(/triangle has angles of (\d+)° and (\d+)°/))) return 180 - num(m[1]) - num(m[2]);
  if ((m = p.match(/radius of (\d+) cm\. What is its diameter/))) return 2 * num(m[1]);
  if ((m = p.match(/triangle has a base of (\d+) cm and a perpendicular height of (\d+) cm/))) return (num(m[1]) * num(m[2])) / 2;
  if ((m = p.match(/parallelogram has a base of (\d+) cm and a perpendicular height of (\d+) cm/))) return num(m[1]) * num(m[2]);
  if ((m = p.match(/^What is the mean of ([\d, ]+)\?$/))) {
    const xs = m[1].split(', ').map(Number);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  if ((m = p.match(/regular \w+ \((\d+) sides\)/))) { const n = num(m[1]); return ((n - 2) * 180) / n; }
  if ((m = p.match(/quadrilateral has angles of (\d+)°, (\d+)° and (\d+)°/))) return 360 - num(m[1]) - num(m[2]) - num(m[3]);
  return null;
}

describe('Year 6 maths generators', () => {
  it('every answer matches an independent calculation from the question text', () => {
    const rng = seeded(2026);
    let checked = 0;
    for (const [skillId, gen] of Object.entries(MATHS_Y6_GENERATORS)) {
      expect(getSkill(skillId).typicalYear).toBe(6);
      for (const level of LEVELS) {
        for (let i = 0; i < 400; i++) {
          const q = gen(level, rng);
          expect(q.skillId).toBe(skillId);
          expect(checkAnswer(q, q.answer)).toBe(true);
          const expected = independentAnswer(q);
          if (expected === null) throw new Error(`Unrecognised prompt: ${q.prompt}`);
          const got = parseNumber(q.answer);
          if (got === null || !close(got, expected)) {
            throw new Error(`${q.prompt} → app says ${q.answer}, independent check says ${expected}`);
          }
          checked++;
        }
      }
    }
    expect(checked).toBe(8 * 5 * 400);
  });

  it('keeps answers to sensible Year 6 sizes', () => {
    const rng = seeded(11);
    for (let i = 0; i < 500; i++) {
      const lm = MATHS_Y6_GENERATORS['long-multiplication-division'](5, rng);
      const [a, b] = lm.prompt.match(/\d+/g)!.map(Number);
      expect(Math.max(a, b)).toBeLessThanOrEqual(9999); // "up to 4 digits"
      const dp = MATHS_Y6_GENERATORS['decimals-percentages'](2, rng);
      expect((dp.answer.split('.')[1] ?? '').length).toBeLessThanOrEqual(3); // "up to three decimal places"
      const div = MATHS_Y6_GENERATORS['long-multiplication-division'](4, rng);
      if (div.prompt.includes('÷')) expect(Number.isInteger(Number(div.answer))).toBe(true);
    }
  });

  it('"simplest form" questions insist on the simplest form', () => {
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) {
      const q = MATHS_Y6_GENERATORS['fractions-y6'](1, rng);
      expect(q.exact).toBe(true);
      const [n, d] = q.answer.split('/').map(Number);
      expect(gcd(n, d)).toBe(1);
      const [bn, bd] = q.prompt.match(/(\d+)\/(\d+)/)!.slice(1).map(Number);
      expect(checkAnswer(q, `${bn}/${bd}`)).toBe(false); // the unsimplified fraction is not accepted
    }
  });

  it('formats decimals and mixed numbers exactly', () => {
    expect(decimal(375, 3)).toBe('0.375');
    expect(decimal(4700, 3)).toBe('4.7');
    expect(decimal(47, -2)).toBe('4700');
    expect(decimal(36, 3)).toBe('0.036');
    expect(mixed(7, 4)).toBe('1 3/4');
    expect(mixed(6, 8)).toBe('3/4');
    expect(mixed(8, 4)).toBe('2');
  });
});

describe('answer checking', () => {
  const q = (answer: string, extra: Partial<Question> = {}): Question =>
    ({ skillId: 'x', level: 1 as Level, id: 'x', prompt: '', answer, explanation: '', ...extra });

  it('accepts equal values written differently', () => {
    expect(checkAnswer(q('3 5/6'), '23/6')).toBe(true);
    expect(checkAnswer(q('3 5/6'), '3 5 / 6')).toBe(true);
    expect(checkAnswer(q('-5'), '−5')).toBe(true);
    expect(checkAnswer(q('0.375'), '.375')).toBe(true);
    expect(checkAnswer(q('115'), '115°')).toBe(true);
    expect(checkAnswer(q('25%'), '25')).toBe(true);
    expect(checkAnswer(q('9342'), '9,342')).toBe(true);
    expect(checkAnswer(q('54'), '54 cm²')).toBe(true);
  });

  it('rejects wrong or ambiguous input', () => {
    expect(checkAnswer(q('0.5'), '0,5')).toBe(false); // decimal comma is not read as 5 or 0.5
    expect(checkAnswer(q('5'), '-5')).toBe(false);
    expect(checkAnswer(q('3 5/6'), '35/6')).toBe(false);
    expect(checkAnswer(q('2/3', { exact: true }), '4/6')).toBe(false);
    expect(checkAnswer(q('2/3', { exact: true }), '2 / 3')).toBe(true);
    expect(checkAnswer(q('receive', { choices: ['receive', 'recieve'] }), 'recieve')).toBe(false);
  });
});

/** The Years 5 and 6 statutory word list (English Appendix 1). */
const STATUTORY = `accommodate accompany according achieve aggressive amateur ancient apparent appreciate attached
available average awkward bargain bruise category cemetery committee communicate community competition conscience
conscious controversy convenience correspond criticise curiosity definite desperate determined develop dictionary
disastrous embarrass environment equipped equipment especially exaggerate excellent existence explanation familiar
foreign forty frequently government guarantee harass hindrance identity immediately individual interfere interrupt
language leisure lightning marvellous mischievous muscle necessary neighbour nuisance occupy occur opportunity
parliament persuade physical prejudice privilege profession programme pronunciation queue recognise recommend relevant
restaurant rhyme rhythm sacrifice secretary shoulder signature sincerely soldier stomach sufficient suggest symbol
system temperature thorough twelfth variety vegetable vehicle yacht`.split(/\s+/);

describe('English', () => {
  it('covers the whole Years 5 and 6 statutory word list', () => {
    const words = SPELLING_WORDS.map((r) => r[1]);
    // 100 entries in the official list; "equip(-ped, -ment)" appears here as two words.
    expect(STATUTORY.length).toBe(101);
    expect(new Set(words)).toEqual(new Set(STATUTORY));
    expect(words.length).toBe(new Set(words).size);
  });

  it('never offers a correct spelling as a wrong choice', () => {
    const correct = new Set(STATUTORY);
    for (const [, word, wrong] of SPELLING_WORDS) {
      for (const w of wrong) {
        expect(w).not.toBe(word);
        expect(correct.has(w)).toBe(false);
      }
    }
  });

  it('every English and Year 6 science skill has questions at every level', () => {
    const ids = [...englishSkillIds(), 'classification', 'circulatory-system', 'evolution-inheritance', 'light-y6', 'electricity-y6'];
    for (const id of ids) {
      const skill = getSkill(id);
      const qs = skill.subject === 'english' ? englishQuestions(id) : scienceQuestions(id);
      for (const level of LEVELS) expect(qs.some((q) => q.level === level), `${id} level ${level}`).toBe(true);
      for (const q of qs) {
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size, q.prompt).toBe(q.choices!.length);
        expect(checkAnswer(q, q.answer)).toBe(true);
        for (const c of q.choices!) if (c !== q.answer) expect(checkAnswer(q, c)).toBe(false);
      }
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    }
  });

  it('skill prerequisites point at real skills in the same subject', () => {
    for (const s of SKILLS) for (const p of s.prerequisites) expect(getSkill(p).subject).toBe(s.subject);
  });
});
