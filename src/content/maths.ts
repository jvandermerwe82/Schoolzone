/**
 * Maths questions are generated, not stored, so a child never runs out of
 * practice and every answer is computed (never typed in by hand).
 */
import type { Level, Question } from '../brain/types';

export type Rng = () => number;

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

function q(
  skillId: string,
  level: Level,
  prompt: string,
  answer: number | string,
  explanation: string,
  choices?: string[],
): Question {
  return { skillId, level, id: `${skillId}:${prompt}`, prompt, answer: String(answer), explanation, choices };
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function simplify(n: number, d: number): string {
  const g = gcd(n, d);
  const [sn, sd] = [n / g, d / g];
  return sd === 1 ? String(sn) : `${sn}/${sd}`;
}

function numberSense(level: Level, rng: Rng): Question {
  const id = 'number-sense';
  switch (level) {
    case 1: {
      const n = int(rng, 1, 9);
      return q(id, level, `What number comes after ${n}?`, n + 1, `Counting up: ${n}, ${n + 1}.`);
    }
    case 2: {
      const n = int(rng, 11, 20);
      return rng() < 0.5
        ? q(id, level, `What number comes after ${n}?`, n + 1, `Counting up: ${n}, ${n + 1}.`)
        : q(id, level, `What number comes before ${n}?`, n - 1, `Counting down: ${n}, ${n - 1}.`);
    }
    case 3: {
      const a = int(rng, 10, 99);
      let b = int(rng, 10, 99);
      while (b === a) b = int(rng, 10, 99);
      const big = Math.max(a, b);
      return q(id, level, `Which number is bigger?`, big,
        `${big} is bigger. Compare the tens first, then the ones.`, [String(a), String(b)]);
    }
    case 4: {
      const step = pick(rng, [2, 5, 10]);
      const start = step * int(rng, 0, 5);
      const seq = [0, 1, 2].map((i) => start + i * step);
      return q(id, level, `Count by ${step}s: ${seq.join(', ')}, __`, start + 3 * step,
        `Each number is ${step} more than the one before: ${seq[2]} + ${step} = ${start + 3 * step}.`);
    }
    case 5: {
      const step = pick(rng, [3, 4, 6]);
      const start = step * int(rng, 5, 10) + int(rng, 0, 2);
      const seq = [0, 1, 2].map((i) => start - i * step);
      return q(id, level, `Count back by ${step}s: ${seq.join(', ')}, __`, start - 3 * step,
        `Each number is ${step} less than the one before: ${seq[2]} − ${step} = ${start - 3 * step}.`);
    }
  }
}

function addition(level: Level, rng: Rng): Question {
  const id = 'addition';
  let a: number, b: number;
  switch (level) {
    case 1: a = int(rng, 1, 9); b = int(rng, 1, 10 - a); break;
    case 2: a = int(rng, 2, 9); b = int(rng, 11 - a, 9); break; // crosses 10
    case 3: { // two digits, no carrying
      const ao = int(rng, 0, 8), bo = int(rng, 0, 9 - ao);
      const at = int(rng, 1, 8), bt = int(rng, 1, 9 - at);
      a = at * 10 + ao; b = bt * 10 + bo; break;
    }
    case 4: { // two digits, carrying in the ones
      const ao = int(rng, 2, 9), bo = int(rng, 10 - ao, 9);
      const at = int(rng, 1, 7), bt = int(rng, 1, 8 - at);
      a = at * 10 + ao; b = bt * 10 + bo; break;
    }
    case 5: a = int(rng, 100, 899); b = int(rng, 100, 999 - a); break;
  }
  return q(id, level, `${a} + ${b} = ?`, a + b, additionExplanation(a, b));
}

function additionExplanation(a: number, b: number): string {
  if (a < 10 && b < 10) return `Start at ${a} and count on ${b}: ${a + b}.`;
  const onesSum = (a % 10) + (b % 10);
  const carry = onesSum >= 10 ? ` That makes ${onesSum}, so write ${onesSum % 10} and carry 1.` : '';
  return `Add the ones first: ${a % 10} + ${b % 10} = ${onesSum}.${carry} Then add the rest: ${a} + ${b} = ${a + b}.`;
}

function subtraction(level: Level, rng: Rng): Question {
  const id = 'subtraction';
  let a: number, b: number;
  switch (level) {
    case 1: a = int(rng, 2, 10); b = int(rng, 1, a); break;
    case 2: a = int(rng, 11, 18); b = int(rng, a - 9, 9); break; // crosses 10
    case 3: { // two digits, no borrowing
      const at = int(rng, 2, 9), ao = int(rng, 1, 9);
      const bt = int(rng, 1, at), bo = int(rng, 0, ao);
      a = at * 10 + ao; b = bt * 10 + bo;
      if (a === b) b -= 1;
      break;
    }
    case 4: { // two digits, borrowing
      const at = int(rng, 3, 9), ao = int(rng, 0, 8);
      const bt = int(rng, 1, at - 1), bo = int(rng, ao + 1, 9);
      a = at * 10 + ao; b = bt * 10 + bo; break;
    }
    case 5: a = int(rng, 300, 999); b = int(rng, 101, a - 100); break;
  }
  const expl = a <= 20
    ? `Start at ${a} and count back ${b}: ${a - b}. Check: ${a - b} + ${b} = ${a}.`
    : `${a} − ${b} = ${a - b}. Check by adding back: ${a - b} + ${b} = ${a}.`;
  return q(id, level, `${a} − ${b} = ?`, a - b, expl);
}

function placeValue(level: Level, rng: Rng): Question {
  const id = 'place-value';
  switch (level) {
    case 1: {
      const n = int(rng, 11, 99);
      return q(id, level, `What digit is in the tens place of ${n}?`, Math.floor(n / 10),
        `${n} is ${Math.floor(n / 10)} tens and ${n % 10} ones.`);
    }
    case 2: {
      const n = int(rng, 101, 999);
      return q(id, level, `What digit is in the hundreds place of ${n}?`, Math.floor(n / 100),
        `${n} is ${Math.floor(n / 100)} hundreds, ${Math.floor(n / 10) % 10} tens and ${n % 10} ones.`);
    }
    case 3: {
      const n = int(rng, 11, 99);
      const r = Math.round(n / 10) * 10; // halves round up for positive numbers
      return q(id, level, `Round ${n} to the nearest 10.`, r,
        `Look at the ones digit (${n % 10}). 5 or more rounds up, 4 or less rounds down, so ${n} → ${r}.`);
    }
    case 4: {
      const n = int(rng, 101, 949);
      const r = Math.round(n / 100) * 100;
      return q(id, level, `Round ${n} to the nearest 100.`, r,
        `Look at the tens digit (${Math.floor(n / 10) % 10}). 5 or more rounds up, 4 or less rounds down, so ${n} → ${r}.`);
    }
    case 5: {
      // Four distinct digits so "the digit X" is unambiguous.
      const digits: number[] = [int(rng, 1, 9)];
      while (digits.length < 4) {
        const d = int(rng, 0, 9);
        if (!digits.includes(d)) digits.push(d);
      }
      const n = Number(digits.join(''));
      const pos = int(rng, 0, 2); // skip the ones place (value = digit, too easy)
      let digit = digits[pos];
      if (digit === 0) digit = digits[0];
      const idx = digits.indexOf(digit);
      const value = digit * 10 ** (3 - idx);
      const place = ['thousands', 'hundreds', 'tens', 'ones'][idx];
      return q(id, level, `What is the value of the digit ${digit} in ${n.toLocaleString('en')}?`, value,
        `The ${digit} is in the ${place} place, so it is worth ${value.toLocaleString('en')}.`);
    }
  }
}

function multiplication(level: Level, rng: Rng): Question {
  const id = 'multiplication';
  let a: number, b: number;
  switch (level) {
    case 1: a = pick(rng, [2, 5, 10]); b = int(rng, 1, 10); break;
    case 2: a = pick(rng, [3, 4]); b = int(rng, 1, 10); break;
    case 3: a = int(rng, 2, 10); b = int(rng, 2, 10); break;
    case 4: a = int(rng, 6, 12); b = int(rng, 6, 12); break;
    case 5: a = int(rng, 11, 99); b = int(rng, 2, 9); break;
  }
  const expl = a > 12
    ? `Split it up: ${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b}, and ${a % 10} × ${b} = ${(a % 10) * b}. Together: ${a * b}.`
    : `${a} × ${b} means ${b} groups of ${a}, which is ${a * b}.`;
  return q(id, level, `${a} × ${b} = ?`, a * b, expl);
}

function division(level: Level, rng: Rng): Question {
  const id = 'division';
  let d: number, quotient: number;
  switch (level) {
    case 1: d = pick(rng, [2, 5, 10]); quotient = int(rng, 1, 10); break;
    case 2: d = pick(rng, [3, 4]); quotient = int(rng, 1, 10); break;
    case 3: d = int(rng, 2, 10); quotient = int(rng, 2, 10); break;
    case 4: d = int(rng, 6, 12); quotient = int(rng, 6, 12); break;
    case 5: d = int(rng, 2, 9); quotient = int(rng, 11, 30); break;
  }
  const n = d * quotient;
  return q(id, level, `${n} ÷ ${d} = ?`, quotient,
    `Think: what times ${d} makes ${n}? ${quotient} × ${d} = ${n}, so the answer is ${quotient}.`);
}

function fractions(level: Level, rng: Rng): Question {
  const id = 'fractions';
  switch (level) {
    case 1: {
      const n = 2 * int(rng, 1, 10);
      return q(id, level, `What is half of ${n}?`, n / 2, `Half means split into 2 equal parts: ${n} ÷ 2 = ${n / 2}.`);
    }
    case 2: {
      const d = pick(rng, [3, 4]);
      const n = d * int(rng, 1, 10);
      return q(id, level, `What is 1/${d} of ${n}?`, n / d, `1/${d} means split into ${d} equal parts: ${n} ÷ ${d} = ${n / d}.`);
    }
    case 3: {
      const d = pick(rng, [3, 4, 5, 6, 8]);
      const num = int(rng, 2, d - 1);
      const n = d * int(rng, 2, 6);
      return q(id, level, `What is ${num}/${d} of ${n}?`, (n / d) * num,
        `First find 1/${d}: ${n} ÷ ${d} = ${n / d}. Then take ${num} of those parts: ${n / d} × ${num} = ${(n / d) * num}.`);
    }
    case 4: {
      if (rng() < 0.5) {
        const d = pick(rng, [5, 6, 7, 8, 9, 10]);
        const a = int(rng, 1, d - 1);
        let b = int(rng, 1, d - 1);
        while (b === a) b = int(rng, 1, d - 1);
        const big = `${Math.max(a, b)}/${d}`;
        return q(id, level, `Which fraction is bigger?`, big,
          `Both are split into ${d} parts, so the one with more parts (${big}) is bigger.`, [`${a}/${d}`, `${b}/${d}`]);
      }
      const a = int(rng, 2, 6);
      let b = int(rng, 2, 10);
      while (b === a) b = int(rng, 2, 10);
      const big = `1/${Math.min(a, b)}`;
      return q(id, level, `Which fraction is bigger?`, big,
        `With 1 part each, fewer pieces means bigger pieces, so ${big} is bigger.`, [`1/${a}`, `1/${b}`]);
    }
    case 5: {
      const d = pick(rng, [4, 5, 6, 7, 8, 9, 10, 12]);
      const a = int(rng, 1, d - 2);
      const b = int(rng, 1, d - 1 - a);
      const sum = simplify(a + b, d);
      const tail = sum === `${a + b}/${d}` ? '' : ` That simplifies to ${sum}.`;
      return q(id, level, `${a}/${d} + ${b}/${d} = ?  (write it like 3/4)`, sum,
        `The bottoms match, so add the tops: ${a} + ${b} = ${a + b}, giving ${a + b}/${d}.${tail}`);
    }
  }
}

export const MATHS_GENERATORS: Record<string, (level: Level, rng: Rng) => Question> = {
  'number-sense': numberSense,
  addition,
  subtraction,
  'place-value': placeValue,
  multiplication,
  division,
  fractions,
};
