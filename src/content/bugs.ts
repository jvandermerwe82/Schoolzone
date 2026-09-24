/**
 * Answers that common mistakes produce. Generators attach these to their
 * questions so the brain can tell *why* an answer was wrong
 * (see brain/misconceptions.ts).
 */
import type { Question } from '../brain/types';

const digits = (n: number) => String(n).split('').reverse().map(Number);

/** Column addition with no carrying: 47 + 38 → 75. */
export function addNoCarry(a: number, b: number): number {
  const [x, y] = [digits(a), digits(b)];
  const out: number[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) out.push(((x[i] ?? 0) + (y[i] ?? 0)) % 10);
  return Number(out.reverse().join(''));
}

/** Brown & Burton's "smaller from larger" bug: 52 − 27 → 35. */
export function subSmallerFromLarger(a: number, b: number): number {
  const [x, y] = [digits(a), digits(b)];
  return Number(x.map((d, i) => Math.abs(d - (y[i] ?? 0))).reverse().join(''));
}

/** Exchanges a ten but never reduces the next column: 41 − 17 → 34. */
export function subBorrowNoDecrement(a: number, b: number): number {
  const [x, y] = [digits(a), digits(b)];
  return Number(x.map((d, i) => { const e = y[i] ?? 0; return d < e ? d + 10 - e : d - e; }).reverse().join(''));
}

type Tok = number | string;

/** Evaluate + − × ÷ strictly left to right, with brackets removed. */
export function leftToRight(tokens: Tok[]): number {
  const t = tokens.filter((x) => x !== '(' && x !== ')');
  let acc = t[0] as number;
  for (let i = 1; i < t.length; i += 2) {
    const [op, v] = [t[i], t[i + 1] as number];
    acc = op === '+' ? acc + v : op === '−' ? acc - v : op === '×' ? acc * v : acc / v;
  }
  return acc;
}

/** Normal order of operations, but with brackets removed. */
export function ignoreBrackets(tokens: Tok[]): number {
  const t = tokens.filter((x) => x !== '(' && x !== ')');
  const terms: Tok[] = [t[0]];
  for (let i = 1; i < t.length; i += 2) {
    const [op, v] = [t[i], t[i + 1] as number];
    if (op === '×' || op === '÷') {
      const prev = terms.pop() as number;
      terms.push(op === '×' ? prev * v : prev / v);
    } else terms.push(op, v);
  }
  return leftToRight(terms);
}

const isNiceNumber = (n: number) => Number.isFinite(n) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;

/**
 * Attach mistake answers to a question, keeping only those that are
 * well-formed, differ from the correct answer, and differ from each other.
 */
export function withBugs(q: Question, bugs: [string, number | string | null | undefined][]): Question {
  const seen = new Set([q.answer.replace(/%$/, '')]);
  const kept: [string, string][] = [];
  for (const [id, v] of bugs) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && !isNiceNumber(v)) continue;
    const s = String(v);
    const key = typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : s;
    if (seen.has(key) || (typeof v === 'number' && Number(q.answer.replace(/%$/, '')) === v)) continue;
    seen.add(key);
    kept.push([id, s]);
  }
  return kept.length ? { ...q, bugs: kept } : q;
}

/**
 * What kind of spelling mistake turns `correct` into `wrong`?
 * Checks the Year 5-6 spelling rules first, then general patterns.
 */
export function classifySpelling(correct: string, wrong: string): string {
  const c = correct.toLowerCase(), w = wrong.toLowerCase();
  const swapped = (from: string, to: string) => c.includes(from) && w === c.replace(from, to);
  if (swapped('ei', 'ie') || swapped('ie', 'ei')) return 'spell-ie-ei';
  if (swapped('cious', 'tious') || swapped('tious', 'cious')) return 'spell-cious-tious';
  if (swapped('cial', 'tial') || swapped('tial', 'cial')) return 'spell-cial-tial';
  if (/(able|ably|ible|ibly)$/.test(c) && /(able|ably|ible|ibly)$/.test(w) && c.slice(0, -4) === w.slice(0, -4)) return 'spell-able-ible';
  if (/(ant|ance|ancy|ent|ence|ency)$/.test(c) && c.replace(/a(nt|nce|ncy)$/, 'e$1') === w.replace(/a(nt|nce|ncy)$/, 'e$1')) return 'spell-ant-ent';
  if (/(ce|ge)able$/.test(c) && w === c.replace(/eable$/, 'able')) return 'spell-keep-e';
  if (/fer/.test(c) && c.replace('ferr', 'fer') === w.replace('ferr', 'fer')) return 'spell-fer-doubling';
  // One letter removed from the correct word.
  for (let i = 0; i < c.length; i++) {
    if (c.slice(0, i) + c.slice(i + 1) === w) {
      return c[i] === c[i - 1] || c[i] === c[i + 1] ? 'spell-missed-double' : 'spell-missing-letter';
    }
  }
  // One letter added.
  for (let i = 0; i < w.length; i++) {
    if (w.slice(0, i) + w.slice(i + 1) === c) {
      return w[i] === w[i - 1] || w[i] === w[i + 1] ? 'spell-extra-double' : 'spell-extra-letter';
    }
  }
  if (c.length === w.length) {
    const diffs = [...c].map((ch, i) => (ch === w[i] ? -1 : i)).filter((i) => i >= 0);
    if (diffs.length === 2 && diffs[1] === diffs[0] + 1 && c[diffs[0]] === w[diffs[1]] && c[diffs[1]] === w[diffs[0]]) return 'spell-letter-order';
    if (diffs.length === 1 && /[aeiouy]/.test(c[diffs[0]]) && /[aeiouy]/.test(w[diffs[0]])) return 'spell-vowel-choice';
  }
  return 'spell-phonetic';
}
