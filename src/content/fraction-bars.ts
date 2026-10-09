/**
 * Fraction-bar model: the pure maths behind the interactive fraction bars.
 *
 * Scope. This is a SUPPORT representation (like animated-support.ts), not an
 * answer surface: the typed answer stays the response surface, so a child
 * still has to work out and enter the result. The structured answer-surface
 * contract from the question visual engine (`Question.interaction`, PR #35)
 * is therefore left untouched and only `coordinate-plot` uses it.
 *
 * Correctness rules enforced here (and tested):
 * - every bar is split into EQUAL pieces only; a bar with `d` pieces always has
 *   `d` pieces of width `1/d`, so two bars with different denominators are
 *   never drawn as if their pieces were the same size;
 * - cutting every piece into `k` equal smaller pieces turns `n/d` into
 *   `(n*k)/(d*k)`, which is the same amount;
 * - the combined total is only produced when both bars use same-size pieces,
 *   and the UI shows it only in worked-example mode, never as a hint.
 *
 * Questions the model cannot represent exactly return null, and the caller
 * falls back to the existing static animated support.
 */
import type { Question } from '../brain/types';
import { gcd } from './maths';

export interface FractionPart {
  numerator: number;
  denominator: number;
}

export interface FractionBarsModel {
  operation: '+' | '−';
  parts: readonly [FractionPart, FractionPart];
  /** Smallest denominator both bars can share. */
  commonDenominator: number;
  /** The cut factor for each bar that reaches the common denominator. */
  matchingSplits: readonly [number, number];
}

/** Bars are only drawn up to this many pieces, so pieces stay big enough to see and touch. */
export const MAX_BAR_PIECES = 24;
/** The most a piece can be cut into in one choice. */
export const MAX_SPLIT = 6;

const PROMPT = /^(\d+)\/(\d+)\s*([+−])\s*(\d+)\/(\d+)\s*=\s*\?/;
const SKILLS = new Set(['fractions', 'fractions-y6']);

const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** Cutting every piece into `k` equal pieces: same amount, smaller pieces. */
export function splitPart(part: FractionPart, k: number): FractionPart {
  return { numerator: part.numerator * k, denominator: part.denominator * k };
}

/** Which cut factors keep the bar within the drawable limit. */
export function splitOptions(part: FractionPart): number[] {
  const options: number[] = [];
  for (let k = 1; k <= MAX_SPLIT && part.denominator * k <= MAX_BAR_PIECES; k++) options.push(k);
  return options;
}

/** Equal-width pieces for a bar: exactly `denominator` pieces, each `1/denominator` wide. */
export function barPieces(denominator: number, shaded: number): { index: number; start: number; width: number; shaded: boolean }[] {
  const width = 1 / denominator;
  return Array.from({ length: denominator }, (_, index) => ({
    index,
    start: index * width,
    width,
    shaded: index < shaded,
  }));
}

export function sameSizePieces(a: FractionPart, b: FractionPart): boolean {
  return a.denominator === b.denominator;
}

/** Parse a fraction addition/subtraction question into a bar model, or null if it cannot be shown exactly. */
export function fractionBarsFor(question: Question): FractionBarsModel | null {
  if (!SKILLS.has(question.skillId)) return null;
  const match = question.prompt.match(PROMPT);
  if (!match) return null;
  const [a, d1, op, b, d2] = [Number(match[1]), Number(match[2]), match[3] as '+' | '−', Number(match[4]), Number(match[5])];
  if (![a, d1, b, d2].every(Number.isInteger) || d1 < 2 || d2 < 2) return null;
  if (a < 0 || b < 0 || a > d1 || b > d2) return null; // proper fractions only
  const common = lcm(d1, d2);
  if (common > MAX_BAR_PIECES) return null;
  const splits = [common / d1, common / d2] as const;
  if (splits.some((k) => k > MAX_SPLIT)) return null;
  return {
    operation: op,
    parts: [{ numerator: a, denominator: d1 }, { numerator: b, denominator: d2 }],
    commonDenominator: common,
    matchingSplits: splits,
  };
}

/**
 * The combined amount, only when both bars use same-size pieces. Worked-example
 * use only: this IS the answer to the question, so hint mode must never call it.
 */
export function combinedPart(model: FractionBarsModel, splits: readonly [number, number]): FractionPart | null {
  const left = splitPart(model.parts[0], splits[0]);
  const right = splitPart(model.parts[1], splits[1]);
  if (!sameSizePieces(left, right)) return null;
  const numerator = model.operation === '+' ? left.numerator + right.numerator : left.numerator - right.numerator;
  if (numerator < 0) return null;
  return { numerator, denominator: left.denominator };
}

/** Plain-language description of one bar, used for screen readers and captions. */
export function describeBar(part: FractionPart, k: number): string {
  const cut = splitPart(part, k);
  const pieces = `${cut.numerator} out of ${cut.denominator} equal pieces shaded`;
  return k === 1
    ? `${pieces} (${part.numerator}/${part.denominator})`
    : `${pieces} (${cut.numerator}/${cut.denominator}, the same amount as ${part.numerator}/${part.denominator})`;
}
