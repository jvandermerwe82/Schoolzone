/** Shared types for the learner model ("the brain"). */

export type SubjectId = 'maths' | 'science' | 'english';

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
  /** School year (England) where this is usually taught; only a starting guess. */
  typicalYear: number;
  /** Number of choices when the skill is multiple choice; absent for typed answers. */
  choices?: number;
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
  /** Answer must match exactly (e.g. "simplest form"), not just be equal in value. */
  exact?: boolean;
  /**
   * Known mistakes for this question: [misconception id, the answer that
   * mistake produces]. Lets the brain work out *why* an answer was wrong.
   */
  bugs?: [string, string][];
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
  /** Misconception the wrong answer matched, if any. */
  misconception?: string;
  /** The child used a hint. */
  hinted?: boolean;
  /** Wrong answer given too quickly to have been a real attempt. */
  rapid?: boolean;
  /** How the tutor was helping at the time, if the child was stuck. */
  strategy?: StrategyId | 'climb';
}

/** Different ways the tutor can help when a child is stuck. */
export type StrategyId = 'similar' | 'worked-example' | 'hint' | 'smaller-steps' | 'prerequisite';

/**
 * A "stuck episode": starts when a child gets a question wrong and lasts
 * until they can answer at that difficulty on their own. The tutor never
 * just moves on; it tries different ways of helping until one works.
 */
export interface HelpEpisode {
  skillId: string;
  /** Level of the question the child got stuck on. */
  stuckLevel: Level;
  misconception: string | null;
  /** Current way of helping, or 'climb': helped, now working back up unaided. */
  phase: StrategyId | 'climb';
  /** Strategies already tried in this episode without success. */
  tried: StrategyId[];
  /** The strategy that got the child answering again (credited only once they solve it on their own). */
  helpedBy: StrategyId | null;
  /** Level of the last question answered correctly in this episode. */
  lastLevel: Level;
  /** For the 'prerequisite' strategy: which earlier skill, and progress on it. */
  prereqSkill: string | null;
  prereqCorrect: number;
  prereqWrong: number;
  startedAt: number;
  attempts: number;
}

export interface HelpState {
  episode: HelpEpisode | null;
  /** How often each way of helping has been tried with this child, and how often it worked. */
  strategies: Partial<Record<StrategyId, { tried: number; helped: number }>>;
  /** Times the child got stuck, and times they worked through it. */
  stuck: number;
  resolved: number;
}

/** What the brain believes about one misconception for one child. */
export interface MisconceptionState {
  /** 0-1: how strongly the child seems to hold it. At or above 0.5 counts as active. */
  strength: number;
  /** Times the child's answer matched this mistake. */
  seen: number;
  lastSeen: number;
  /** When it stopped showing up after being active, if it has. */
  fixedAt: number | null;
  /** Skills where it has shown up. */
  skills: string[];
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  /** School year (1-7, England) chosen at sign-up; used only as a starting guess. */
  year: number;
  createdAt: number;
  skills: Record<string, SkillState>;
  history: AnswerRecord[];
  /** Recently seen bank question ids, to avoid repeating questions. */
  recentQuestionIds: string[];
  /** Mistake patterns the brain has noticed, by misconception id. */
  misconceptions: Record<string, MisconceptionState>;
  /** Help when stuck, and what kind of help works for this child. */
  help: HelpState;
}
