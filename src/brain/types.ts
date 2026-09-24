/** Shared types for the learner model ("the brain"). */

export type SubjectId = 'maths' | 'science';

/** Difficulty levels 1 (easiest) to 5 (hardest) within a skill. */
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: Level[] = [1, 2, 3, 4, 5];

export interface Skill {
  id: string;
  subject: SubjectId;
  name: string;
  emoji: string;
  description: string;
  /** Skills that should be solid before this one is introduced. */
  prerequisites: string[];
  /** Roughly the school grade where this is usually taught; only a starting guess. */
  typicalGrade: number;
}

export interface Question {
  skillId: string;
  level: Level;
  /** Stable id for bank questions (used to avoid repeats); generated questions use their prompt. */
  id: string;
  prompt: string;
  /** Present for multiple choice; absent for typed answers. */
  choices?: string[];
  answer: string;
  explanation: string;
}

/** What the brain knows about one child on one skill. */
export interface SkillState {
  /** Elo-style ability on a logit scale. 0 means a level-3 question is a coin flip. */
  ability: number;
  /** Bayesian Knowledge Tracing: probability the child has learned the skill. */
  pKnown: number;
  attempts: number;
  correct: number;
  /** Last 10 results, newest last (1 = correct, 0 = wrong). */
  recent: number[];
  /** Consecutive wrong answers, used to spot frustration. */
  wrongStreak: number;
  lastPracticed: number | null;
  /** Spaced-review bookkeeping once a skill is mastered. */
  reviewIntervalDays: number;
  nextReviewAt: number | null;
  masteredAt: number | null;
  /** Total time spent answering (ms), for average-speed insights. */
  totalTimeMs: number;
}

export interface AnswerRecord {
  at: number;
  skillId: string;
  level: Level;
  correct: boolean;
  timeMs: number;
  /** Probability of success the brain predicted before the answer. */
  predicted: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  /** School grade (1-7) chosen at sign-up; used only as a starting guess. */
  grade: number;
  createdAt: number;
  skills: Record<string, SkillState>;
  history: AnswerRecord[];
  /** Recently seen bank question ids, to avoid repeating questions. */
  recentQuestionIds: string[];
}
