import { describe, expect, it } from 'vitest';
import { newProfile } from '../storage';
import { checkAnswer } from '.';
import { SKILLS } from './skills';
import { CHECKPOINT_GAP_DAYS, CHECKPOINT_LEVELS, checkpointDue, checkpointQuestions, firstForm, score } from './checkpoint';

const SUBJECTS = ['maths', 'english', 'science'] as const;

describe('checkpoints', () => {
  it('cover every Year 6 skill at the same levels in both forms', () => {
    for (const subject of SUBJECTS) {
      const y6 = SKILLS.filter((s) => s.subject === subject && s.typicalYear === 6).length;
      for (const form of ['A', 'B'] as const) {
        const qs = checkpointQuestions(subject, form);
        expect(qs).toHaveLength(y6 * CHECKPOINT_LEVELS.length);
        for (const q of qs) expect(checkAnswer(q, q.answer)).toBe(true);
      }
      const a = checkpointQuestions(subject, 'A').map((q) => `${q.skillId}:${q.level}`);
      const b = checkpointQuestions(subject, 'B').map((q) => `${q.skillId}:${q.level}`);
      expect(a).toEqual(b); // same blueprint
    }
  });

  it('forms A and B share no questions, and a form is identical every time', () => {
    for (const subject of SUBJECTS) {
      const a = checkpointQuestions(subject, 'A');
      const b = checkpointQuestions(subject, 'B');
      const aPrompts = new Set(a.map((q) => `${q.prompt}|${q.answer}`));
      expect(b.some((q) => aPrompts.has(`${q.prompt}|${q.answer}`))).toBe(false);
      expect(checkpointQuestions(subject, 'A')).toEqual(a);
    }
  });

  it('splits children roughly evenly between A-first and B-first', () => {
    const forms = Array.from({ length: 200 }, (_, i) => firstForm(`child-${i}-${(i * 7919).toString(36)}`));
    const aFirst = forms.filter((f) => f === 'A').length;
    expect(aFirst).toBeGreaterThan(70);
    expect(aFirst).toBeLessThan(130);
  });

  it('asks for the first checkpoint before practice, and the other form after the gap', () => {
    const now = Date.parse('2026-10-01T10:00:00Z');
    let p = newProfile('Ava', '🦊', 6);
    const first = checkpointDue(p, 'maths', now)!;
    expect(first.which).toBe('first');
    p = { ...p, checkpoints: [{ subject: 'maths', form: first.form, at: now, answers: [] }] };
    expect(checkpointDue(p, 'maths', now + 86_400_000)).toBeNull();
    const second = checkpointDue(p, 'maths', now + CHECKPOINT_GAP_DAYS * 86_400_000)!;
    expect(second.which).toBe('second');
    expect(second.form).not.toBe(first.form);
    expect(checkpointDue(p, 'english', now)!.which).toBe('first'); // subjects are separate
  });

  it('scores results', () => {
    expect(score({ subject: 'maths', form: 'A', at: 0, answers: [
      { skillId: 'algebra', level: 2, questionId: 'x', correct: true, timeMs: 1 },
      { skillId: 'algebra', level: 4, questionId: 'y', correct: false, timeMs: 1 },
    ] })).toEqual({ correct: 1, total: 2, pct: 50 });
  });
});
