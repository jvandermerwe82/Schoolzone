/**
 * The tutor decides what a child should practise next and records what
 * happened. All decisions are made from the child's own learner model.
 */
import { getSkill, skillsFor } from '../content/skills';
import {
  guessRate, initialSkillState, isMastered, predictCorrect, READY_P_KNOWN, updateSkill,
} from './model';
import { LEVELS, type Level, type Profile, type Question, type Skill, type SkillState, type SubjectId } from './types';

/** Aim for questions the child gets right about 80% of the time. */
export const TARGET_SUCCESS = 0.8;
/** After a run of mistakes, ease off to rebuild confidence. */
export const RECOVERY_SUCCESS = 0.9;

export type Reason = 'new' | 'continue' | 'review' | 'gap' | 'recovery';

export interface Plan {
  skillId: string;
  level: Level;
  reason: Reason;
  /** Short, kid-friendly note on why this was chosen. */
  message: string;
}

export function skillState(profile: Profile, skillId: string): SkillState {
  return profile.skills[skillId] ?? initialSkillState(profile.grade, getSkill(skillId).typicalGrade);
}

export function isReady(profile: Profile, skill: Skill): boolean {
  return skill.prerequisites.every((p) => {
    const s = skillState(profile, p);
    return s.pKnown >= READY_P_KNOWN || isMastered(s);
  });
}

/** Pick the level whose predicted success is closest to the target. */
export function chooseLevel(state: SkillState, target: number, choiceCount?: number): Level {
  let best: Level = 1;
  let bestGap = Infinity;
  for (const level of LEVELS) {
    const p = predictCorrect(state.ability, level, guessRate(level, choiceCount));
    const gap = Math.abs(p - target);
    if (gap < bestGap) { best = level; bestGap = gap; }
  }
  return best;
}

export function isSubjectMultipleChoice(subject: SubjectId): boolean {
  return subject === 'science';
}

/** Weakest prerequisite that is not yet solid, searching down the skill map. */
function weakestGap(profile: Profile, skillId: string, seen = new Set<string>()): string | null {
  let worst: { id: string; p: number } | null = null;
  for (const pre of getSkill(skillId).prerequisites) {
    if (seen.has(pre)) continue;
    seen.add(pre);
    const s = skillState(profile, pre);
    if (!isMastered(s) && (!worst || s.pKnown < worst.p)) worst = { id: pre, p: s.pKnown };
  }
  if (worst) return weakestGap(profile, worst.id, seen) ?? worst.id;
  return null;
}

export interface SessionContext {
  /** Skill the session is currently focusing on. */
  focus: string | null;
  /** Questions answered so far in this session. */
  answered: number;
}

/**
 * Decide the next skill and difficulty for this child.
 * `rng` is injectable so behaviour can be tested deterministically.
 */
export function planNext(
  profile: Profile,
  subject: SubjectId,
  session: SessionContext,
  now: number,
  rng: () => number = Math.random,
): Plan {
  const mc = isSubjectMultipleChoice(subject);
  const choiceCount = mc ? 4 : undefined;
  const skills = skillsFor(subject);
  const plan = (skillId: string, reason: Reason, message: string, target = TARGET_SUCCESS): Plan => ({
    skillId, reason, message, level: chooseLevel(skillState(profile, skillId), target, choiceCount),
  });

  // 1. Stuck? Three misses in a row: step back to a shaky prerequisite if
  //    there is one, otherwise make the same skill easier.
  if (session.focus) {
    const focus = skillState(profile, session.focus);
    if (focus.wrongStreak >= 3) {
      const gap = weakestGap(profile, session.focus);
      if (gap) {
        return plan(gap, 'gap', `Let's warm up with ${getSkill(gap).name} first. It helps with ${getSkill(session.focus).name}!`, RECOVERY_SUCCESS);
      }
      return plan(session.focus, 'recovery', "Let's try an easier one.", RECOVERY_SUCCESS);
    }
    if (focus.wrongStreak === 2) return plan(session.focus, 'recovery', "Let's try an easier one.", RECOVERY_SUCCESS);
  }

  // 2. Every 4th question, revisit a mastered skill that is due, so it isn't forgotten.
  const due = skills
    .map((s) => ({ s, st: skillState(profile, s.id) }))
    .filter(({ st }) => st.masteredAt !== null && st.nextReviewAt !== null && st.nextReviewAt <= now)
    .sort((a, b) => a.st.nextReviewAt! - b.st.nextReviewAt!);
  if (due.length > 0 && session.answered % 4 === 3) {
    return plan(due[0].s.id, 'review', `Quick review of ${due[0].s.name} so you don't forget it!`);
  }

  // 3. Keep going on the current skill until it is mastered.
  if (session.focus && getSkill(session.focus).subject === subject) {
    const focus = skillState(profile, session.focus);
    if (!isMastered(focus) && isReady(profile, getSkill(session.focus))) {
      return plan(session.focus, 'continue', '');
    }
  }

  // 4. Otherwise: finish skills already started (closest to mastery first),
  //    then introduce the next ready skill (earliest grade first).
  const open = skills.filter((s) => isReady(profile, s) && !isMastered(skillState(profile, s.id)));
  const started = open
    .filter((s) => skillState(profile, s.id).attempts > 0)
    .sort((a, b) => skillState(profile, b.id).pKnown - skillState(profile, a.id).pKnown);
  if (started.length > 0) return plan(started[0].id, 'continue', `Back to ${started[0].name}!`);
  const fresh = open.sort((a, b) => a.typicalGrade - b.typicalGrade);
  if (fresh.length > 0) return plan(fresh[0].id, 'new', `New skill unlocked: ${fresh[0].name}!`);

  // 5. Everything mastered: keep it fresh with reviews, earliest due first.
  const all = skills
    .map((s) => ({ s, st: skillState(profile, s.id) }))
    .sort((a, b) => (a.st.nextReviewAt ?? 0) - (b.st.nextReviewAt ?? 0));
  const pickIdx = due.length > 0 ? 0 : Math.floor(rng() * all.length);
  const choice = all[pickIdx].s;
  return plan(choice.id, 'review', `You've mastered everything here! Keeping ${choice.name} sharp.`, TARGET_SUCCESS);
}

/** Record an answer. Returns the updated profile and the prediction made beforehand. */
export function recordAnswer(
  profile: Profile,
  question: Question,
  correct: boolean,
  timeMs: number,
  now: number,
): { profile: Profile; predicted: number } {
  const before = skillState(profile, question.skillId);
  const guess = guessRate(question.level, question.choices?.length);
  const predicted = predictCorrect(before.ability, question.level, guess);
  const after = updateSkill(before, question.level, correct, guess, timeMs, now);
  return {
    predicted,
    profile: {
      ...profile,
      skills: { ...profile.skills, [question.skillId]: after },
      history: [
        ...profile.history,
        { at: now, skillId: question.skillId, level: question.level, correct, timeMs, predicted },
      ].slice(-2000),
      recentQuestionIds: [...profile.recentQuestionIds.filter((id) => id !== question.id), question.id].slice(-30),
    },
  };
}
