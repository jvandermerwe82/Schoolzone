import { describe, expect, it } from 'vitest';
import { makeQuestion } from '../content';
import { addNoCarry, classifySpelling, ignoreBrackets, leftToRight, subBorrowNoDecrement, subSmallerFromLarger } from '../content/bugs';
import { MATHS_GENERATORS } from '../content/maths';
import { MATHS_Y6_GENERATORS } from '../content/maths-y6';
import { englishQuestions, englishSkillIds } from '../content/english';
import { scienceQuestions, scienceSkillIds } from '../content/science';
import { getSkill } from '../content/skills';
import { newProfile } from '../storage';
import { nextStrategy, STRATEGIES } from './help';
import { itemKey, type ItemStats } from './items';
import { ACTIVE, allMisconceptionIds, diagnose, getMisconception } from './misconceptions';
import { guessRate, initialSkillState, levelDifficulty, predictCorrect } from './model';
import { planNext, recordAnswer, skillState, type Plan } from './tutor';
import { LEVELS, type Level, type Profile, type StrategyId, type SubjectId } from './types';

function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOW = 20_000; // answer time well above the rapid-guess threshold

describe('mistake patterns', () => {
  it('reproduce the classic errors exactly', () => {
    expect(addNoCarry(47, 38)).toBe(75); // correct 85
    expect(subSmallerFromLarger(52, 27)).toBe(35); // correct 25 (Brown & Burton's smaller-from-larger)
    expect(subBorrowNoDecrement(41, 17)).toBe(34); // correct 24
    expect(leftToRight([3, '+', 4, '×', 5])).toBe(35); // correct 23
    expect(ignoreBrackets([2, '×', '(', 9, '−', 4, ')', '+', 1])).toBe(15); // correct 11
  });

  it('classify spelling mistakes', () => {
    expect(classifySpelling('receive', 'recieve')).toBe('spell-ie-ei');
    expect(classifySpelling('accommodate', 'accomodate')).toBe('spell-missed-double');
    expect(classifySpelling('harass', 'harrass')).toBe('spell-extra-double');
    expect(classifySpelling('doubt', 'dout')).toBe('spell-missing-letter');
    expect(classifySpelling('develop', 'develope')).toBe('spell-extra-letter');
    expect(classifySpelling('definite', 'definate')).toBe('spell-vowel-choice');
    expect(classifySpelling('language', 'langauge')).toBe('spell-letter-order');
    expect(classifySpelling('vicious', 'vitious')).toBe('spell-cious-tious');
    expect(classifySpelling('partial', 'parcial')).toBe('spell-cial-tial');
    expect(classifySpelling('possible', 'possable')).toBe('spell-able-ible');
    expect(classifySpelling('observant', 'observent')).toBe('spell-ant-ent');
    expect(classifySpelling('noticeable', 'noticable')).toBe('spell-keep-e');
    expect(classifySpelling('preferred', 'prefered')).toBe('spell-fer-doubling');
    expect(classifySpelling('soldier', 'soljer')).toBe('spell-phonetic');
  });

  it('every mistake answer attached to a generated question is wrong, and is diagnosed', () => {
    const rng = seeded(3);
    const gens = { ...MATHS_GENERATORS, ...MATHS_Y6_GENERATORS };
    let withBugs = 0;
    for (const gen of Object.values(gens)) {
      for (const level of LEVELS) {
        for (let i = 0; i < 200; i++) {
          const q = gen(level, rng);
          expect(diagnose(q, q.answer, true)).toBeNull();
          for (const [id, wrong] of q.bugs ?? []) {
            expect(getMisconception(id).name).not.toBe(id); // every id is in the catalogue
            expect(diagnose(q, wrong, false), `${q.prompt} / ${id}`).toBe(id);
            withBugs++;
          }
          expect(diagnose(q, 'not a number', false)).toBeNull();
        }
      }
    }
    expect(withBugs).toBeGreaterThan(10_000);
  });

  it('every tagged bank question uses a known misconception', () => {
    const known = new Set(allMisconceptionIds());
    const qs = [...englishSkillIds().flatMap(englishQuestions), ...scienceSkillIds().flatMap(scienceQuestions)];
    let tagged = 0;
    for (const q of qs) {
      for (const [id, wrong] of q.bugs ?? []) {
        expect(q.choices).toContain(wrong);
        expect(wrong).not.toBe(q.answer);
        expect(known.has(id) || id.startsWith('homophone:'), id).toBe(true);
        tagged++;
      }
    }
    expect(tagged).toBeGreaterThan(300);
  });

  it('can pick a question that tests a given misconception', () => {
    const rng = seeded(8);
    for (let i = 0; i < 20; i++) {
      const q = makeQuestion('addition', 4, [], rng, 'add-no-carry');
      expect(q.bugs?.some(([id]) => id === 'add-no-carry')).toBe(true);
      const s = makeQuestion('evolution-inheritance', 2, [], rng, 'sci-camel-water');
      expect(s.bugs?.some(([id]) => id === 'sci-camel-water')).toBe(true);
    }
  });
});

describe('misconception tracking', () => {
  it('becomes active when repeated, and is marked fixed once the child stops making it', () => {
    let p = newProfile('Sim', '🙂', 3);
    const rng = seeded(1);
    const q1 = makeQuestion('addition', 4, [], rng, 'add-no-carry');
    const bug = q1.bugs!.find(([id]) => id === 'add-no-carry')![1];
    p = recordAnswer(p, q1, false, SLOW, 0, { given: bug }).profile;
    expect(p.misconceptions['add-no-carry'].strength).toBeLessThan(ACTIVE); // one slip is not yet a pattern
    const q2 = makeQuestion('addition', 4, [], rng, 'add-no-carry');
    p = recordAnswer(p, q2, false, SLOW, 1, { given: q2.bugs!.find(([id]) => id === 'add-no-carry')![1] }).profile;
    expect(p.misconceptions['add-no-carry'].strength).toBeGreaterThanOrEqual(ACTIVE);
    for (let t = 2; t < 6; t++) {
      const q = makeQuestion('addition', 4, [], rng, 'add-no-carry');
      p = recordAnswer(p, q, true, SLOW, t, { given: q.answer }).profile;
    }
    expect(p.misconceptions['add-no-carry'].strength).toBeLessThan(ACTIVE);
    expect(p.misconceptions['add-no-carry'].fixedAt).not.toBeNull();
  });
});

/** Answer the planned question, simulating a child. */
function play(p: Profile, plan: Plan, rng: () => number, correct: boolean, items: ItemStats = {}) {
  const q = makeQuestion(plan.skillId, plan.level, p.recentQuestionIds, rng, plan.target);
  const given = correct ? q.answer : q.bugs?.[0]?.[1] ?? 'wrong';
  return { q, ...recordAnswer(p, q, correct, SLOW, 0, { given, hinted: !!plan.showHint, strategy: plan.strategy, items }) };
}

describe('when a child is stuck', () => {
  it('stays on the problem, switching to a different way of helping after each miss', () => {
    const rng = seeded(4);
    let p = newProfile('Sim', '🙂', 6);
    p = { ...p, skills: { subtraction: { ...initialSkillState(6, 2), ability: 1 } } };
    // Get a subtraction question wrong: an episode starts.
    let r = play(p, { skillId: 'subtraction', level: 4, reason: 'continue', message: '' }, rng, false);
    expect(r.event).toBe('stuck');
    p = r.profile;
    const strategies: string[] = [];
    for (let i = 0; i < 4; i++) {
      const plan = planNext(p, 'maths', { focus: 'subtraction', answered: i + 1 }, 0, rng);
      expect(plan.reason).toBe('help');
      strategies.push(plan.strategy!);
      // A prerequisite detour is allowed; otherwise the child stays on subtraction.
      if (plan.strategy !== 'prerequisite') expect(plan.skillId).toBe('subtraction');
      if (plan.strategy === 'prerequisite') break;
      r = play(p, plan, rng, false);
      expect(r.event).toBe('switched');
      p = r.profile;
    }
    expect(new Set(strategies).size).toBe(strategies.length); // a different way each time
  });

  it('only counts the problem as solved once the child can do it on their own at that level', () => {
    const rng = seeded(5);
    let p = newProfile('Sim', '🙂', 6);
    let r = play(p, { skillId: 'addition', level: 4, reason: 'continue', message: '' }, rng, false);
    p = r.profile;
    const stuckLevel = p.help.episode!.stuckLevel;
    const events: string[] = [];
    for (let i = 0; i < 10 && p.help.episode; i++) {
      const plan = planNext(p, 'maths', { focus: 'addition', answered: i + 1 }, 0, rng);
      expect(plan.skillId).toBe(plan.strategy === 'prerequisite' ? plan.skillId : 'addition');
      r = play(p, plan, rng, true);
      events.push(r.event ?? '-');
      if (r.event === 'resolved') expect(r.q.level).toBeGreaterThanOrEqual(stuckLevel);
      p = r.profile;
    }
    expect(events.at(-1)).toBe('resolved');
    expect(p.help.resolved).toBe(1);
    // The way of helping that led to solving it gets the credit.
    expect(Object.values(p.help.strategies).some((st) => st!.helped === 1)).toBe(true);
  });

  it('tries a different way if the child slips again on the way back up', () => {
    const rng = seeded(15);
    let p = newProfile('Sim', '🙂', 6);
    p = play(p, { skillId: 'algebra', level: 4, reason: 'continue', message: '' }, rng, false).profile;
    let plan = planNext(p, 'maths', { focus: 'algebra', answered: 1 }, 0, rng);
    const first = plan.strategy as StrategyId;
    // Force an easier question so the child is helped but hasn't solved it yet.
    let r = play(p, { ...plan, level: 1 }, rng, true);
    expect(r.event).toBe('helped');
    plan = planNext(r.profile, 'maths', { focus: 'algebra', answered: 2 }, 0, rng);
    expect(plan.reason).toBe('climb');
    r = play(r.profile, plan, rng, false); // slips on the way back up
    expect(r.event).toBe('switched');
    plan = planNext(r.profile, 'maths', { focus: 'algebra', answered: 3 }, 0, rng);
    expect(plan.strategy).not.toBe(first);
    expect(r.profile.help.strategies[first]).toEqual({ tried: 1, helped: 0 });
  });

  it('never gives up: with a child who keeps missing, it cycles through every way of helping', () => {
    const rng = seeded(6);
    let p = newProfile('Sim', '🙂', 6);
    p = play(p, { skillId: 'fractions-y6', level: 3, reason: 'continue', message: '' }, rng, false).profile;
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const plan = planNext(p, 'maths', { focus: 'fractions-y6', answered: i }, 0, rng);
      expect(plan.reason).toBe('help');
      seen.add(plan.strategy!);
      p = play(p, plan, rng, false).profile;
      expect(p.help.episode).not.toBeNull();
    }
    for (const s of STRATEGIES) expect(seen.has(s), s).toBe(true);
  });

  it('picks the prerequisite back up and then returns to the original problem', () => {
    const rng = seeded(7);
    let p = newProfile('Sim', '🙂', 6);
    // Only the prerequisite strategy has worked before for this child.
    p = { ...p, help: { ...p.help, strategies: { prerequisite: { tried: 5, helped: 5 }, similar: { tried: 5, helped: 0 } } } };
    p = { ...p, skills: { multiplication: { ...initialSkillState(6, 3), pKnown: 0.85, ability: 0.5 }, division: { ...initialSkillState(6, 3), pKnown: 0.85, ability: 0.5 } } };
    p = play(p, { skillId: 'fractions', level: 3, reason: 'continue', message: '' }, rng, false).profile;
    let plan = planNext(p, 'maths', { focus: 'fractions', answered: 1 }, 0, rng);
    expect(plan.strategy).toBe('prerequisite');
    expect(getSkill('fractions').prerequisites).toContain('division');
    const detour = plan.skillId;
    expect(detour).not.toBe('fractions');
    p = play(p, plan, rng, true).profile;
    plan = planNext(p, 'maths', { focus: detour, answered: 2 }, 0, rng);
    expect(plan.skillId).toBe(detour);
    const r = play(p, plan, rng, true);
    expect(r.event).toBe('helped');
    plan = planNext(r.profile, 'maths', { focus: detour, answered: 3 }, 0, rng);
    expect(plan.skillId).toBe('fractions');
    expect(plan.reason).toBe('climb');
  });

  it('picks up an unfinished problem in the next session', () => {
    const rng = seeded(9);
    let p = newProfile('Sim', '🙂', 6);
    p = play(p, { skillId: 'algebra', level: 3, reason: 'continue', message: '' }, rng, false).profile;
    const plan = planNext(p, 'maths', { focus: null, answered: 0 }, 1e12, rng);
    expect(plan.skillId).toBe('algebra');
    expect(plan.message).toMatch(/Last time Algebra was tricky/);
  });

  it('learns which way of helping works best for this child', () => {
    // A simulated child who only really learns from worked examples.
    const rng = seeded(10);
    let p = newProfile('Sim', '🙂', 6);
    for (let episode = 0; episode < 12; episode++) {
      p = play(p, { skillId: 'order-of-operations', level: 4, reason: 'continue', message: '' }, rng, false).profile;
      for (let i = 0; i < 30 && p.help.episode; i++) {
        const plan = planNext(p, 'maths', { focus: 'order-of-operations', answered: i + 1 }, 0, rng);
        const pCorrect = plan.workedExample || plan.strategy === 'climb' ? 0.9 : 0.1;
        p = play(p, plan, rng, rng() < pCorrect).profile;
      }
    }
    const first = nextStrategy(p, { skillId: 'order-of-operations', stuckLevel: 4, tried: [] }).strategy;
    expect(first).toBe('worked-example');
    const we = p.help.strategies['worked-example']!;
    expect(we.helped / we.tried).toBeGreaterThan(0.6);
  });
});

describe('learning from how the child answers', () => {
  it('a hinted correct answer counts for less than an unaided one', () => {
    const rng = seeded(11);
    const p = newProfile('Sim', '🙂', 6);
    const q = makeQuestion('algebra', 3, [], rng);
    const plain = recordAnswer(p, q, true, SLOW, 0, { given: q.answer }).profile;
    const hinted = recordAnswer(p, q, true, SLOW, 0, { given: q.answer, hinted: true }).profile;
    expect(skillState(hinted, 'algebra').ability).toBeLessThan(skillState(plain, 'algebra').ability);
    expect(skillState(hinted, 'algebra').pKnown).toBeLessThan(skillState(plain, 'algebra').pKnown);
  });

  it('treats a very fast wrong answer as a guess, not as being stuck', () => {
    const rng = seeded(12);
    const p = newProfile('Sim', '🙂', 6);
    const q = makeQuestion('algebra', 3, [], rng);
    const fast = recordAnswer(p, q, false, 300, 0, { given: '1' });
    const slow = recordAnswer(p, q, false, SLOW, 0, { given: '1' });
    expect(fast.rapid).toBe(true);
    expect(fast.profile.help.episode).toBeNull();
    expect(slow.profile.help.episode).not.toBeNull();
    expect(skillState(fast.profile, 'algebra').ability).toBeGreaterThan(skillState(slow.profile, 'algebra').ability);
  });

  it('learns how hard each level really is from answers, and predicts better', () => {
    // The real difficulties differ from the assumed ones.
    const trueExtra: Record<number, number> = { 1: -0.6, 2: 0.5, 3: -0.3, 4: 0.9, 5: -0.5 };
    const rng = seeded(13);
    let items: ItemStats = {};
    let lossTuned = 0, lossFixed = 0, n = 0;
    for (let child = 0; child < 40; child++) {
      const ability = -1 + rng() * 2;
      let p = newProfile('Sim', '🙂', 6);
      p = { ...p, skills: { algebra: { ...initialSkillState(6, 6), ability } } };
      for (let i = 0; i < 25; i++) {
        const level = LEVELS[Math.floor(rng() * 5)] as Level;
        const q = makeQuestion('algebra', level, [], rng);
        const truth = predictCorrect(ability, level, guessRate(level), trueExtra[level]);
        const correct = rng() < truth;
        const st = skillState(p, 'algebra');
        const fixed = predictCorrect(st.ability, level, guessRate(level));
        const r = recordAnswer(p, q, correct, SLOW, 0, { given: correct ? q.answer : 'x', items });
        if (child >= 20) {
          const ll = (pr: number) => -Math.log(correct ? pr : 1 - pr);
          lossTuned += ll(r.predicted);
          lossFixed += ll(fixed);
          n++;
        }
        // Keep each simulated child's ability fixed so only item difficulty is learned here.
        p = { ...r.profile, skills: { algebra: { ...r.profile.skills.algebra, ability, pKnown: 0.5 } }, help: { ...r.profile.help, episode: null } };
        items = r.items;
      }
    }
    const learned = (l: number) => items[itemKey({ id: '', skillId: 'algebra', level: l as Level })].offset;
    const meanTrue = Object.values(trueExtra).reduce((a, b) => a + b, 0) / 5;
    // Direction of every level's learned difficulty matches reality.
    for (const l of LEVELS) expect(Math.sign(learned(l)), `level ${l}`).toBe(Math.sign(trueExtra[l] - meanTrue));
    expect(lossTuned / n).toBeLessThan(lossFixed / n);
    expect(levelDifficulty(3)).toBe(0);
  });
});

describe('simulated classroom', () => {
  it('a child with a real misconception is diagnosed, helped, and ends up fixing it', () => {
    // This child forgets to carry until they have seen a couple of worked
    // examples or explanations of the mistake.
    const rng = seeded(21);
    let p = newProfile('Sim', '🙂', 3);
    p = { ...p, skills: { addition: { ...initialSkillState(3, 1), ability: 0.5 }, 'number-sense': { ...initialSkillState(3, 1), pKnown: 0.99, ability: 3 } } };
    let lessons = 0;
    let focus: string | null = 'addition';
    for (let i = 0; i < 80; i++) {
      const plan = planNext(p, 'maths' as SubjectId, { focus, answered: i }, i, rng);
      if (plan.strategy && plan.strategy !== 'climb') lessons++;
      const q = makeQuestion(plan.skillId, plan.level, p.recentQuestionIds, rng, plan.target);
      const carryBug = q.bugs?.find(([id]) => id === 'add-no-carry');
      const stillConfused = lessons < 3;
      const correct = carryBug && stillConfused ? false : rng() < 0.9;
      // Only the confused phase produces the carrying mistake; later slips are random.
      const given = correct ? q.answer : carryBug && stillConfused ? carryBug[1] : 'x';
      p = recordAnswer(p, q, correct, SLOW, i, { given, hinted: !!plan.showHint, strategy: plan.strategy }).profile;
      focus = plan.skillId;
    }
    const m = p.misconceptions['add-no-carry'];
    expect(m.seen).toBeGreaterThanOrEqual(2); // it noticed the pattern
    expect(m.fixedAt).not.toBeNull(); // and noticed when it stopped
    expect(m.strength).toBeLessThan(ACTIVE);
    expect(p.help.resolved).toBeGreaterThanOrEqual(1);
    // And it kept moving forward afterwards rather than sitting on easy questions.
    const lastLevels = p.history.slice(-10).map((h) => h.level);
    expect(Math.max(...lastLevels)).toBeGreaterThanOrEqual(3);
  });
});
