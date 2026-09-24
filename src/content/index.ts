import type { Level, Question } from '../brain/types';
import { pickEnglishQuestion } from './english';
import { MATHS_GENERATORS, type Rng } from './maths';
import { MATHS_Y6_GENERATORS } from './maths-y6';
import { pickScienceQuestion } from './science';
import { getSkill } from './skills';

const GENERATORS = { ...MATHS_GENERATORS, ...MATHS_Y6_GENERATORS };

export function hasGenerator(skillId: string): boolean {
  return skillId in GENERATORS;
}

export function makeQuestion(skillId: string, level: Level, recentIds: string[], rng: Rng): Question {
  const gen = GENERATORS[skillId];
  if (gen) {
    // Regenerate a few times to avoid showing the exact same question twice in a row.
    let question = gen(level, rng);
    for (let i = 0; i < 5 && recentIds.includes(question.id); i++) question = gen(level, rng);
    return question;
  }
  if (getSkill(skillId).subject === 'english') return pickEnglishQuestion(skillId, level, recentIds, rng);
  return pickScienceQuestion(skillId, level, recentIds, rng);
}

/** Lower-case, unify minus signs, tidy spaces (including around "/"). */
function tidy(s: string): string {
  return s.trim().toLowerCase().replace(/−/g, '-').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
}

/**
 * Parses whole numbers, decimals, fractions ("3/4") and mixed numbers
 * ("2 1/3"), ignoring thousands commas and simple units (°, %, cm², m, £).
 */
export function parseNumber(input: string): number | null {
  const t = tidy(input)
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(/^£\s*/, '')
    .replace(/\s*(°c|°|degrees|%|cm²|cm2|cm|m|pounds)$/, '')
    .trim();
  let m = t.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
  if (m) {
    const d = Number(m[4]);
    if (d === 0) return null;
    const v = Number(m[2]) + Number(m[3]) / d;
    return m[1] ? -v : v;
  }
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if (/^-?(\d+(\.\d+)?|\.\d+)$/.test(t)) return Number(t);
  return null;
}

/**
 * Multiple-choice and "exact" answers (e.g. simplest form) must match the
 * answer; other numeric answers accept any equal value (2/4 for 1/2, 0.5, 50%).
 */
export function checkAnswer(question: Question, input: string): boolean {
  if (tidy(input) === tidy(question.answer)) return true;
  if (question.choices || question.exact) return false;
  const a = parseNumber(input);
  const b = parseNumber(question.answer);
  return a !== null && b !== null && Math.abs(a - b) < 1e-9;
}
