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

/**
 * Make a question for a skill at a level. If `target` names a misconception,
 * prefer a question where that mistake would give a wrong answer, so the
 * child gets a fair chance to show they no longer make it.
 */
export function makeQuestion(skillId: string, level: Level, recentIds: string[], rng: Rng, target?: string | null): Question {
  const tests = (q: Question) => !target || (q.bugs ?? []).some(([id]) => id === target) || (target === 'not-simplest' && !!q.exact);
  const gen = GENERATORS[skillId];
  if (gen) {
    // Regenerate to avoid repeats and, when targeting, to find a question that tests the misconception.
    let question = gen(level, rng);
    for (let i = 0; i < 40 && (recentIds.includes(question.id) || !tests(question)); i++) question = gen(level, rng);
    // If this level can't test the misconception (e.g. level-3 addition never
    // needs carrying), keep the level the tutor chose: the difficulty matters more.
    return question;
  }
  const pick = getSkill(skillId).subject === 'english' ? pickEnglishQuestion : pickScienceQuestion;
  return pick(skillId, level, recentIds, rng, target ? tests : undefined);
}

/**
 * Can a question at this level show whether the child still makes this
 * mistake? (Level-3 addition never needs carrying, for example.)
 */
export function canTest(skillId: string, level: Level, target: string, rng: Rng = Math.random): boolean {
  const gen = GENERATORS[skillId];
  if (!gen) return true; // bank questions are chosen by misconception first
  for (let i = 0; i < 40; i++) {
    const q = gen(level, rng);
    if ((q.bugs ?? []).some(([id]) => id === target) || (target === 'not-simplest' && q.exact)) return true;
  }
  return false;
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
