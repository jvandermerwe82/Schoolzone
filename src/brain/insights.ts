/** Plain-language summaries of what the brain has learned about a child. */
import { skillsFor } from '../content/skills';
import { guessRate, isMastered, predictCorrect } from './model';
import { isReady, skillState } from './tutor';
import type { Level, Profile, Skill, SubjectId } from './types';

export type SkillStatus = 'mastered' | 'learning' | 'struggling' | 'ready' | 'locked';

export interface SkillReport {
  skill: Skill;
  status: SkillStatus;
  /** 0-100: BKT probability the skill is learned. */
  masteryPct: number;
  /** Highest level the child is predicted to get right at least 75% of the time (0 = none yet). */
  comfortableLevel: number;
  attempts: number;
  accuracyPct: number | null;
  recentAccuracyPct: number | null;
  avgSeconds: number | null;
}

export function skillReport(profile: Profile, skill: Skill): SkillReport {
  const s = skillState(profile, skill.id);
  const recentAcc = s.recent.length ? s.recent.reduce((a, b) => a + b, 0) / s.recent.length : null;
  let status: SkillStatus;
  if (isMastered(s)) status = 'mastered';
  else if (!isReady(profile, skill)) status = 'locked';
  else if (s.attempts === 0) status = 'ready';
  else if (s.attempts >= 5 && recentAcc !== null && recentAcc < 0.5) status = 'struggling';
  else status = 'learning';

  const choiceCount = skill.subject === 'science' ? 4 : undefined;
  let comfortableLevel = 0;
  for (const level of [1, 2, 3, 4, 5] as Level[]) {
    if (predictCorrect(s.ability, level, guessRate(level, choiceCount)) >= 0.75) comfortableLevel = level;
  }

  return {
    skill,
    status,
    masteryPct: Math.round(s.pKnown * 100),
    comfortableLevel: s.attempts > 0 ? comfortableLevel : 0,
    attempts: s.attempts,
    accuracyPct: s.attempts ? Math.round((s.correct / s.attempts) * 100) : null,
    recentAccuracyPct: recentAcc === null ? null : Math.round(recentAcc * 100),
    avgSeconds: s.attempts ? Math.round(s.totalTimeMs / s.attempts / 100) / 10 : null,
  };
}

export function subjectReport(profile: Profile, subject: SubjectId): SkillReport[] {
  return skillsFor(subject).map((skill) => skillReport(profile, skill));
}

export interface Calibration {
  answers: number;
  /** Average success the brain predicted. */
  predictedPct: number;
  /** What actually happened. */
  actualPct: number;
}

/**
 * How honest is the brain? Compares predicted vs actual success over recent
 * answers. If these drift apart, the model's constants need re-tuning.
 */
export function calibration(profile: Profile, lastN = 50): Calibration | null {
  const recent = profile.history.slice(-lastN);
  if (recent.length < 10) return null;
  const predicted = recent.reduce((a, r) => a + r.predicted, 0) / recent.length;
  const actual = recent.filter((r) => r.correct).length / recent.length;
  return { answers: recent.length, predictedPct: Math.round(predicted * 100), actualPct: Math.round(actual * 100) };
}

/** A few human-readable sentences for parents. */
export function summarySentences(profile: Profile, subject: SubjectId): string[] {
  const reports = subjectReport(profile, subject).filter((r) => r.attempts > 0);
  if (reports.length === 0) return [`${profile.name} hasn't practised this subject yet.`];
  const out: string[] = [];
  const mastered = reports.filter((r) => r.status === 'mastered');
  const struggling = reports.filter((r) => r.status === 'struggling');
  const learning = reports.filter((r) => r.status === 'learning').sort((a, b) => b.masteryPct - a.masteryPct);
  if (mastered.length) out.push(`Strong at: ${mastered.map((r) => r.skill.name).join(', ')}.`);
  if (learning.length) out.push(`Currently learning: ${learning.map((r) => `${r.skill.name} (${r.masteryPct}%)`).join(', ')}.`);
  if (struggling.length) {
    out.push(`Finding hard right now: ${struggling.map((r) => r.skill.name).join(', ')}. The app will ease the level and revisit earlier skills.`);
  }
  return out;
}
