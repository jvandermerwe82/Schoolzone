/**
 * The tutor decides what a child should practise next and records what
 * happened. Every answer updates the child's learner model: ability,
 * mastery, misconceptions, which kinds of help work for them, and how hard
 * each question really is.
 */
import { canTest } from '../content';
import { getSkill, skillsFor } from '../content/skills';
import { emptyHelp, updateHelp, type HelpEvent } from './help';
import { itemKey, itemOffset, updateItem, type ItemStats } from './items';
import { activeMisconceptionFor, diagnose, updateMisconceptions } from './misconceptions';
import {
  answerScore, guessRate, initialSkillState, isMastered, predictCorrect, READY_P_KNOWN, updateSkill,
} from './model';
import {
  LEVELS, type Level, type Profile, type Question, type Skill, type SkillState, type StrategyId, type SubjectId,
} from './types';

/** Aim for questions the child gets right about 80% of the time. */
export const TARGET_SUCCESS = 0.8;
/** Unaided correct answers in a row before trying a harder level. */
export const STRETCH_RUN = 4;
/** Only stretch if the model gives the child at least this chance at the harder level. */
export const STRETCH_MIN_CHANCE = 0.5;
/** While helping a stuck child, aim higher so they can rebuild confidence. */
export const RECOVERY_SUCCESS = 0.9;

export type Reason = 'new' | 'continue' | 'review' | 'help' | 'climb';

export interface Plan {
  skillId: string;
  level: Level;
  reason: Reason;
  /** Short, kid-friendly note on why this was chosen. */
  message: string;
  /** Misconception the next question should test, if any. */
  target?: string | null;
  /** Show a hint up front. */
  showHint?: boolean;
  /** Show a fully worked example before the question. */
  workedExample?: boolean;
  /** How the tutor is helping, when the child is stuck. */
  strategy?: StrategyId | 'climb';
}

export function skillState(profile: Profile, skillId: string): SkillState {
  return profile.skills[skillId] ?? initialSkillState(profile.year, getSkill(skillId).typicalYear);
}

export function isReady(profile: Profile, skill: Skill): boolean {
  return skill.prerequisites.every((p) => {
    const s = skillState(profile, p);
    return s.pKnown >= READY_P_KNOWN || isMastered(s);
  });
}

/**
 * Pick the level whose predicted success is closest to the target, using the
 * learned difficulty of each level where available.
 */
export function chooseLevel(
  state: SkillState,
  target: number,
  choiceCount?: number,
  offsetFor: (level: Level) => number = () => 0,
  maxLevel: Level = 5,
): Level {
  let best: Level = 1;
  let bestGap = Infinity;
  for (const level of LEVELS.filter((l) => l <= maxLevel)) {
    const p = predictCorrect(state.ability, level, guessRate(level, choiceCount), offsetFor(level));
    const gap = Math.abs(p - target);
    if (gap < bestGap) { best = level; bestGap = gap; }
  }
  return best;
}

export interface SessionContext {
  /** Skill the session is currently focusing on. */
  focus: string | null;
  /** Questions answered so far in this session. */
  answered: number;
}

const lower = (l: Level): Level => Math.max(1, l - 1) as Level;

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
  items: ItemStats = {},
): Plan {
  const skills = skillsFor(subject);
  const levelFor = (skillId: string, target: number, maxLevel: Level = 5) =>
    chooseLevel(skillState(profile, skillId), target, getSkill(skillId).choices,
      (l) => itemOffset(items, itemKey({ id: '', skillId, level: l })), maxLevel);
  const plan = (skillId: string, reason: Reason, message: string, target = TARGET_SUCCESS): Plan => {
    let level = levelFor(skillId, target);
    // Stretch: after a run of unaided correct answers, try one level up if the
    // child has a fair chance at it. Easy questions tell the rating little, so
    // without this a child can stay on easy questions long after they're ready.
    const run = profile.history.filter((h) => h.skillId === skillId).slice(-STRETCH_RUN);
    const onARoll = run.length === STRETCH_RUN && run.every((h) => h.correct && !h.hinted);
    if (onARoll) {
      const top = Math.max(...run.map((h) => h.level));
      const next = Math.min(5, top + 1) as Level;
      const st = skillState(profile, skillId);
      const chance = predictCorrect(st.ability, next, guessRate(next, getSkill(skillId).choices),
        itemOffset(items, itemKey({ id: '', skillId, level: next })));
      if (top >= level && top < 5 && chance >= STRETCH_MIN_CHANCE) {
        level = (top + 1) as Level;
        message = message || 'You\'re on a roll! Let\'s try a harder one.';
      }
    }
    return { skillId, reason, message, level, target: activeMisconceptionFor(profile, skillId) };
  };

  // 1. Stuck? Stay with it and help, in whatever way the help episode says.
  const ep = (profile.help ?? emptyHelp()).episode;
  if (ep && getSkill(ep.skillId).subject === subject) {
    const name = getSkill(ep.skillId).name;
    const base = { skillId: ep.skillId, target: ep.misconception, strategy: ep.phase } as const;
    const resumed = session.answered === 0 ? `Last time ${name} was tricky. Let's crack it together! ` : '';
    // "One like it" should be a little easier, unless the easier level can't
    // show the same mistake; then it stays at the same level.
    const easier = lower(ep.stuckLevel);
    const likeIt = ep.misconception && !canTest(ep.skillId, easier, ep.misconception, rng) ? ep.stuckLevel : easier;
    switch (ep.phase) {
      case 'similar':
        return { ...base, reason: 'help', level: likeIt, message: `${resumed}Let's try one like it.` };
      case 'hint':
        return { ...base, reason: 'help', level: likeIt, showHint: true, message: `${resumed}Here's a hint to help with this one.` };
      case 'worked-example':
        return { ...base, reason: 'help', level: likeIt, workedExample: true, message: `${resumed}Let's look at one together first.` };
      case 'smaller-steps':
        return { ...base, reason: 'help', level: 1, message: `${resumed}Let's start with an easier one and build back up.` };
      case 'prerequisite': {
        const pre = ep.prereqSkill ?? ep.skillId;
        return {
          skillId: pre, reason: 'help', strategy: 'prerequisite', target: activeMisconceptionFor(profile, pre),
          level: levelFor(pre, RECOVERY_SUCCESS),
          message: `${resumed}${name} builds on ${getSkill(pre).name}. Let's practise that first, then come back.`,
        };
      }
      case 'climb': {
        const level = Math.min(ep.stuckLevel, ep.lastLevel + 1) as Level;
        const msg = level >= ep.stuckLevel ? 'You\'re ready. Try this one on your own!' : 'Nice! Now a slightly harder one on your own.';
        return { ...base, reason: 'climb', level, message: `${resumed}${msg}` };
      }
    }
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
  //    then introduce the next ready skill (earliest school year first).
  const open = skills.filter((s) => isReady(profile, s) && !isMastered(skillState(profile, s.id)));
  const started = open
    .filter((s) => skillState(profile, s.id).attempts > 0)
    .sort((a, b) => skillState(profile, b.id).pKnown - skillState(profile, a.id).pKnown);
  if (started.length > 0) return plan(started[0].id, 'continue', `Back to ${started[0].name}!`);
  const fresh = open.sort((a, b) => a.typicalYear - b.typicalYear);
  if (fresh.length > 0) return plan(fresh[0].id, 'new', `New skill unlocked: ${fresh[0].name}!`);

  // 5. Everything mastered: keep it fresh with reviews, earliest due first.
  const all = skills
    .map((s) => ({ s, st: skillState(profile, s.id) }))
    .sort((a, b) => (a.st.nextReviewAt ?? 0) - (b.st.nextReviewAt ?? 0));
  const pickIdx = due.length > 0 ? 0 : Math.floor(rng() * all.length);
  const choice = all[pickIdx].s;
  return plan(choice.id, 'review', `You've mastered everything here! Keeping ${choice.name} sharp.`);
}

/**
 * A wrong answer faster than this is treated as a rapid guess rather than a
 * real attempt. Based on the idea of response-time effort (Wise & Kong,
 * 2005); the threshold (1.5 s plus reading time) is this app's choice.
 */
export function rapidThresholdMs(q: Question): number {
  const text = q.prompt.length + (q.choices ?? []).join(' ').length;
  return 1500 + 12 * text;
}

export interface AnswerOptions {
  /** What the child entered or chose (used to diagnose the mistake). */
  given?: string;
  hinted?: boolean;
  /** Shared question-difficulty stats; updated copy is returned. */
  items?: ItemStats;
  /** How the tutor was helping when this question was asked. */
  strategy?: StrategyId | 'climb';
}

export interface AnswerResult {
  profile: Profile;
  items: ItemStats;
  /** Probability of success the brain predicted before the answer. */
  predicted: number;
  misconception: string | null;
  rapid: boolean;
  /** What happened to the stuck episode, if anything. */
  event: HelpEvent;
}

/** Record an answer and update everything the brain knows. */
export function recordAnswer(
  profile: Profile,
  question: Question,
  correct: boolean,
  timeMs: number,
  now: number,
  opts: AnswerOptions = {},
): AnswerResult {
  const { given, hinted = false, items = {}, strategy } = opts;
  const before = skillState(profile, question.skillId);
  const guess = guessRate(question.level, question.choices?.length);
  const offset = itemOffset(items, itemKey(question));
  const predicted = predictCorrect(before.ability, question.level, guess, offset);
  const rapid = !correct && timeMs < rapidThresholdMs(question);
  const misconception = given !== undefined && !rapid ? diagnose(question, given, correct) : null;

  const after = updateSkill(before, question.level, correct, guess, timeMs, now, { hinted, rapid, offset });
  const updated: Profile = {
    ...profile,
    skills: { ...profile.skills, [question.skillId]: after },
    misconceptions: updateMisconceptions(profile.misconceptions ?? {}, question, correct, hinted, misconception, now),
    history: [
      ...profile.history,
      {
        at: now, skillId: question.skillId, level: question.level, correct, timeMs, predicted,
        ...(misconception ? { misconception } : {}), ...(hinted ? { hinted } : {}), ...(rapid ? { rapid } : {}),
        ...(strategy ? { strategy } : {}),
      },
    ].slice(-2000),
    recentQuestionIds: [...profile.recentQuestionIds.filter((id) => id !== question.id), question.id].slice(-30),
  };
  const { help, event } = updateHelp(updated, question, correct, hinted, rapid, misconception, now);

  // Rapid guesses and hinted answers say little about the question itself.
  const nextItems = rapid || hinted ? items : updateItem(items, question, answerScore(correct), predicted);
  return { profile: { ...updated, help }, items: nextItems, predicted, misconception, rapid, event };
}
