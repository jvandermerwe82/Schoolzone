/**
 * Question difficulty that learns from every answer.
 *
 * Each question starts at its assumed difficulty (its level). After every
 * answer the question's difficulty moves a little: if children do worse than
 * predicted it gets harder, if they do better it gets easier. This is the
 * item side of the Elo system Math Garden uses, where both ability and item
 * difficulty update with every answer (Klinkenberg et al., 2011).
 *
 * Offsets are centred within each skill, so they only learn how hard
 * questions are *compared with each other*. How good the child is overall
 * stays in the child's ability. Without this, one child's progress would
 * wrongly make every question look easier.
 *
 * Stats are stored per device and shared by all learners on it. With a
 * backend they could be shared by every child using the app.
 */
import type { Question } from './types';

export type ItemStats = Record<string, { offset: number; n: number }>;

/** Bank questions are learned one by one; generated maths questions per skill level. */
export function itemKey(q: Pick<Question, 'id' | 'skillId' | 'level'>): string {
  return q.id.startsWith(`${q.skillId}#`) ? q.id : `${q.skillId}:L${q.level}`;
}

export function itemOffset(items: ItemStats | undefined, key: string): number {
  return items?.[key]?.offset ?? 0;
}

const MAX_OFFSET = 2;

export function itemK(n: number): number {
  return Math.max(0.05, 0.3 / (1 + 0.05 * n));
}

/** Update one question's difficulty after an answer, then re-centre its skill. */
export function updateItem(items: ItemStats, q: Pick<Question, 'id' | 'skillId' | 'level'>, score: number, expected: number): ItemStats {
  const key = itemKey(q);
  const cur = items[key] ?? { offset: 0, n: 0 };
  const next: ItemStats = {
    ...items,
    [key]: { offset: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, cur.offset + itemK(cur.n) * (expected - score))), n: cur.n + 1 },
  };
  const skillKeys = Object.keys(next).filter((k) => k.startsWith(`${q.skillId}#`) || k.startsWith(`${q.skillId}:L`));
  if (skillKeys.length < 2) {
    // A single question can't be compared with anything yet.
    return { ...next, [key]: { ...next[key], offset: 0 } };
  }
  const mean = skillKeys.reduce((a, k) => a + next[k].offset, 0) / skillKeys.length;
  for (const k of skillKeys) next[k] = { ...next[k], offset: next[k].offset - mean };
  return next;
}

export function tunedCount(items: ItemStats): { questions: number; answers: number } {
  const vals = Object.values(items);
  return { questions: vals.filter((v) => v.n > 0).length, answers: vals.reduce((a, v) => a + v.n, 0) };
}
