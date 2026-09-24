import type { Skill, SubjectId } from '../brain/types';

/**
 * The skill map. Prerequisites form a graph the brain uses to decide what to
 * introduce next and where to go back to when a child is stuck.
 *
 * `typicalYear` follows the national curriculum in England (2014 framework).
 * Year 6 skills are the app's focus; earlier skills are kept as foundations the
 * brain can step back to when a Year 6 child has a gap. Values are a starting
 * guess only: the child's answers quickly override them.
 */
export const SKILLS: Skill[] = [
  // ---- Maths: foundations ----
  { id: 'number-sense', subject: 'maths', name: 'Number Sense', emoji: '🔢', typicalYear: 1,
    description: 'Counting, comparing numbers and skip counting.', prerequisites: [] },
  { id: 'addition', subject: 'maths', name: 'Addition', emoji: '➕', typicalYear: 1,
    description: 'Adding numbers, from small sums to three digits.', prerequisites: ['number-sense'] },
  { id: 'subtraction', subject: 'maths', name: 'Subtraction', emoji: '➖', typicalYear: 2,
    description: 'Taking away, from small numbers to three digits.', prerequisites: ['addition'] },
  { id: 'place-value', subject: 'maths', name: 'Place Value', emoji: '🧱', typicalYear: 2,
    description: 'Tens, hundreds, thousands and rounding.', prerequisites: ['number-sense'] },
  { id: 'multiplication', subject: 'maths', name: 'Multiplication', emoji: '✖️', typicalYear: 3,
    description: 'Times tables and multiplying bigger numbers.', prerequisites: ['addition', 'place-value'] },
  { id: 'division', subject: 'maths', name: 'Division', emoji: '➗', typicalYear: 3,
    description: 'Sharing equally, the inverse of times tables.', prerequisites: ['multiplication', 'subtraction'] },
  { id: 'fractions', subject: 'maths', name: 'Fractions', emoji: '🍕', typicalYear: 4,
    description: 'Parts of a whole, comparing and adding fractions.', prerequisites: ['division'] },

  // ---- Maths: Year 6 ----
  { id: 'negative-numbers', subject: 'maths', name: 'Negative Numbers', emoji: '🌡️', typicalYear: 6,
    description: 'Using negative numbers and working out differences across zero.', prerequisites: ['subtraction', 'place-value'] },
  { id: 'factors-primes', subject: 'maths', name: 'Factors, Multiples & Primes', emoji: '🔍', typicalYear: 6,
    description: 'Common factors, common multiples and prime numbers.', prerequisites: ['multiplication', 'division'] },
  { id: 'order-of-operations', subject: 'maths', name: 'Order of Operations', emoji: '🧮', typicalYear: 6,
    description: 'Brackets first, then × and ÷, then + and −.', prerequisites: ['multiplication', 'division'] },
  { id: 'long-multiplication-division', subject: 'maths', name: 'Long Multiplication & Division', emoji: '📝', typicalYear: 6,
    description: 'Up to 4-digit numbers multiplied or divided by a 2-digit number.', prerequisites: ['multiplication', 'division'] },
  { id: 'fractions-y6', subject: 'maths', name: 'Fractions (Year 6)', emoji: '🥧', typicalYear: 6,
    description: 'Simplifying, adding with different denominators, multiplying and dividing fractions.',
    prerequisites: ['fractions', 'factors-primes'] },
  { id: 'decimals-percentages', subject: 'maths', name: 'Decimals & Percentages', emoji: '💯', typicalYear: 6,
    description: 'Fraction, decimal and percentage equivalents, and percentages of amounts.', prerequisites: ['fractions', 'place-value'] },
  { id: 'algebra', subject: 'maths', name: 'Algebra', emoji: '🔣', typicalYear: 6,
    description: 'Missing numbers, simple formulae and number sequences.', prerequisites: ['order-of-operations'] },
  { id: 'geometry-statistics', subject: 'maths', name: 'Angles, Area & Averages', emoji: '📐', typicalYear: 6,
    description: 'Missing angles, area of triangles and parallelograms, circles and the mean.',
    prerequisites: ['multiplication', 'division'] },

  // ---- Science: foundations ----
  { id: 'living-things', subject: 'science', name: 'Living Things', emoji: '🌱', typicalYear: 2, choices: 4,
    description: 'Plants, animals and what they need to live.', prerequisites: [] },
  { id: 'human-body', subject: 'science', name: 'Human Body', emoji: '🫀', typicalYear: 3, choices: 4,
    description: 'Organs, senses, bones and staying healthy.', prerequisites: ['living-things'] },
  { id: 'materials', subject: 'science', name: 'Materials & Matter', emoji: '🧊', typicalYear: 4, choices: 4,
    description: 'Solids, liquids, gases and properties of materials.', prerequisites: [] },
  { id: 'forces-energy', subject: 'science', name: 'Forces & Energy', emoji: '🧲', typicalYear: 4, choices: 4,
    description: 'Pushes, pulls, magnets, light and electricity.', prerequisites: ['materials'] },
  { id: 'earth-space', subject: 'science', name: 'Earth & Space', emoji: '🪐', typicalYear: 5, choices: 4,
    description: 'The Sun, Moon, planets and weather.', prerequisites: [] },

  // ---- Science: Year 6 ----
  { id: 'classification', subject: 'science', name: 'Classifying Living Things', emoji: '🦋', typicalYear: 6, choices: 4,
    description: 'Grouping micro-organisms, plants and animals, including vertebrates and invertebrates.',
    prerequisites: ['living-things'] },
  { id: 'circulatory-system', subject: 'science', name: 'Heart, Blood & Health', emoji: '❤️', typicalYear: 6, choices: 4,
    description: 'The circulatory system and how diet, exercise and drugs affect the body.', prerequisites: ['human-body'] },
  { id: 'evolution-inheritance', subject: 'science', name: 'Evolution & Inheritance', emoji: '🦕', typicalYear: 6, choices: 4,
    description: 'Fossils, variation, adaptation and how living things change over time.', prerequisites: ['living-things'] },
  { id: 'light-y6', subject: 'science', name: 'Light (Year 6)', emoji: '💡', typicalYear: 6, choices: 4,
    description: 'How light travels, how we see things and why shadows form.', prerequisites: ['forces-energy'] },
  { id: 'electricity-y6', subject: 'science', name: 'Electricity (Year 6)', emoji: '🔋', typicalYear: 6, choices: 4,
    description: 'Series circuits, cells, bulbs, buzzers and circuit symbols.', prerequisites: ['forces-energy'] },

  // ---- English: Year 6 (spelling list and rules are Years 5 and 6) ----
  { id: 'spelling-words', subject: 'english', name: 'Tricky Spellings', emoji: '✏️', typicalYear: 6, choices: 3,
    description: 'The Year 5 and 6 statutory word list.', prerequisites: [] },
  { id: 'spelling-patterns', subject: 'english', name: 'Spelling Patterns', emoji: '🔤', typicalYear: 6, choices: 2,
    description: '-cious/-tious, -cial/-tial, -ant/-ent, -able/-ible, ei after c and more.', prerequisites: [] },
  { id: 'homophones', subject: 'english', name: 'Homophones', emoji: '👂', typicalYear: 6, choices: 2,
    description: 'Words that sound alike but mean different things, like principal and principle.', prerequisites: [] },
  { id: 'grammar-y6', subject: 'english', name: 'Grammar', emoji: '🧩', typicalYear: 6, choices: 4,
    description: 'Active and passive voice, subject and object, formal language, synonyms and antonyms.', prerequisites: [] },
  { id: 'punctuation-y6', subject: 'english', name: 'Punctuation', emoji: '❗', typicalYear: 6, choices: 4,
    description: 'Semi-colons, colons, dashes, hyphens and bullet points.', prerequisites: ['grammar-y6'] },
];

export const SUBJECTS: { id: SubjectId; name: string; emoji: string }[] = [
  { id: 'maths', name: 'Maths', emoji: '🧮' },
  { id: 'english', name: 'English', emoji: '📖' },
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
