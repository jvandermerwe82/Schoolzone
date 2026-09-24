/**
 * Misconceptions: *why* a child got something wrong.
 *
 * Many wrong answers aren't random. They come from a consistent wrong rule,
 * like "take the smaller digit from the larger one in each column" in
 * subtraction (Brown & Burton, 1978) or "add the tops and add the bottoms"
 * with fractions. Each question can list the answers these rules would
 * produce (`Question.bugs`). When a child's wrong answer matches one, the
 * brain knows the likely cause, explains that specific mistake, and keeps
 * track of whether the child still makes it.
 */
import { parseNumber } from '../content';
import type { MisconceptionState, Profile, Question } from './types';

export interface Misconception {
  id: string;
  /** Plain-language name for parents. */
  name: string;
  /** What the brain noticed, said to the child. */
  noticed: string;
  /** How to fix it, said to the child. */
  fix: string;
}

const CATALOGUE: Misconception[] = [
  // ---- Maths ----
  { id: 'count-direction', name: 'Mixes up "before" and "after"', noticed: 'It looks like you went the wrong way.', fix: '"After" means one more (count up). "Before" means one less (count down).' },
  { id: 'add-no-carry', name: 'Forgets to carry when adding', noticed: 'It looks like the ones made 10 or more, but nothing was carried.', fix: 'When a column adds to 10 or more, write the ones digit and carry the 1 to the next column.' },
  { id: 'sub-smaller-from-larger', name: 'Takes the smaller digit from the larger in each column', noticed: 'It looks like you took the smaller digit away from the bigger one in a column, even though the bigger one was on the bottom.', fix: 'Always take the bottom digit away from the top. If the top digit is smaller, exchange 1 ten for 10 ones first.' },
  { id: 'sub-borrow-no-decrement', name: 'Exchanges but forgets to reduce the next column', noticed: 'It looks like you exchanged a ten but didn\'t take it away from the tens column.', fix: 'When you exchange 1 ten for 10 ones, cross out the tens digit and make it one less.' },
  { id: 'round-direction', name: 'Rounds the wrong way', noticed: 'It looks like you rounded the wrong way.', fix: 'Look at the digit just after the place you are rounding to: 5 or more rounds up, 4 or less rounds down.' },
  { id: 'digit-not-value', name: 'Gives the digit instead of its value', noticed: 'You gave the digit, but the question asks what it is worth.', fix: 'A digit\'s value depends on its place: the 7 in 4,732 is worth 700.' },
  { id: 'mult-added', name: 'Adds instead of multiplying', noticed: 'It looks like you added the numbers instead of multiplying.', fix: '× means "groups of". 6 × 4 is 6 groups of 4, which is 24, not 10.' },
  { id: 'fraction-unit-only', name: 'Finds one part but forgets to multiply by the numerator', noticed: 'You found one part correctly, but the question asks for more than one part.', fix: 'Divide by the bottom number to find one part, then multiply by the top number.' },
  { id: 'frac-add-across', name: 'Adds the numerators and the denominators', noticed: 'It looks like you added the tops and also added the bottoms.', fix: 'Only add the tops. The bottom number is the size of the pieces, and it must be the same before you add.' },
  { id: 'frac-div-multiplied', name: 'Multiplies instead of dividing a fraction', noticed: 'It looks like you multiplied instead of dividing.', fix: 'Dividing a fraction by a whole number makes it smaller: multiply the bottom number instead.' },
  { id: 'not-simplest', name: 'Doesn\'t simplify fractions', noticed: 'Your answer is the right size, but it isn\'t in its simplest form.', fix: 'Divide the top and bottom by their highest common factor until nothing else divides both.' },
  { id: 'neg-sign', name: 'Gets the sign wrong with negative numbers', noticed: 'The number part is right, but the sign (+ or −) is wrong.', fix: 'Picture a number line. If you end up below zero, the answer is negative.' },
  { id: 'neg-ignore-sign', name: 'Ignores the minus sign', noticed: 'It looks like you treated the negative number as positive.', fix: 'A negative number is below zero. Count to zero first, then carry on past it.' },
  { id: 'prime-odd', name: 'Thinks all odd numbers are prime', noticed: 'That number is odd, but it isn\'t prime.', fix: 'A prime has exactly two factors. 9 is odd but 3 × 3 = 9, so it isn\'t prime.' },
  { id: 'hcf-lcm-mixup', name: 'Mixes up highest common factor and lowest common multiple', noticed: 'It looks like you found the other one: factor and multiple got swapped.', fix: 'A factor divides INTO the number (it\'s smaller or equal). A multiple is in its times table (bigger or equal).' },
  { id: 'lcm-product', name: 'Always multiplies to find the lowest common multiple', noticed: 'Multiplying the numbers gives a common multiple, but not always the lowest one.', fix: 'List the multiples of each number and find the first one they share.' },
  { id: 'order-left-to-right', name: 'Works left to right instead of using the order of operations', noticed: 'It looks like you worked from left to right.', fix: 'Do brackets first, then × and ÷, then + and −.' },
  { id: 'order-ignore-brackets', name: 'Ignores brackets', noticed: 'It looks like the brackets weren\'t done first.', fix: 'Always work out the part inside brackets before anything else.' },
  { id: 'long-mult-place-value', name: 'Forgets the place-value zero in long multiplication', noticed: 'It looks like the tens digit was multiplied as if it were ones.', fix: 'When you multiply by the tens digit, you are multiplying by tens: put a 0 in the ones column first.' },
  { id: 'dec-wrong-direction', name: 'Moves digits the wrong way when multiplying or dividing by 10, 100 or 1000', noticed: 'It looks like the digits moved the wrong way.', fix: 'Multiplying makes the number bigger (digits move left). Dividing makes it smaller (digits move right).' },
  { id: 'dec-add-zero', name: 'Thinks "× 10" means "add a zero" with decimals', noticed: 'Adding a zero to the end of a decimal doesn\'t change its value.', fix: '× 10 moves every digit one place to the left: 4.7 × 10 = 47.' },
  { id: 'dec-fraction-digits', name: 'Writes a fraction\'s digits as a decimal', noticed: 'It looks like the top and bottom numbers were written as a decimal.', fix: 'A fraction is a division: 1/4 means 1 ÷ 4 = 0.25, not 1.4.' },
  { id: 'pct-divide', name: 'Divides by the percentage', noticed: 'It looks like you divided by the percentage number.', fix: 'Per cent means out of 100. Find 10% (÷ 10) or 1% (÷ 100) first, then build up.' },
  { id: 'algebra-wrong-inverse', name: 'Uses the wrong inverse operation in equations', noticed: 'It looks like you did the same operation instead of the opposite one.', fix: 'To undo + use −, to undo − use +, to undo × use ÷.' },
  { id: 'algebra-an-as-sum', name: 'Reads "3n" as "3 + n"', noticed: 'It looks like 3n was read as 3 + n.', fix: 'A number written next to a letter means multiply: 3n means 3 × n.' },
  { id: 'algebra-order', name: 'Undoes the steps of an equation in the wrong order', noticed: 'It looks like the steps were undone in the wrong order.', fix: 'Undo the + or − first, then the × or ÷.' },
  { id: 'sequence-off-by-one', name: 'Counts one step too many in sequences', noticed: 'You added one step too many.', fix: 'From the 1st term to the 10th term there are only 9 steps.' },
  { id: 'angle-wrong-total', name: 'Uses the wrong angle total', noticed: 'It looks like the wrong total was used.', fix: 'Straight line = 180°, triangle = 180°, around a point or in a quadrilateral = 360°.' },
  { id: 'area-no-half', name: 'Forgets to halve for the area of a triangle', noticed: 'That is the area of the rectangle around the triangle.', fix: 'A triangle is half of a rectangle: area = ½ × base × height.' },
  { id: 'area-halved', name: 'Halves the area of a parallelogram', noticed: 'A parallelogram isn\'t half of anything: it has the same area as a rectangle.', fix: 'Area of a parallelogram = base × perpendicular height.' },
  { id: 'radius-diameter', name: 'Mixes up radius and diameter', noticed: 'It looks like radius and diameter got swapped.', fix: 'The diameter goes all the way across, so it is twice the radius.' },
  { id: 'mean-no-divide', name: 'Forgets to divide when finding the mean', noticed: 'That\'s the total. The mean shares it out equally.', fix: 'Mean = total ÷ how many numbers there are.' },
  { id: 'polygon-exterior', name: 'Gives the exterior angle instead of the interior angle', noticed: 'That is the angle outside the shape (the exterior angle).', fix: 'Interior angle = 180° − exterior angle. Or use (sides − 2) × 180 ÷ sides.' },

  // ---- English ----
  { id: 'spell-ie-ei', name: 'Mixes up "ie" and "ei"', noticed: 'The "i" and "e" are the wrong way round.', fix: 'For the "ee" sound, it\'s i before e, except after c (receive). Learn the exceptions like seize and protein.' },
  { id: 'spell-missed-double', name: 'Misses double letters', noticed: 'A double letter was written as a single one.', fix: 'Say the word slowly and look for the doubled letters, e.g. a-cc-o-mm-odate.' },
  { id: 'spell-extra-double', name: 'Doubles letters that should be single', noticed: 'A single letter was doubled.', fix: 'Check which letters are really doubled. Try writing it both ways and see which looks right.' },
  { id: 'spell-missing-letter', name: 'Leaves out letters (often silent ones)', noticed: 'A letter is missing, often one you can\'t hear.', fix: 'Silent letters must still be written. Say the word "as it\'s spelt" to remember them: Wed-nes-day.' },
  { id: 'spell-extra-letter', name: 'Adds extra letters', noticed: 'There is an extra letter.', fix: 'Break the word into syllables and check each part.' },
  { id: 'spell-vowel-choice', name: 'Picks the wrong vowel in unstressed syllables', noticed: 'A vowel is wrong in the part of the word you say quietly.', fix: 'Link it to a related word where you can hear the vowel: definite → finite.' },
  { id: 'spell-letter-order', name: 'Swaps letters around', noticed: 'Two letters swapped places.', fix: 'Say each syllable slowly while you write it.' },
  { id: 'spell-phonetic', name: 'Spells words the way they sound', noticed: 'That\'s how the word sounds, but not how it\'s spelt.', fix: 'Many words aren\'t spelt how they sound. Use look, say, cover, write, check.' },
  { id: 'spell-cious-tious', name: 'Mixes up -cious and -tious', noticed: '-cious and -tious got mixed up.', fix: 'If the root ends in -ce (space → spacious), use -cious. Think of related words: caution → cautious.' },
  { id: 'spell-cial-tial', name: 'Mixes up -cial and -tial', noticed: '-cial and -tial got mixed up.', fix: '-cial usually comes after a vowel (special), -tial after a consonant (partial).' },
  { id: 'spell-able-ible', name: 'Mixes up -able and -ible', noticed: '-able and -ible got mixed up.', fix: 'If you can hear a whole word before the ending, it\'s usually -able (depend-able). If not, it\'s often -ible (poss-ible).' },
  { id: 'spell-ant-ent', name: 'Mixes up -ant/-ance and -ent/-ence', noticed: '-ant and -ent (or -ance and -ence) got mixed up.', fix: 'A related -ation word means -ant/-ance (observation → observant). After a soft c or g, use -ent/-ence.' },
  { id: 'spell-keep-e', name: 'Drops the "e" before -able', noticed: 'The "e" was dropped.', fix: 'Keep the "e" after c or g so they stay soft: notice → noticeable, change → changeable.' },
  { id: 'spell-fer-doubling', name: 'Doubles (or doesn\'t double) the "r" in -fer words', noticed: 'The "r" rule for -fer words got mixed up.', fix: 'If "fer" is still stressed, double the r (preferred). If not, don\'t (preference).' },
  { id: 'gr-past-is-passive', name: 'Thinks any past-tense sentence is passive', noticed: 'That sentence is in the past tense, but it\'s still active.', fix: 'Passive needs "was/were/got" + a past participle, and the do-er moves to the end (or disappears).' },
  { id: 'gr-subjunctive-was', name: 'Uses "was" instead of the subjunctive "were"', noticed: '"If I was" is fine in chat, but formal writing uses the subjunctive.', fix: 'In formal writing, use "If I were…".' },
  { id: 'gr-object-preposition', name: 'Picks a noun after a preposition as the object', noticed: 'That noun comes after a preposition (like "over"), not straight after the verb.', fix: 'The object comes straight after the verb and is what the verb acts on.' },
  { id: 'gr-subject-object-mixup', name: 'Mixes up subject and object', noticed: 'Subject and object got swapped.', fix: 'The subject DOES the verb. The object has the verb done TO it.' },
  { id: 'pu-comma-splice', name: 'Joins two sentences with just a comma', noticed: 'A comma on its own can\'t join two complete sentences.', fix: 'Use a full stop, a semi-colon, or a joining word like "and" or "because".' },
  { id: 'pu-semicolon-subordinate', name: 'Uses a semi-colon after a clause that can\'t stand alone', noticed: 'One side of the semi-colon can\'t stand on its own as a sentence.', fix: 'Both sides of a semi-colon must make sense as sentences on their own.' },
  { id: 'pu-comma-meaning', name: 'Misses commas that change the meaning', noticed: 'Without the comma, the sentence means something else!', fix: 'Use a comma before the name of the person you are talking to: "Let\'s eat, Grandma!"' },

  // ---- Science ----
  { id: 'sci-sun-orbits-earth', name: 'Thinks the Sun goes around the Earth', noticed: 'It looks like the Sun moves around us, but it\'s the Earth that spins.', fix: 'Earth spins once a day (day and night) and orbits the Sun once a year.' },
  { id: 'sci-seasons-distance', name: 'Thinks seasons come from distance to the Sun', noticed: 'Distance to the Sun isn\'t what causes seasons.', fix: 'Seasons come from Earth\'s tilt: your half of the Earth leans towards the Sun in summer.' },
  { id: 'sci-moon-own-light', name: 'Thinks the Moon makes its own light', noticed: 'The Moon looks bright, but it doesn\'t make light.', fix: 'The Moon reflects sunlight. Only light sources, like the Sun, make their own light.' },
  { id: 'sci-eyes-send-light', name: 'Thinks our eyes send out light', noticed: 'Our eyes don\'t send out light; they receive it.', fix: 'Light travels from a source, bounces off objects and goes INTO our eyes.' },
  { id: 'sci-shadow-size', name: 'Thinks shadows shrink as objects get nearer the light', noticed: 'Moving closer to the light actually makes the shadow bigger.', fix: 'Closer to the light, the object blocks more of the spreading light, so the shadow grows.' },
  { id: 'sci-camel-water', name: 'Thinks a camel\'s hump stores water', noticed: 'That\'s a very common idea, but it isn\'t true.', fix: 'The hump stores fat, which can be used for energy.' },
  { id: 'sci-lamarck', name: 'Thinks features gained in life are passed on', noticed: 'Stretching during your life doesn\'t change what you pass on.', fix: 'Natural selection: living things born with helpful features survive and pass them on.' },
  { id: 'sci-mammal-live-young', name: 'Thinks all mammals give birth to live young', noticed: 'Most mammals do, but not all: the platypus lays eggs.', fix: 'What all mammals share is feeding their young on milk.' },
  { id: 'sci-whale-is-fish', name: 'Thinks animals that live in water are fish', noticed: 'Living in water doesn\'t make an animal a fish.', fix: 'Whales breathe air and feed their young milk, so they are mammals.' },
  { id: 'sci-plants-breathe-in-oxygen', name: 'Mixes up the gases plants take in and give out', noticed: 'Plants give out oxygen when they make food.', fix: 'For photosynthesis plants take in carbon dioxide and give out oxygen.' },
  { id: 'sci-more-bulbs-brighter', name: 'Thinks more bulbs make a series circuit brighter', noticed: 'More bulbs share the same cell, so each one gets less.', fix: 'In a series circuit, adding bulbs makes each one dimmer. Adding cells makes them brighter.' },
  { id: 'sci-series-break', name: 'Thinks other bulbs stay on when one breaks in series', noticed: 'In a series circuit there is only one loop.', fix: 'If one bulb breaks, the loop is broken and all the bulbs go out.' },
];

const BY_ID = new Map(CATALOGUE.map((m) => [m.id, m]));

export function getMisconception(id: string): Misconception {
  const known = BY_ID.get(id);
  if (known) return known;
  if (id.startsWith('homophone:')) {
    const [a, b] = id.slice('homophone:'.length).split('/');
    return {
      id,
      name: `Mixes up "${a}" and "${b}"`,
      noticed: `"${a}" and "${b}" sound alike but mean different things.`,
      fix: 'Work out what the word must mean in the sentence, then pick the spelling with that meaning.',
    };
  }
  return { id, name: id, noticed: 'That answer follows a common pattern of mistakes.', fix: 'Read the explanation and try one like it.' };
}

export function allMisconceptionIds(): string[] {
  return CATALOGUE.map((m) => m.id);
}

const tidy = (s: string) => s.trim().toLowerCase().replace(/−/g, '-').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');

function sameAnswer(a: string, b: string): boolean {
  if (tidy(a) === tidy(b)) return true;
  const x = parseNumber(a), y = parseNumber(b);
  return x !== null && y !== null && Math.abs(x - y) < 1e-9;
}

/** Which known misconception (if any) explains this wrong answer. */
export function diagnose(q: Question, given: string, correct: boolean): string | null {
  if (correct) return null;
  if (q.exact && sameAnswer(given, q.answer)) return 'not-simplest';
  for (const [id, wrong] of q.bugs ?? []) if (sameAnswer(given, wrong)) return id;
  return null;
}

/** Rate at which evidence moves a misconception's strength (a design choice). */
const RISE = 0.4; // one match → 0.4 (a possible slip); two → 0.64 (a pattern)
const FALL = 0.6;
export const ACTIVE = 0.5;

/**
 * Update misconception beliefs after an answer:
 * - making the mistake strengthens it;
 * - getting right a question where that mistake would have given a
 *   different answer weakens it (evidence the child no longer holds it).
 */
export function updateMisconceptions(
  current: Record<string, MisconceptionState>,
  q: Question,
  correct: boolean,
  hinted: boolean,
  found: string | null,
  now: number,
): Record<string, MisconceptionState> {
  const next = { ...current };
  if (found) {
    const m = next[found] ?? { strength: 0, seen: 0, lastSeen: now, fixedAt: null, skills: [] };
    next[found] = {
      strength: m.strength + (1 - m.strength) * RISE,
      seen: m.seen + 1,
      lastSeen: now,
      fixedAt: null,
      skills: m.skills.includes(q.skillId) ? m.skills : [...m.skills, q.skillId],
    };
  }
  if (correct && !hinted) {
    const tested = new Set((q.bugs ?? []).map(([id]) => id));
    if (q.exact) tested.add('not-simplest');
    for (const id of tested) {
      const m = next[id];
      if (!m) continue;
      const strength = m.strength * FALL;
      const fixedAt = m.fixedAt ?? (m.strength >= ACTIVE && strength < ACTIVE ? now : null);
      next[id] = { ...m, strength, fixedAt };
    }
  }
  return next;
}

export interface MisconceptionReport {
  misconception: Misconception;
  state: MisconceptionState;
}

/** Active misconceptions (strongest first) and ones the child has fixed. */
export function misconceptionReport(profile: Profile): { active: MisconceptionReport[]; fixed: MisconceptionReport[] } {
  const all = Object.entries(profile.misconceptions ?? {}).map(([id, state]) => ({ misconception: getMisconception(id), state }));
  return {
    active: all.filter((r) => r.state.strength >= ACTIVE).sort((a, b) => b.state.strength - a.state.strength),
    fixed: all.filter((r) => r.state.strength < ACTIVE && r.state.fixedAt !== null).sort((a, b) => b.state.fixedAt! - a.state.fixedAt!),
  };
}

/** The strongest active misconception seen in this skill, if any. */
export function activeMisconceptionFor(profile: Profile, skillId: string): string | null {
  let best: [string, number] | null = null;
  for (const [id, m] of Object.entries(profile.misconceptions ?? {})) {
    if (m.strength >= ACTIVE && m.skills.includes(skillId) && (!best || m.strength > best[1])) best = [id, m.strength];
  }
  return best?.[0] ?? null;
}
