/**
 * Helping a stuck child.
 *
 * A wrong answer starts a "stuck episode" on that skill. The tutor does not
 * move on to something else. It tries one way of helping at a time:
 *
 *   similar         explain the mistake, then a similar (slightly easier) question
 *   worked-example  show a fully solved example first, then "your turn"
 *   hint            give a hint up front (and remove a wrong option)
 *   smaller-steps   drop to the easiest version and build back up
 *   prerequisite    practise the earlier skill this one builds on, then return
 *
 * When a way of helping works (the child gets the next one right), the child
 * climbs back up to the level they got stuck on, without help. The episode
 * ends only when they answer at that level on their own, and only then does
 * that way of helping count as having helped. If help doesn't work, or the
 * child slips on the way back up, the tutor switches to a different way. When every way has been
 * tried, it starts again from the easiest level, so it never gives up and
 * never just moves on.
 *
 * The tutor also learns which ways of helping work for *this* child: each
 * strategy's success rate is tracked, and the one most likely to help is
 * tried first (untried strategies get a fair chance via a neutral prior).
 */
import { getSkill } from '../content/skills';
import { isMastered } from './model';
import type { HelpEpisode, HelpState, Level, Profile, Question, StrategyId } from './types';

export const STRATEGIES: StrategyId[] = ['similar', 'worked-example', 'hint', 'smaller-steps', 'prerequisite'];

export const STRATEGY_LABEL: Record<StrategyId, string> = {
  similar: 'Explaining the mistake, then a similar question',
  'worked-example': 'Seeing a worked example first',
  hint: 'Getting a hint',
  'smaller-steps': 'Starting easier and building up',
  prerequisite: 'Going back to an earlier skill',
};

/** Correct answers needed on the earlier skill before returning. */
const PREREQ_CORRECT_NEEDED = 2;
/** Misses on the earlier skill before trying a different way of helping. */
const PREREQ_WRONG_LIMIT = 3;

export function emptyHelp(): HelpState {
  return { episode: null, strategies: {}, stuck: 0, resolved: 0 };
}

/** Chance a strategy helps this child: (helped + 1) / (tried + 2), a neutral prior for untried ones. */
export function strategyScore(help: HelpState, s: StrategyId): number {
  const st = help.strategies[s] ?? { tried: 0, helped: 0 };
  return (st.helped + 1) / (st.tried + 2);
}

/** Earliest weak prerequisite, searching down the skill map (null if all are solid). */
export function weakPrerequisite(profile: Profile, skillId: string, seen = new Set<string>()): string | null {
  let worst: { id: string; p: number } | null = null;
  for (const pre of getSkill(skillId).prerequisites) {
    if (seen.has(pre)) continue;
    seen.add(pre);
    const s = profile.skills[pre];
    // A never-practised prerequisite counts as unknown, so it is worth checking.
    const pKnown = s?.pKnown ?? 0;
    if (!(s && isMastered(s)) && (!worst || pKnown < worst.p)) worst = { id: pre, p: pKnown };
  }
  if (worst) return weakPrerequisite(profile, worst.id, seen) ?? worst.id;
  return null;
}

/** Pick the next way of helping: best for this child among those not yet tried this episode. */
export function nextStrategy(profile: Profile, ep: Pick<HelpEpisode, 'skillId' | 'stuckLevel' | 'tried'>): { strategy: StrategyId; tried: StrategyId[]; prereqSkill: string | null } {
  const prereq = weakPrerequisite(profile, ep.skillId);
  const usable = STRATEGIES.filter((s) => (s !== 'prerequisite' || prereq) && (s !== 'smaller-steps' || ep.stuckLevel > 1));
  let tried = ep.tried;
  let options = usable.filter((s) => !tried.includes(s));
  if (options.length === 0) {
    // Everything has been tried: start another round rather than give up.
    tried = [];
    options = usable;
  }
  const help = profile.help ?? emptyHelp();
  const strategy = [...options].sort((a, b) => strategyScore(help, b) - strategyScore(help, a) || STRATEGIES.indexOf(a) - STRATEGIES.indexOf(b))[0];
  return { strategy, tried, prereqSkill: strategy === 'prerequisite' ? prereq : null };
}

export type HelpEvent = 'stuck' | 'helped' | 'switched' | 'resolved' | null;

function credit(help: HelpState, s: StrategyId, helped: boolean): HelpState {
  const st = help.strategies[s] ?? { tried: 0, helped: 0 };
  return { ...help, strategies: { ...help.strategies, [s]: { tried: st.tried + 1, helped: st.helped + (helped ? 1 : 0) } } };
}

/**
 * Move the stuck episode forward after an answer. `profile` is the profile
 * *after* the answer was recorded in the skill model.
 */
export function updateHelp(
  profile: Profile,
  q: Question,
  correct: boolean,
  hinted: boolean,
  rapid: boolean,
  misconception: string | null,
  now: number,
): { help: HelpState; event: HelpEvent } {
  let help = profile.help ?? emptyHelp();
  const ep = help.episode;

  // A rapid guess isn't a real attempt: nudge to slow down, but don't change course.
  if (rapid) return { help, event: null };

  if (!ep) {
    if (correct) return { help, event: null };
    const start = { skillId: q.skillId, stuckLevel: q.level, tried: [] as StrategyId[] };
    const { strategy, prereqSkill } = nextStrategy(profile, start);
    return {
      help: {
        ...help,
        stuck: help.stuck + 1,
        episode: {
          ...start, misconception, phase: strategy, lastLevel: q.level, prereqSkill, helpedBy: null,
          prereqCorrect: 0, prereqWrong: 0, startedAt: now, attempts: 1,
        },
      },
      event: 'stuck',
    };
  }

  // Answers outside the episode (e.g. a review in another skill) don't change it.
  const onPrereq = ep.phase === 'prerequisite' && q.skillId === ep.prereqSkill;
  if (q.skillId !== ep.skillId && !onPrereq) return { help, event: null };

  const e: HelpEpisode = { ...ep, attempts: ep.attempts + 1, misconception: misconception ?? ep.misconception };
  const switchStrategy = (failed: StrategyId): { help: HelpState; event: HelpEvent } => {
    help = credit(help, failed, false);
    const next = nextStrategy(profile, { ...e, tried: [...e.tried, failed] });
    return {
      help: {
        ...help,
        episode: { ...e, tried: next.tried, phase: next.strategy, prereqSkill: next.prereqSkill, prereqCorrect: 0, prereqWrong: 0, helpedBy: null },
      },
      event: 'switched',
    };
  };
  const resolve = (by: StrategyId | null): { help: HelpState; event: HelpEvent } => {
    if (by) help = credit(help, by, true);
    return { help: { ...help, episode: null, resolved: help.resolved + 1 }, event: 'resolved' };
  };

  if (onPrereq) {
    if (correct) {
      const prereqCorrect = e.prereqCorrect + 1;
      if (prereqCorrect >= PREREQ_CORRECT_NEEDED) {
        return {
          help: { ...help, episode: { ...e, phase: 'climb', helpedBy: 'prerequisite', prereqCorrect, lastLevel: Math.max(1, e.stuckLevel - 1) as Level } },
          event: 'helped',
        };
      }
      return { help: { ...help, episode: { ...e, prereqCorrect } }, event: null };
    }
    const prereqWrong = e.prereqWrong + 1;
    if (prereqWrong >= PREREQ_WRONG_LIMIT) return switchStrategy('prerequisite');
    return { help: { ...help, episode: { ...e, prereqWrong } }, event: null };
  }

  if (e.phase === 'climb') {
    if (correct && !hinted) {
      // Every unaided success moves the climb up at least one level, even if
      // the question served was easier than planned, so the child can never
      // get trapped repeating the same level.
      const climbed = Math.max(q.level, e.lastLevel + 1);
      if (q.level >= e.stuckLevel || climbed > e.stuckLevel) return resolve(e.helpedBy);
      return { help: { ...help, episode: { ...e, lastLevel: climbed as Level } }, event: null };
    }
    if (correct) return { help: { ...help, episode: e }, event: null };
    // Slipped on the way back up: that help wasn't enough, so try a different way.
    if (e.helpedBy) return switchStrategy(e.helpedBy);
    const next = nextStrategy(profile, e);
    return { help: { ...help, episode: { ...e, phase: next.strategy, tried: next.tried, prereqSkill: next.prereqSkill } }, event: 'switched' };
  }

  // Currently helping with a strategy (not the prerequisite detour).
  if (correct) {
    if (!hinted && q.level >= e.stuckLevel) return resolve(e.phase);
    return { help: { ...help, episode: { ...e, phase: 'climb', helpedBy: e.phase, lastLevel: q.level } }, event: 'helped' };
  }
  return switchStrategy(e.phase);
}
