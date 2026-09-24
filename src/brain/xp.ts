/**
 * XP, player level and day streak: the game-style progress Year 6 players
 * expect. XP rewards real effort: unaided correct answers earn the most,
 * harder questions earn more, rushed guesses earn nothing.
 */
import type { AnswerRecord, Profile } from './types';

export const XP_RESOLVED = 40;
export const XP_BADGE = 50;

export function xpForAnswer(r: Pick<AnswerRecord, 'correct' | 'hinted' | 'rapid' | 'level'>): number {
  if (r.rapid) return 0;
  if (!r.correct) return 1; // an honest try still counts for something
  const base = 10 + 5 * (r.level - 1);
  return r.hinted ? Math.round(base / 2) : base;
}

/** XP needed to reach a level: 0, 100, 300, 600, 1000, … (each level needs 100 more than the last). */
export function xpForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export function playerLevel(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return { level, into: xp - xpForLevel(level), needed: xpForLevel(level + 1) - xpForLevel(level) };
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Days in a row with practice, ending today (or yesterday, so the streak isn't lost before today's practice). */
export function dayStreak(p: Profile, now: number): number {
  const days = new Set(p.history.map((h) => dayKey(h.at)));
  const DAY = 86_400_000;
  let start = now;
  if (!days.has(dayKey(now))) start = now - DAY;
  let streak = 0;
  for (let t = start; days.has(dayKey(t)); t -= DAY) streak++;
  return streak;
}
