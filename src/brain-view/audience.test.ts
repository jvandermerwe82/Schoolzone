import { describe, expect, it } from 'vitest';
import { pupilSummary } from '../../server/classview';
import { SCENARIOS, SCENARIO_A, SCENARIO_B } from './scenarios';
import { parentCardFor, teacherCardFor, withheldTeacherCard, WITHHELD_REASON } from './audience';
import { runTrace } from './trace';
import type { TraceStepView } from './views';

const answers = (scenario = SCENARIO_A) =>
  runTrace(scenario).entries.filter((e): e is TraceStepView => e.kind === 'answer');

describe('teacher card: sharing gate', () => {
  it('shows nothing about a pupil whose parent has not shared', () => {
    const profile = runTrace(SCENARIO_A).final.profile;
    const card = teacherCardFor(profile, { homework: SCENARIO_A.homework, now: 0, shared: false });
    expect(card).toEqual(withheldTeacherCard());
    expect(card.visible).toBe(false);
    expect(card.withheldReason).toBe(WITHHELD_REASON);
    expect(card.objective).toBeNull();
    expect(card.patterns).toEqual([]);
    expect(card.answeredThisWeek).toBeNull();
    expect(JSON.stringify(card)).not.toContain('Fractions');
  });

  it('matches the existing class view for every figure they share', () => {
    for (const scenario of SCENARIOS) {
      const result = runTrace(scenario);
      const last = answers(scenario).at(-1)!;
      const now = last.at + 60_000;
      const summary = pupilSummary(result.final.profile, now, scenario.homework.canonicalNodeId);
      const card = teacherCardFor(result.final.profile, { homework: scenario.homework, now, shared: true });
      expect(card.objective!.status).toBe(summary.objectiveProgress!.status);
      expect(card.objective!.directEvidence).toBe(summary.objectiveProgress!.directEvidenceCount);
      expect(card.objective!.supportingEvidence).toBe(summary.objectiveProgress!.supportingEvidenceCount);
      expect(card.objective!.weightedSuccess).toBe(summary.objectiveProgress!.weightedSuccess);
      expect(card.objective!.confidence).toBe(summary.objectiveProgress!.confidence);
      expect(card.answeredThisWeek).toBe(summary.answeredThisWeek);
      expect(card.patterns.map((p) => p.name)).toEqual(summary.mistakes);
      expect(card.stuckNow?.skill ?? null).toBe(summary.stuck?.skill ?? null);
      expect(card.stuckNow?.level ?? null).toBe(summary.stuck?.level ?? null);
    }
  });

  it('splits direct evidence into independent and helped answers that add up', () => {
    for (const step of answers()) {
      const o = step.adults.teacher.objective!;
      expect(o.independentDirect + o.assistedDirect).toBeLessThanOrEqual(o.directEvidence);
    }
  });
});

describe('parent card', () => {
  it('describes one wrong answer as a possible slip and two as a pattern, with advice only for a pattern', () => {
    const steps = answers();
    const slip = steps.find((s) => s.result.misconceptionId && s.adults.parent.watchFor.length > 0)!;
    expect(slip.adults.parent.watchFor[0].kind).toBe('possible-slip');
    expect(slip.adults.parent.tryAtHome).toEqual([]);
    expect(slip.adults.parent.watchFor[0].line).toMatch(/slip/i);
    const pattern = steps.find((s) => s.adults.parent.watchFor.some((w) => w.kind === 'pattern'))!;
    expect(pattern.adults.parent.tryAtHome.length).toBeGreaterThan(0);
  });

  it('never calls helped results independent proof', () => {
    const profile = runTrace(SCENARIO_A).final.profile;
    const card = parentCardFor(profile, { homework: SCENARIO_A.homework, now: 1, activeNodeId: SCENARIO_A.homework.canonicalNodeId });
    expect(card.statusLine).not.toMatch(/mastered/i);
    expect(card.footer).toMatch(/never includes/i);
  });

  it('reports measured help only once it is repeated, and calls it observation', () => {
    const profile = SCENARIO_B.profile();
    const card = parentCardFor(profile, { homework: SCENARIO_B.homework, now: 0, activeNodeId: SCENARIO_B.homework.canonicalNodeId });
    expect(card.whatSeemsToHelp.length).toBeGreaterThan(0);
    for (const line of card.whatSeemsToHelp) expect(line).toMatch(/not proof/i);
  });
});

describe('both cards: privacy and tone', () => {
  it('carry no name, id, avatar, raw answer, email or em dash', () => {
    for (const scenario of SCENARIOS) {
      const result = runTrace(scenario);
      const json = JSON.stringify(answers(scenario).map((s) => s.adults));
      expect(json).not.toContain(scenario.profile().name);
      expect(json).not.toContain(scenario.profile().id);
      expect(json).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(json).not.toContain('—');
      for (const step of answers(scenario)) {
        if (step.input.given) expect(json.includes(`"${step.input.given}"`)).toBe(false);
      }
      expect(result.entries.length).toBeGreaterThan(0);
    }
  });
});
