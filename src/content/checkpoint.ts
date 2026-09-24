/**
 * Checkpoints: short, fixed tests to measure progress before and after a
 * period of practice (e.g. a pilot).
 *
 * - Two forms per subject (A and B) cover the same Year 6 skills at the same
 *   levels with different questions, so a child never sees the same test twice.
 * - Every child gets exactly the same questions for a form, so results can be
 *   compared between children.
 * - Counterbalanced: half the children take A first, half take B first, so a
 *   form that happens to be slightly harder doesn't bias the before/after
 *   comparison.
 * - No hints, no feedback during the test, and answers don't change the
 *   adaptive brain, so the measurement stays clean.
 *
 * The forms are built from the same question generators and banks as
 * practice; they have not been statistically equated, so small differences
 * between forms are possible (the counterbalancing reduces their effect).
 */
import type { CheckpointResult, Level, Profile, Question, SubjectId } from '../brain/types';
import { englishQuestions } from './english';
import { MATHS_Y6_GENERATORS } from './maths-y6';
import { scienceQuestions } from './science';
import { SKILLS } from './skills';

export type Form = 'A' | 'B';

/** Levels tested for every skill: one mid, one hard. */
export const CHECKPOINT_LEVELS: Level[] = [2, 4];
/** Days between the first and second checkpoint. */
export const CHECKPOINT_GAP_DAYS = 28;

/** Small deterministic PRNG so a form is identical for everyone. */
function seeded(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let seed = h >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bankPick(all: Question[], level: Level, form: Form): Question {
  // Closest items to the level, in a fixed order; A takes the first, B the second.
  const ranked = [...all].sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level) || a.id.localeCompare(b.id));
  const q = ranked[form === 'A' ? 0 : 1] ?? ranked[0];
  const rng = seeded(`${q.id}:${form}`);
  // Fixed (but shuffled) choice order.
  const choices = [...(q.choices ?? [])];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { ...q, choices };
}

export function checkpointQuestions(subject: SubjectId, form: Form): Question[] {
  const skills = SKILLS.filter((s) => s.subject === subject && s.typicalYear === 6);
  const questions: Question[] = [];
  for (const skill of skills) {
    const bank = subject === 'maths' ? null : subject === 'english' ? englishQuestions(skill.id) : scienceQuestions(skill.id);
    const used = new Set<string>();
    for (const level of CHECKPOINT_LEVELS) {
      let q: Question;
      if (bank) {
        q = bankPick(bank.filter((x) => !used.has(x.id)), level, form);
      } else {
        const rng = seeded(`${form}:${skill.id}:${level}`);
        q = MATHS_Y6_GENERATORS[skill.id](level, rng);
      }
      used.add(q.id);
      questions.push(q);
    }
  }
  return questions;
}

/** Which form a child takes first: fixed per child, half A-first and half B-first. */
export function firstForm(childId: string): Form {
  let h = 0;
  for (const ch of childId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? 'A' : 'B';
}

export function checkpointsFor(p: Profile, subject: SubjectId): CheckpointResult[] {
  return (p.checkpoints ?? []).filter((c) => c.subject === subject).sort((a, b) => a.at - b.at);
}

/**
 * Which checkpoint is due for this subject, if any: the first one before any
 * practice, the second one CHECKPOINT_GAP_DAYS later (the other form).
 */
export function checkpointDue(p: Profile, subject: SubjectId, now: number): { form: Form; which: 'first' | 'second' } | null {
  const done = checkpointsFor(p, subject);
  const first = firstForm(p.id);
  if (done.length === 0) return { form: first, which: 'first' };
  if (done.length === 1 && now - done[0].at >= CHECKPOINT_GAP_DAYS * 86_400_000) {
    return { form: done[0].form === 'A' ? 'B' : 'A', which: 'second' };
  }
  return null;
}

export function score(result: CheckpointResult): { correct: number; total: number; pct: number } {
  const correct = result.answers.filter((a) => a.correct).length;
  const total = result.answers.length;
  return { correct, total, pct: total ? Math.round((correct / total) * 100) : 0 };
}
