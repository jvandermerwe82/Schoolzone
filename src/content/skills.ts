import type { Skill, SubjectId } from '../brain/types';

/**
 * The skill map. Prerequisites form a graph the brain uses to decide what to
 * introduce next and where to go back to when a child is stuck.
 * `typicalGrade` values are rough guides only, used for a starting guess.
 */
export const SKILLS: Skill[] = [
  // ---- Maths ----
  { id: 'number-sense', subject: 'maths', name: 'Number Sense', emoji: '🔢', typicalGrade: 1,
    description: 'Counting, comparing numbers and skip counting.', prerequisites: [] },
  { id: 'addition', subject: 'maths', name: 'Addition', emoji: '➕', typicalGrade: 1,
    description: 'Adding numbers, from small sums to three digits.', prerequisites: ['number-sense'] },
  { id: 'subtraction', subject: 'maths', name: 'Subtraction', emoji: '➖', typicalGrade: 2,
    description: 'Taking away, from small numbers to three digits.', prerequisites: ['addition'] },
  { id: 'place-value', subject: 'maths', name: 'Place Value', emoji: '🧱', typicalGrade: 2,
    description: 'Tens, hundreds, thousands and rounding.', prerequisites: ['number-sense'] },
  { id: 'multiplication', subject: 'maths', name: 'Multiplication', emoji: '✖️', typicalGrade: 3,
    description: 'Times tables and multiplying bigger numbers.', prerequisites: ['addition', 'place-value'] },
  { id: 'division', subject: 'maths', name: 'Division', emoji: '➗', typicalGrade: 3,
    description: 'Sharing equally, the inverse of times tables.', prerequisites: ['multiplication', 'subtraction'] },
  { id: 'fractions', subject: 'maths', name: 'Fractions', emoji: '🍕', typicalGrade: 4,
    description: 'Parts of a whole, comparing and adding fractions.', prerequisites: ['division'] },

  // ---- Science ----
  { id: 'living-things', subject: 'science', name: 'Living Things', emoji: '🌱', typicalGrade: 1,
    description: 'Plants, animals and what they need to live.', prerequisites: [] },
  { id: 'human-body', subject: 'science', name: 'Human Body', emoji: '🫀', typicalGrade: 2,
    description: 'Organs, senses, bones and staying healthy.', prerequisites: ['living-things'] },
  { id: 'materials', subject: 'science', name: 'Materials & Matter', emoji: '🧊', typicalGrade: 2,
    description: 'Solids, liquids, gases and properties of materials.', prerequisites: [] },
  { id: 'forces-energy', subject: 'science', name: 'Forces & Energy', emoji: '🧲', typicalGrade: 3,
    description: 'Pushes, pulls, magnets, light and electricity.', prerequisites: ['materials'] },
  { id: 'earth-space', subject: 'science', name: 'Earth & Space', emoji: '🪐', typicalGrade: 3,
    description: 'The Sun, Moon, planets and weather.', prerequisites: [] },
];

export const SUBJECTS: { id: SubjectId; name: string; emoji: string }[] = [
  { id: 'maths', name: 'Maths', emoji: '🧮' },
  { id: 'science', name: 'Science', emoji: '🔬' },
];

const byId = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill {
  const skill = byId.get(id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

export function skillsFor(subject: SubjectId): Skill[] {
  return SKILLS.filter((s) => s.subject === subject);
}
