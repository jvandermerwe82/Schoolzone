import type { Level, Question } from '../brain/types';
import { MATHS_GENERATORS, type Rng } from './maths';
import { pickScienceQuestion } from './science';

export function makeQuestion(skillId: string, level: Level, recentIds: string[], rng: Rng): Question {
  const gen = MATHS_GENERATORS[skillId];
  if (gen) {
    // Regenerate a few times to avoid showing the exact same sum twice in a row.
    let question = gen(level, rng);
    for (let i = 0; i < 5 && recentIds.includes(question.id); i++) question = gen(level, rng);
    return question;
  }
  return pickScienceQuestion(skillId, level, recentIds, rng);
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/[\s,]/g, '').replace(/−/g, '-');
}

/** Parses "7", "3/4" or "-2" into a number; anything else is null. */
function asNumber(s: string): number | null {
  const m = normalise(s).match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const d = m[2] === undefined ? 1 : Number(m[2]);
  return d === 0 ? null : Number(m[1]) / d;
}

/** Numeric answers accept equivalent forms (e.g. 2/4 for 1/2); text answers must match. */
export function checkAnswer(question: Question, input: string): boolean {
  if (normalise(input) === normalise(question.answer)) return true;
  const a = asNumber(input);
  const b = asNumber(question.answer);
  return a !== null && b !== null && Math.abs(a - b) < 1e-9;
}
