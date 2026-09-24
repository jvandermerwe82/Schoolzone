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

/**
 * `tags` maps a wrong choice to the misconception it reveals, or a function
 * that works it out from the correct answer and the wrong choice.
 */
export type Tags = Record<string, string> | ((answer: string, wrong: string) => string | null);

export function rowsToQuestions(skillId: string, rows: Row[], tags?: Tags): Question[] {
  return rows.map(([level, prompt, answer, wrong, explanation], i) => {
    const bugs = wrong
      .map((w): [string, string] | null => {
        const id = typeof tags === 'function' ? tags(answer, w) : tags?.[w];
        return id ? [id, w] : null;
      })
      .filter((b): b is [string, string] => b !== null);
    return {
      skillId, level, id: `${skillId}#${i}`, prompt, answer, explanation, choices: [answer, ...wrong],
      ...(bugs.length ? { bugs } : {}),
    };
  });
}

/**
 * Pick a bank question as close as possible to the wanted level, preferring
 * ones the child has not seen recently.
 */
export function pickFromBank(
  all: Question[],
  level: Level,
  recentIds: string[],
  rng: () => number,
  prefer?: (q: Question) => boolean,
): Question {
  // Prefer questions that test a misconception the child is working on, if any exist.
  const preferred = prefer ? all.filter(prefer) : [];
  if (preferred.length > 0) all = preferred;
  const fresh = all.filter((x) => !recentIds.includes(x.id));
  const pool = fresh.length > 0 ? fresh : all;
  const best = Math.min(...pool.map((x) => Math.abs(x.level - level)));
  const candidates = pool.filter((x) => Math.abs(x.level - level) === best);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  return { ...chosen, choices: shuffle(chosen.choices!, rng) };
}
