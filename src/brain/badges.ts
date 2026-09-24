/**
 * Badges: earned for reaching levels and for achievements. Some are hidden
 * "Easter eggs" whose name and description stay secret until unlocked.
 * A parent decides what each badge is worth (see Profile.rewards).
 */
import { SKILLS } from '../content/skills';
import { isMastered } from './model';
import type { Profile, SubjectId } from './types';

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  /** How to earn it, shown to the child (unless hidden and not yet earned). */
  description: string;
  /** Easter egg: shown as a mystery until earned. */
  hidden?: boolean;
  /** Suggested reward shown to parents as an example (never applied automatically). */
  suggestion: string;
  earned: (p: Profile) => boolean;
}

/** Local calendar day of a timestamp, e.g. "2026-09-24". */
const day = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Longest run of unaided correct answers. */
export function bestStreak(p: Profile): number {
  let best = 0, run = 0;
  for (const h of p.history) {
    run = h.correct && !h.hinted ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

const answered = (p: Profile) => Object.values(p.skills).reduce((a, s) => a + s.attempts, 0);
const masteredCount = (p: Profile) => Object.values(p.skills).filter(isMastered).length;
const practiceDays = (p: Profile) => new Set(p.history.map((h) => day(h.at)));

/** Most consecutive calendar days with practice. */
export function bestDayRun(p: Profile): number {
  const days = [...practiceDays(p)].sort();
  let best = 0, run = 0, prev: number | null = null;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00`);
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

const year6Skills = (subject: SubjectId) => SKILLS.filter((s) => s.subject === subject && s.typicalYear === 6);
const masteredAllYear6 = (p: Profile, subject: SubjectId) =>
  year6Skills(subject).every((s) => p.skills[s.id] && isMastered(p.skills[s.id]));

export const BADGES: Badge[] = [
  { id: 'first-steps', emoji: '🌱', name: 'First Steps', description: 'Answer your first 10 questions.',
    suggestion: 'A sticker', earned: (p) => answered(p) >= 10 },
  { id: 'hot-streak', emoji: '🔥', name: 'Hot Streak', description: 'Get 5 right in a row without a hint.',
    suggestion: 'Choose what\'s for pudding', earned: (p) => bestStreak(p) >= 5 },
  { id: 'unstoppable', emoji: '☄️', name: 'Unstoppable', description: 'Get 15 right in a row without a hint.',
    suggestion: '15 minutes of extra screen time', earned: (p) => bestStreak(p) >= 15 },
  { id: 'first-mastery', emoji: '⭐', name: 'First Mastery', description: 'Master your first skill.',
    suggestion: 'Stay up 15 minutes later', earned: (p) => masteredCount(p) >= 1 },
  { id: 'star-learner', emoji: '🌟', name: 'Star Learner', description: 'Master 5 skills.',
    suggestion: 'A trip to the park', earned: (p) => masteredCount(p) >= 5 },
  { id: 'summit', emoji: '🏔️', name: 'Summit', description: 'Get a level-5 question right without a hint.',
    suggestion: 'Pick a film for movie night', earned: (p) => p.history.some((h) => h.level === 5 && h.correct && !h.hinted) },
  { id: 'regular', emoji: '📅', name: 'Regular', description: 'Practise on 3 different days.',
    suggestion: 'A small treat', earned: (p) => practiceDays(p).size >= 3 },
  { id: 'week-warrior', emoji: '🗓️', name: 'Week Warrior', description: 'Practise 7 days in a row.',
    suggestion: 'A day out of your choice', earned: (p) => bestDayRun(p) >= 7 },
  { id: 'century', emoji: '💯', name: 'Century', description: 'Answer 100 questions.',
    suggestion: 'A new book', earned: (p) => answered(p) >= 100 },
  { id: 'marathon', emoji: '🏃', name: 'Marathon', description: 'Answer 500 questions.',
    suggestion: 'A bigger treat', earned: (p) => answered(p) >= 500 },
  { id: 'maths-champion', emoji: '🧮', name: 'Year 6 Maths Champion', description: 'Master every Year 6 maths skill.',
    suggestion: 'Something special', earned: (p) => masteredAllYear6(p, 'maths') },
  { id: 'english-champion', emoji: '📖', name: 'Year 6 English Champion', description: 'Master every Year 6 English skill.',
    suggestion: 'Something special', earned: (p) => masteredAllYear6(p, 'english') },
  { id: 'science-champion', emoji: '🔬', name: 'Year 6 Science Champion', description: 'Master every Year 6 science skill.',
    suggestion: 'Something special', earned: (p) => masteredAllYear6(p, 'science') },
  // Easter eggs
  { id: 'comeback-kid', emoji: '💪', name: 'Comeback Kid', hidden: true, description: 'Get stuck on a problem, then crack it on your own.',
    suggestion: 'A high five and a treat', earned: (p) => (p.help?.resolved ?? 0) >= 1 },
  { id: 'never-give-up', emoji: '🧗', name: 'Never Give Up', hidden: true, description: 'Work through 5 tricky problems.',
    suggestion: 'Choose a family activity', earned: (p) => (p.help?.resolved ?? 0) >= 5 },
  { id: 'bug-squasher', emoji: '🐛', name: 'Bug Squasher', hidden: true, description: 'Stop making a mistake you used to make.',
    suggestion: 'A small treat', earned: (p) => Object.values(p.misconceptions ?? {}).some((m) => m.fixedAt !== null) },
  { id: 'all-rounder', emoji: '🎨', name: 'All-Rounder', hidden: true, description: 'Practise maths, English and science on the same day.',
    suggestion: 'Pick tonight\'s dinner', earned: (p) => {
      const subjectsByDay = new Map<string, Set<string>>();
      for (const h of p.history) {
        const subject = SKILLS.find((s) => s.id === h.skillId)?.subject;
        if (!subject) continue;
        const d = day(h.at);
        subjectsByDay.set(d, (subjectsByDay.get(d) ?? new Set()).add(subject));
      }
      return [...subjectsByDay.values()].some((s) => s.size >= 3);
    } },
];

export function getBadge(id: string): Badge {
  const b = BADGES.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown badge: ${id}`);
  return b;
}

export function isEnabled(p: Profile, id: string): boolean {
  return p.rewards?.[id]?.enabled ?? true;
}

/**
 * Award any newly earned badges. Returns the updated profile and the ids of
 * badges earned just now. Badges are never taken away.
 */
export function awardBadges(p: Profile, now: number): { profile: Profile; earned: string[] } {
  const earned = BADGES.filter((b) => !p.badges?.[b.id] && isEnabled(p, b.id) && b.earned(p)).map((b) => b.id);
  if (earned.length === 0) return { profile: p, earned };
  const badges = { ...(p.badges ?? {}) };
  for (const id of earned) badges[id] = { earnedAt: now, rewardGiven: false };
  return { profile: { ...p, badges }, earned };
}

/** Rewards earned but not yet marked as given by a parent. */
export function rewardsOwed(p: Profile): { badge: Badge; reward: string; earnedAt: number }[] {
  return Object.entries(p.badges ?? {})
    .filter(([id, b]) => !b.rewardGiven && (p.rewards?.[id]?.reward ?? '').trim())
    .map(([id, b]) => ({ badge: getBadge(id), reward: p.rewards[id].reward.trim(), earnedAt: b.earnedAt }))
    .sort((a, b) => a.earnedAt - b.earnedAt);
}
