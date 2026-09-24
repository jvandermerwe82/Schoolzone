/**
 * The learner model: two complementary signals per skill.
 *
 * 1. Elo-style ability (Klinkenberg et al., 2011, "Math Garden"): a number on a
 *    logit scale that moves up after correct answers and down after wrong ones,
 *    weighted by how surprising the result was. It answers "how hard a question
 *    can this child handle right now?".
 *
 * 2. Bayesian Knowledge Tracing (Corbett & Anderson, 1995): the probability the
 *    child has actually learned the skill, accounting for lucky guesses and
 *    careless slips. It answers "has this child mastered it?".
 *
 * The numeric constants below are starting values chosen for this app, not
 * values taken from those papers. They should be re-tuned once real usage
 * data exists (see `calibration` in insights.ts).
 */
import type { Level, SkillState } from './types';

/** Logit-scale difficulty of each level. Level 3 sits at 0. */
export function levelDifficulty(level: Level): number {
  return (level - 3) * 1.2;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Chance of a correct answer with no knowledge at all. */
export function guessRate(level: Level, choiceCount?: number): number {
  const typed = clamp(0.05 + 0.05 * (3 - level), 0.02, 0.15);
  return choiceCount ? Math.max(1 / choiceCount, typed) : typed;
}

/** Chance a child who knows the skill still gets it wrong. Harder levels slip more. */
export function slipRate(level: Level): number {
  return clamp(0.1 + 0.05 * (level - 3), 0.05, 0.2);
}

/** Predicted probability that the child answers a question at `level` correctly. */
export function predictCorrect(ability: number, level: Level, guess: number): number {
  return guess + (1 - guess) * sigmoid(ability - levelDifficulty(level));
}

// Elo step size shrinks as the brain sees more answers: big moves early
// (fast placement for a new child), small moves later (stable estimates).
const K_START = 0.8;
const K_MIN = 0.2;
const K_DECAY = 0.1;
export function kFactor(attempts: number): number {
  return Math.max(K_MIN, K_START / (1 + K_DECAY * attempts));
}

// BKT: chance of learning the skill from one practice opportunity.
export const P_LEARN = 0.15;
export const MASTERY_P_KNOWN = 0.95;
/** Also require a solid ability: at least 75% predicted on a level-3 typed question. */
export const MASTERY_LEVEL3_SUCCESS = 0.75;
/** Prerequisites at this knowledge level are "good enough" to start the next skill. */
export const READY_P_KNOWN = 0.8;

export function bktUpdate(pKnown: number, correct: boolean, guess: number, slip: number): number {
  const posterior = correct
    ? (pKnown * (1 - slip)) / (pKnown * (1 - slip) + (1 - pKnown) * guess)
    : (pKnown * slip) / (pKnown * slip + (1 - pKnown) * (1 - guess));
  return posterior + (1 - posterior) * P_LEARN;
}

export function initialSkillState(year: number, typicalYear: number): SkillState {
  // Start a bit above/below average depending on school year, but keep it
  // mild: the first few answers (large K) quickly correct a wrong guess.
  // Skills from well below the child's year start with a higher prior, so an
  // older child confirms them in a question or two instead of re-learning.
  const gap = year - typicalYear;
  const ability = clamp(gap * 0.5, -1.5, 1.5);
  return {
    ability,
    pKnown: gap >= 2 ? 0.5 : gap === 1 ? 0.3 : 0.1,
    attempts: 0,
    correct: 0,
    recent: [],
    wrongStreak: 0,
    lastPracticed: null,
    reviewIntervalDays: 0,
    nextReviewAt: null,
    masteredAt: null,
    totalTimeMs: 0,
  };
}

export function isMastered(s: SkillState): boolean {
  return (
    s.pKnown >= MASTERY_P_KNOWN &&
    predictCorrect(s.ability, 3, guessRate(3)) >= MASTERY_LEVEL3_SUCCESS
  );
}

const DAY = 24 * 60 * 60 * 1000;

/** Apply one answer to a skill state. Returns a new state. */
export function updateSkill(
  s: SkillState,
  level: Level,
  correct: boolean,
  guess: number,
  timeMs: number,
  now: number,
): SkillState {
  const expected = predictCorrect(s.ability, level, guess);
  const ability = s.ability + kFactor(s.attempts) * ((correct ? 1 : 0) - expected);
  const pKnown = bktUpdate(s.pKnown, correct, guess, slipRate(level));

  const next: SkillState = {
    ...s,
    ability,
    pKnown,
    attempts: s.attempts + 1,
    correct: s.correct + (correct ? 1 : 0),
    recent: [...s.recent, correct ? 1 : 0].slice(-10),
    wrongStreak: correct ? 0 : s.wrongStreak + 1,
    lastPracticed: now,
    totalTimeMs: s.totalTimeMs + timeMs,
  };

  // Spaced review: each successful review of a mastered skill doubles the gap
  // before the next one; a miss brings it back to tomorrow.
  const wasMastered = s.masteredAt !== null;
  if (isMastered(next)) {
    if (!wasMastered) {
      next.masteredAt = now;
      next.reviewIntervalDays = 1;
    } else if (correct) {
      // Only a review that was actually due earns a longer gap.
      const due = s.nextReviewAt !== null && now >= s.nextReviewAt;
      next.reviewIntervalDays = due ? Math.min(60, s.reviewIntervalDays * 2) : s.reviewIntervalDays;
    } else {
      next.reviewIntervalDays = 1;
    }
    if (!wasMastered || !correct || now >= (s.nextReviewAt ?? 0)) {
      next.nextReviewAt = now + next.reviewIntervalDays * DAY;
    }
  } else if (wasMastered) {
    // Slipped below mastery: back to active practice.
    next.masteredAt = null;
    next.reviewIntervalDays = 0;
    next.nextReviewAt = null;
  }
  return next;
}
