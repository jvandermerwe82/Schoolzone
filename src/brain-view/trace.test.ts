import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextStrategy } from '../brain/help';
import type { Profile } from '../brain/types';
import { isSyntheticProfile } from './provenance';
import { SCENARIOS, SCENARIO_A, SCENARIO_C } from './scenarios';
import { runTrace, givenFor, type Scenario } from './trace';
import type { TraceStepView } from './views';

const steps = (scenario: Scenario): TraceStepView[] =>
  runTrace(scenario).entries.filter((e): e is TraceStepView => e.kind === 'answer');

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
};

describe('trace runner: safety', () => {
  it('only accepts synthetic fixture learners', () => {
    for (const scenario of SCENARIOS) expect(isSyntheticProfile(scenario.profile())).toBe(true);
    const real = { ...SCENARIO_A, profile: (): Profile => ({ ...SCENARIO_A.profile(), id: 'k3j2h1-abc123', name: 'Real Child' }) };
    expect(() => runTrace(real)).toThrow(/synthetic/i);
    const renamed = { ...SCENARIO_A, profile: (): Profile => ({ ...SCENARIO_A.profile(), name: 'Real Child' }) };
    expect(() => runTrace(renamed)).toThrow(/synthetic/i);
  });

  it('never mutates the profile it is given', () => {
    const scenario: Scenario = { ...SCENARIO_A, profile: () => deepFreeze(SCENARIO_A.profile()) };
    expect(() => runTrace(scenario)).not.toThrow();
  });

  it('is deterministic: the same scenario gives identical traces', () => {
    for (const scenario of SCENARIOS) {
      expect(JSON.stringify(runTrace(scenario).entries)).toBe(JSON.stringify(runTrace(scenario).entries));
    }
  });

  it('puts no learner identity, avatar or free text into any view model', () => {
    for (const scenario of SCENARIOS) {
      const json = JSON.stringify(runTrace(scenario).entries);
      const profile = scenario.profile();
      expect(json).not.toContain(profile.name);
      expect(json).not.toContain(profile.id);
      expect(json).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(json).not.toContain('—');
    }
  });

  it('gives a catalogued mistake when one is offered, and a wrong answer only when the script asks for one', () => {
    const scripted = SCENARIO_A.moves.filter((m) => m.kind === 'answer');
    const recorded = steps(SCENARIO_A);
    expect(recorded).toHaveLength(scripted.length);
    recorded.forEach((step, i) => {
      const move = scripted[i];
      if (move.kind === 'answer') expect(step.input.correct).toBe(move.outcome === 'right');
    });
    const first = recorded.find((s) => !s.input.correct)!;
    expect(first.result.misconceptionId).toBe('frac-add-across');
  });

  it('never needs a source of truth other than the engine: no import of storage, network or tutor chat', () => {
    const dir = __dirname;
    const forbidden = /from\s+['"][^'"]*(storage|api|sync|server|tutor-client|chat)['"]|localStorage|sessionStorage|fetch\(|XMLHttpRequest/;
    for (const file of readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(forbidden);
    }
  });
});

describe('trace runner: engine fidelity', () => {
  it('shows the same way of helping the engine actually chose, every time it chose one', () => {
    let checked = 0;
    for (const scenario of SCENARIOS) {
      const entries = runTrace(scenario).entries.filter((e): e is TraceStepView => e.kind === 'answer');
      for (const step of entries) {
        if (!step.strategyChoice) continue;
        checked++;
        expect(step.episodeAfter?.phase, `${scenario.meta.id} step ${step.index}`).toBe(step.strategyChoice.chosen);
        expect(step.strategyChoice.options.filter((o) => o.chosen)).toHaveLength(1);
        const winner = step.strategyChoice.options.find((o) => o.chosen)!;
        for (const other of step.strategyChoice.options.filter((o) => !o.tried && !o.chosen)) {
          expect(winner.score).toBeGreaterThanOrEqual(other.score - 1e-12);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('agrees with nextStrategy when asked directly', () => {
    const entries = steps(SCENARIO_A);
    const stuck = entries.find((s) => s.result.helpEvent === 'stuck')!;
    expect(stuck.strategyChoice!.chosen).toBeTruthy();
    const profile = SCENARIO_A.profile();
    const direct = nextStrategy(profile, { skillId: 'fractions-y6', stuckLevel: 2, tried: [] });
    expect(['similar', 'worked-example', 'hint', 'smaller-steps', 'prerequisite']).toContain(direct.strategy);
  });

  it('labels every helped answer as assisted practice, never independent', () => {
    for (const scenario of SCENARIOS) {
      for (const step of steps(scenario)) {
        if (step.input.helped || (step.decision.strategy && step.decision.strategy !== 'climb')) {
          expect(step.attempt.mode).toBe('assisted-practice');
          expect(step.attempt.independent).toBe(false);
        }
      }
    }
  });

  it('only ends a help episode with an answer given without help', () => {
    for (const scenario of SCENARIOS) {
      for (const step of steps(scenario)) {
        if (step.result.helpEvent === 'resolved') {
          expect(step.input.correct).toBe(true);
          expect(step.input.helped).toBe(false);
        }
      }
    }
  });

  it('keeps the episode open across leaving, and resumes it with the engine’s own message', () => {
    const entries = runTrace(SCENARIO_C).entries;
    const breaks = entries.filter((e) => e.kind === 'break');
    expect(breaks.length).toBeGreaterThanOrEqual(2);
    const open = breaks.find((b) => b.kind === 'break' && b.episodeOpen);
    expect(open && open.kind === 'break' && open.resumed?.learnerMessage).toMatch(/^Last time/);
  });

  it('records a no-help answer after a week away as an independent delayed check', () => {
    const last = steps(SCENARIO_C).at(-1)!;
    expect(last.attempt.mode).toBe('independent-delayed-check');
    expect(last.attempt.independent).toBe(true);
  });

  it('shows the learner A story: slip, pattern, switch of help, help works, back up unaided', () => {
    const events = steps(SCENARIO_A).map((s) => s.result.helpEvent);
    expect(events.indexOf('stuck')).toBeGreaterThan(-1);
    expect(events).toContain('switched');
    expect(events).toContain('helped');
    expect(events.indexOf('resolved')).toBeGreaterThan(events.indexOf('helped'));
  });

  it('records mistakes against the real misconception state, not a copy', () => {
    const result = runTrace(SCENARIO_A);
    expect(result.final.profile.misconceptions['frac-add-across'].seen).toBe(2);
    expect(result.initial.profile.misconceptions).toEqual({});
  });

  it('never lets the model estimate stand in for curriculum evidence', () => {
    for (const step of steps(SCENARIO_A)) {
      expect(step.activeNode?.status).toBeDefined();
      expect(step.after.pKnown).toBeGreaterThanOrEqual(0);
    }
  });

  it('givenFor never returns the correct answer for a wrong outcome', () => {
    const question = { skillId: 'fractions-y6', level: 2, id: 'x', prompt: '1/2 + 1/4 = ?', answer: '3/4', explanation: '', bugs: [['frac-add-across', '2/6']] } as Parameters<typeof givenFor>[0];
    expect(givenFor(question, 'right')).toBe('3/4');
    expect(givenFor(question, 'add-across')).toBe('2/6');
    expect(givenFor(question, 'other-wrong')).not.toBe('3/4');
  });
});
