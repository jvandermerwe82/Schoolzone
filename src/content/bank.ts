/**
 * Shared helpers for multiple-choice question banks (science, English).
 * Bank format: [level, prompt, correct answer, wrong choices, explanation].
 * Choices are shuffled when a question is shown.
 */
import type { Level, Question } from '../brain/types';

export type Row = [Level, string, string, string[], string];

export function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rowsToQuestions(skillId: string, rows: Row[]): Question[] {
  return rows.map(([level, prompt, answer, wrong, explanation], i) => ({
    skillId, level, id: `${skillId}#${i}`, prompt, answer, explanation, choices: [answer, ...wrong],
  }));
}

/**
 * Pick a bank question as close as possible to the wanted level, preferring
 * ones the child has not seen recently.
 */
export function pickFromBank(all: Question[], level: Level, recentIds: string[], rng: () => number): Question {
  const fresh = all.filter((x) => !recentIds.includes(x.id));
  const pool = fresh.length > 0 ? fresh : all;
  const best = Math.min(...pool.map((x) => Math.abs(x.level - level)));
  const candidates = pool.filter((x) => Math.abs(x.level - level) === best);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  return { ...chosen, choices: shuffle(chosen.choices!, rng) };
}
