/**
 * `npm run content:export` writes review/schoolzone-content-review.csv: every
 * piece of learning content, for a Year 6 teacher to check. Opens in Excel or
 * Google Sheets. Reviewers fill in the last two columns.
 *
 * Maths questions are generated, so three examples per skill and level are
 * included (the generators themselves are checked by automated tests).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { allMisconceptionIds, getMisconception } from '../src/brain/misconceptions';
import { LEVELS, type Question } from '../src/brain/types';
import { checkpointQuestions } from '../src/content/checkpoint';
import { englishQuestions } from '../src/content/english';
import { skillTip } from '../src/content/hints';
import { MATHS_GENERATORS } from '../src/content/maths';
import { MATHS_Y6_GENERATORS } from '../src/content/maths-y6';
import { scienceQuestions } from '../src/content/science';
import { SKILLS, getSkill } from '../src/content/skills';
import { topicNotes } from '../src/content/solver';

const header = ['Type', 'Subject', 'Skill', 'Taught in year', 'Level (1-5)', 'Item', 'Question or text', 'Choices', 'Correct answer', 'Explanation', 'Reviewer: OK? (Y/N)', 'Reviewer: notes'];
const rows: string[][] = [];

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const minus = (s: string) => s.replace(/^-/, '−');
const addQuestion = (type: string, q: Question) => {
  const skill = getSkill(q.skillId);
  rows.push([type, skill.subject, skill.name, String(skill.typicalYear), String(q.level), q.id, q.prompt, (q.choices ?? []).join(' | '), minus(q.answer), q.explanation, '', '']);
};

// Questions
const gens = { ...MATHS_GENERATORS, ...MATHS_Y6_GENERATORS };
for (const skill of SKILLS) {
  const gen = gens[skill.id];
  if (gen) {
    const rng = seeded(skill.id.length * 1000 + 7);
    for (const level of LEVELS) for (let i = 0; i < 3; i++) addQuestion('Question (generated example)', gen(level, rng));
  } else {
    const bank = skill.subject === 'english' ? englishQuestions(skill.id) : scienceQuestions(skill.id);
    for (const q of bank) addQuestion('Question', q);
  }
}

// Checkpoint forms
for (const subject of ['maths', 'english', 'science'] as const) {
  for (const form of ['A', 'B'] as const) for (const q of checkpointQuestions(subject, form)) addQuestion(`Checkpoint form ${form}`, q);
}

// Problem Solver text
for (const skill of SKILLS) {
  rows.push(['Strategy tip', skill.subject, skill.name, String(skill.typicalYear), '', `tip:${skill.id}`, skillTip(skill.id), '', '', '', '', '']);
  topicNotes(skill.id).forEach((note, i) =>
    rows.push(['Topic note', skill.subject, skill.name, String(skill.typicalYear), '', `note:${skill.id}:${i + 1}`, note, '', '', '', '', '']));
}

// Mistake explanations shown to children
for (const id of allMisconceptionIds()) {
  const m = getMisconception(id);
  rows.push(['Mistake explanation', '', '', '', '', id, `${m.noticed} ${m.fix}`, '', '', `Shown to parents as: ${m.name}`, '', '']);
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
mkdirSync('review', { recursive: true });
// BOM so Excel opens the file as UTF-8 (for −, °, ½ and emoji).
writeFileSync('review/schoolzone-content-review.csv', '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n'));
console.log(`Wrote review/schoolzone-content-review.csv (${rows.length} items to review).`);
