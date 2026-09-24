import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { awardBadges, BADGES, bestDayRun, bestStreak, describeReward, formatMoney, moneyTotals, parseMoney, rewardsOwed } from './badges';
import { initialSkillState } from './model';
import type { AnswerRecord, Profile } from './types';

const DAY = 86_400_000;
const T0 = Date.parse('2026-09-01T10:00:00');
const answer = (over: Partial<AnswerRecord> = {}): AnswerRecord =>
  ({ at: T0, skillId: 'addition', level: 2, correct: true, timeMs: 5000, predicted: 0.8, ...over });
const mastered = { ...initialSkillState(6, 6), pKnown: 0.99, ability: 3, attempts: 10, correct: 10 };

describe('badges', () => {
  it('every badge has a unique id and a suggestion for parents', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) expect(b.suggestion.length).toBeGreaterThan(0);
    expect(BADGES.filter((b) => b.hidden).length).toBeGreaterThanOrEqual(3);
  });

  it('a new learner has none, and must have rewards set up by a parent', () => {
    const p = newProfile('Ava', '🦊', 6);
    expect(p.rewardsSetUp).toBe(false);
    expect(awardBadges(p, T0).earned).toEqual([]);
  });

  it('counts streaks without hints, and days in a row', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = { ...p, history: [answer(), answer(), answer({ hinted: true }), answer(), answer(), answer()] };
    expect(bestStreak(p)).toBe(3);
    p = { ...p, history: [0, 1, 2, 4, 5].map((d) => answer({ at: T0 + d * DAY })) };
    expect(bestDayRun(p)).toBe(3);
  });

  it('awards each badge once, when earned, and never takes it away', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = { ...p, history: Array.from({ length: 5 }, () => answer()), skills: { addition: { ...initialSkillState(6, 1), attempts: 5 } } };
    let r = awardBadges(p, T0);
    expect(r.earned).toEqual(['hot-streak']);
    r = awardBadges(r.profile, T0 + 1);
    expect(r.earned).toEqual([]);
    const lost = { ...r.profile, history: [answer({ correct: false })] };
    expect(awardBadges(lost, T0 + 2).profile.badges['hot-streak'].earnedAt).toBe(T0);
  });

  it('switched-off badges are not awarded', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = { ...p, rewards: { 'hot-streak': { reward: '', enabled: false, moneyCents: 0 } }, history: Array.from({ length: 5 }, () => answer()) };
    expect(awardBadges(p, T0).earned).not.toContain('hot-streak');
  });

  it('level badges: mastering every Year 6 English skill', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    const skills = Object.fromEntries(['spelling-words', 'spelling-patterns', 'homophones', 'grammar-y6', 'punctuation-y6'].map((id) => [id, mastered]));
    p = { ...p, skills };
    const { earned } = awardBadges(p, T0);
    expect(earned).toContain('english-champion');
    expect(earned).toContain('star-learner');
    expect(earned).not.toContain('maths-champion');
  });

  it('Easter eggs: comeback, bug squasher and all-rounder', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = {
      ...p,
      help: { ...p.help, resolved: 1 },
      misconceptions: { 'add-no-carry': { strength: 0.2, seen: 2, lastSeen: T0, fixedAt: T0, skills: ['addition'] } },
      history: [answer({ skillId: 'addition' }), answer({ skillId: 'homophones' }), answer({ skillId: 'light-y6', correct: false })],
    };
    const { earned } = awardBadges(p, T0);
    expect(earned).toEqual(expect.arrayContaining(['comeback-kid', 'bug-squasher', 'all-rounder']));
  });

  it('lists rewards owed until a parent marks them given', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = {
      ...p,
      rewards: { 'hot-streak': { reward: '  Ice cream  ', enabled: true, moneyCents: 0 }, 'first-steps': { reward: '', enabled: true, moneyCents: 0 } },
      badges: { 'hot-streak': { earnedAt: T0, rewardGiven: false, moneyCents: 0 }, 'first-steps': { earnedAt: T0, rewardGiven: false, moneyCents: 0 } },
    };
    expect(rewardsOwed(p).map((r) => [r.badge.id, r.reward])).toEqual([['hot-streak', 'Ice cream']]);
    p = { ...p, badges: { ...p.badges, 'hot-streak': { earnedAt: T0, rewardGiven: true, moneyCents: 0 } } };
    expect(rewardsOwed(p)).toEqual([]);
  });

  it('reads and formats money amounts exactly', () => {
    expect(parseMoney('2')).toBe(200);
    expect(parseMoney('2.5')).toBe(250);
    expect(parseMoney('£1.05')).toBe(105);
    expect(parseMoney('R 10')).toBe(1000);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(formatMoney(250, '£')).toBe('£2.50');
    expect(formatMoney(5, 'R')).toBe('R0.05');
  });

  it('badges can be worth money, fixed when earned, and tracked until paid', () => {
    let p: Profile = newProfile('Ava', '🦊', 6);
    p = {
      ...p,
      currency: 'R',
      rewards: { 'hot-streak': { reward: 'Ice cream', enabled: true, moneyCents: 500 }, 'first-steps': { reward: '', enabled: true, moneyCents: 250 } },
      history: Array.from({ length: 10 }, () => answer()),
      skills: { addition: { ...initialSkillState(6, 1), attempts: 10 } },
    };
    p = awardBadges(p, T0).profile;
    expect(describeReward(p, 'hot-streak')).toBe('Ice cream + R5.00');
    expect(describeReward(p, 'first-steps')).toBe('R2.50');
    // Changing the amount later doesn't change what was already earned.
    p = { ...p, rewards: { ...p.rewards, 'hot-streak': { reward: 'Ice cream', enabled: true, moneyCents: 10_000 } } };
    expect(moneyTotals(p)).toEqual({ earned: 750, paid: 0, owed: 750 });
    p = { ...p, badges: { ...p.badges, 'first-steps': { ...p.badges['first-steps'], rewardGiven: true } } };
    expect(moneyTotals(p)).toEqual({ earned: 750, paid: 250, owed: 500 });
    expect(rewardsOwed(p).map((r) => r.badge.id)).toEqual(['hot-streak']);
  });
});
