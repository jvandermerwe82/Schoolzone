import { describe, expect, it } from 'vitest';
import { checkAnswer, hasGenerator, makeQuestion } from '../content';
import { englishSkillIds } from '../content/english';
import { MATHS_GENERATORS, simplify } from '../content/maths';
import { scienceQuestions, scienceSkillIds } from '../content/science';
import { SKILLS, getSkill } from '../content/skills';
import { newProfile } from '../storage';
import { calibration } from './insights';
import {
  bktUpdate, guessRate, initialSkillState, isMastered, levelDifficulty, predictCorrect, updateSkill,
} from './model';
import { chooseLevel, planNext, recordAnswer, skillState } from './tutor';
import { LEVELS, type Level, type Profile, type SubjectId } from './types';

/** Small seeded PRNG (mulberry32) so tests are repeatable. */
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('model', () => {
  it('predicts higher success for easier levels and stronger children', () => {
    const g = 0.05;
    expect(predictCorrect(0, 1, g)).toBeGreaterThan(predictCorrect(0, 5, g));
    expect(predictCorrect(2, 3, g)).toBeGreaterThan(predictCorrect(-2, 3, g));
    expect(predictCorrect(levelDifficulty(3), 3, 0)).toBeCloseTo(0.5);
  });

  it('BKT raises knowledge after a correct answer and lowers it after a wrong one', () => {
    const up = bktUpdate(0.5, true, 0.1, 0.1);
    const down = bktUpdate(0.5, false, 0.1, 0.1);
    expect(up).toBeGreaterThan(0.5);
    expect(down).toBeLessThan(0.5);
    // Hand-checked: posterior = 0.45/(0.45+0.05) = 0.9; plus learning 0.1*0.15 = 0.915
    expect(up).toBeCloseTo(0.915, 6);
    // posterior = 0.05/(0.05+0.45) = 0.1; plus learning 0.9*0.15 = 0.235
    expect(down).toBeCloseTo(0.235, 6);
  });

  it('a lucky multiple-choice guess counts for less than a typed answer', () => {
    const typed = bktUpdate(0.3, true, guessRate(3), 0.1);
    const mc = bktUpdate(0.3, true, guessRate(3, 4), 0.1);
    expect(typed).toBeGreaterThan(mc);
  });

  it('reaches mastery after a solid run of correct answers, and schedules a review', () => {
    let s = initialSkillState(3, 3);
    const now = 1_000_000;
    for (let i = 0; i < 12; i++) s = updateSkill(s, 4, true, guessRate(4), 3000, now);
    expect(isMastered(s)).toBe(true);
    expect(s.masteredAt).toBe(now);
    expect(s.nextReviewAt).toBe(now + 24 * 3600 * 1000);
  });

  it('only doubles the review gap when the review was actually due', () => {
    let s = initialSkillState(3, 3);
    const t0 = 0;
    for (let i = 0; i < 12; i++) s = updateSkill(s, 4, true, guessRate(4), 3000, t0);
    expect(s.reviewIntervalDays).toBe(1);
    s = updateSkill(s, 4, true, guessRate(4), 3000, t0 + 1000); // not due yet
    expect(s.reviewIntervalDays).toBe(1);
    const day = 24 * 3600 * 1000;
    s = updateSkill(s, 4, true, guessRate(4), 3000, t0 + day + 1); // due
    expect(s.reviewIntervalDays).toBe(2);
  });
});

describe('level choice', () => {
  it('gives harder levels to stronger children', () => {
    const weak = { ...initialSkillState(1, 3), ability: -2 };
    const strong = { ...initialSkillState(1, 3), ability: 3 };
    expect(chooseLevel(weak, 0.8)).toBeLessThan(chooseLevel(strong, 0.8));
  });
});

describe('maths generators', () => {
  it('always produce correct answers (checked independently)', () => {
    const rng = seeded(42);
    for (const [skillId, gen] of Object.entries(MATHS_GENERATORS)) {
      for (const level of LEVELS) {
        for (let i = 0; i < 300; i++) {
          const q = gen(level, rng);
          expect(q.skillId).toBe(skillId);
          expect(q.level).toBe(level);
          expect(checkAnswer(q, q.answer)).toBe(true);
          const m = q.prompt.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
          if (m) {
            const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
            const expected = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
            expect(Number(q.answer)).toBe(expected);
            expect(Number.isInteger(expected) && expected >= 0).toBe(true);
          }
          if (q.choices) expect(q.choices).toContain(q.answer);
        }
      }
    }
  });

  it('keeps each level within its promised range', () => {
    const rng = seeded(7);
    for (let i = 0; i < 500; i++) {
      const a1 = MATHS_GENERATORS.addition(1, rng);
      expect(Number(a1.answer)).toBeLessThanOrEqual(10);
      const a2 = MATHS_GENERATORS.addition(2, rng);
      expect(Number(a2.answer)).toBeGreaterThan(10);
      expect(Number(a2.answer)).toBeLessThanOrEqual(20);
      const s4 = MATHS_GENERATORS.subtraction(4, rng).prompt.match(/(\d+) − (\d+)/)!;
      expect(Number(s4[1]) % 10).toBeLessThan(Number(s4[2]) % 10); // needs borrowing
    }
  });

  it('checks fraction answers by value', () => {
    const q = { skillId: 'fractions', level: 5 as Level, id: 'x', prompt: '', answer: '1/2', explanation: '' };
    expect(checkAnswer(q, '2/4')).toBe(true);
    expect(checkAnswer(q, ' 1 / 2 ')).toBe(true);
    expect(checkAnswer(q, '1/3')).toBe(false);
    expect(checkAnswer(q, 'abc')).toBe(false);
    expect(simplify(6, 8)).toBe('3/4');
    expect(simplify(8, 8)).toBe('1');
  });

  it('place value rounding follows "5 rounds up"', () => {
    const rng = seeded(3);
    for (let i = 0; i < 300; i++) {
      const q = MATHS_GENERATORS['place-value'](3, rng);
      const n = Number(q.prompt.match(/Round (\d+)/)![1]);
      const expected = n % 10 >= 5 ? n - (n % 10) + 10 : n - (n % 10);
      expect(Number(q.answer)).toBe(expected);
    }
  });
});

describe('science bank', () => {
  it('every skill has questions at every level, with unique choices', () => {
    for (const id of scienceSkillIds()) {
      expect(getSkill(id).subject).toBe('science');
      const qs = scienceQuestions(id);
      for (const level of LEVELS) expect(qs.some((q) => q.level === level)).toBe(true);
      for (const q of qs) {
        expect(new Set(q.choices).size).toBe(q.choices!.length);
        expect(q.choices).toContain(q.answer);
      }
    }
  });

  it('every skill in the map has content', () => {
    const banks = new Set([...scienceSkillIds(), ...englishSkillIds()]);
    for (const s of SKILLS) expect(hasGenerator(s.id) || banks.has(s.id)).toBe(true);
  });

  it('does not repeat recently seen questions when fresh ones exist', () => {
    const rng = seeded(1);
    const recent = scienceQuestions('earth-space').slice(0, 5).map((q) => q.id);
    for (let i = 0; i < 50; i++) {
      expect(recent).not.toContain(makeQuestion('earth-space', 1, recent, rng).id);
    }
  });
});

/**
 * Simulated children: each has a hidden "true" ability per skill. We check the
 * brain discovers it, keeps success near the target, and steps back to
 * prerequisites for a child with a gap.
 */
function simulate(profile: Profile, subject: SubjectId, trueAbility: Record<string, number>, n: number, seed: number) {
  const rng = seeded(seed);
  let p = profile;
  let focus: string | null = null;
  const log: { skillId: string; reason: string; correct: boolean }[] = [];
  let now = 0;
  for (let i = 0; i < n; i++) {
    const plan = planNext(p, subject, { focus, answered: i }, now, rng);
    const q = makeQuestion(plan.skillId, plan.level, p.recentQuestionIds, rng);
    const truth = trueAbility[plan.skillId] ?? 0;
    const correct = rng() < predictCorrect(truth, q.level, guessRate(q.level, q.choices?.length));
    p = recordAnswer(p, q, correct, 4000, now).profile;
    log.push({ skillId: plan.skillId, reason: plan.reason, correct });
    focus = plan.skillId;
    now += 60_000;
  }
  return { profile: p, log };
}

describe('adaptive behaviour (simulation)', () => {
  it('estimates a child’s hidden ability and keeps success close to the target', () => {
    const errors: number[] = [];
    let correct = 0;
    let total = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const truth = -1 + (seed % 5) * 0.5; // children from weaker to stronger
      const { profile, log } = simulate(newProfile('Sim', '🙂', 2), 'maths', { 'number-sense': truth }, 40, seed);
      errors.push(Math.abs(skillState(profile, 'number-sense').ability - truth));
      const ns = log.filter((l) => l.skillId === 'number-sense').slice(10);
      correct += ns.filter((l) => l.correct).length;
      total += ns.length;
    }
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(meanError).toBeLessThan(0.8);
    const rate = correct / total;
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.92);
  });

  it('unlocks the next skill once prerequisites are known', () => {
    const strong = Object.fromEntries(SKILLS.map((s) => [s.id, 4]));
    const { profile } = simulate(newProfile('Sim', '🙂', 3), 'maths', strong, 120, 5);
    expect(isMastered(skillState(profile, 'number-sense'))).toBe(true);
    expect(skillState(profile, 'addition').attempts).toBeGreaterThan(0);
  });

  it('reports calibration of its own predictions', () => {
    const { profile } = simulate(newProfile('Sim', '🙂', 2), 'science', { 'living-things': 0.5, materials: 0.5, 'earth-space': 0.5 }, 60, 9);
    const c = calibration(profile)!;
    expect(c.answers).toBe(50);
    expect(Math.abs(c.predictedPct - c.actualPct)).toBeLessThan(20);
  });
});

describe('Year 6 focus', () => {
  it('a Year 6 child confirms foundation skills quickly and moves on to Year 6 work', () => {
    const firstY6: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      // A typical Year 6 child: secure on earlier skills, average on Year 6 ones.
      const truth = Object.fromEntries(SKILLS.map((s) => [s.id, s.typicalYear < 6 ? 3 : 0]));
      const { log } = simulate(newProfile('Sim', '🙂', 6), 'maths', truth, 80, seed);
      firstY6.push(log.findIndex((l) => getSkill(l.skillId).typicalYear === 6));
    }
    firstY6.sort((a, b) => a - b);
    const median = firstY6[Math.floor(firstY6.length / 2)];
    expect(firstY6.every((i) => i >= 0)).toBe(true);
    expect(median).toBeLessThanOrEqual(20);
  });

  it('English starts straight on Year 6 content', () => {
    const plan = planNext(newProfile('Sim', '🙂', 6), 'english', { focus: null, answered: 0 }, 0, seeded(1));
    expect(getSkill(plan.skillId).subject).toBe('english');
    expect(plan.reason).toBe('new');
  });
});
