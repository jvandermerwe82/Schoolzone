/**
 * The Problem Solver: help the child can ask for on any question.
 * - hints that go one step at a time (never the answer)
 * - notes about the topic
 * - meanings of the key words in the question
 * (Worked examples come from the question generators and banks.)
 */
import type { Question } from '../brain/types';
import { skillTip } from './hints';
import { getSkill } from './skills';
import type { SubjectId } from '../brain/types';

/** Short notes on each topic, written for Year 6 children. */
const NOTES: Record<string, string[]> = {
  'number-sense': [
    'Numbers go up by one each time you count: 17, 18, 19, 20.',
    'To compare two numbers, look at the biggest place first. 62 is bigger than 58 because 6 tens is more than 5 tens.',
    'Counting in steps (2s, 5s, 10s) means adding the same amount each time.',
  ],
  addition: [
    'Line numbers up by place value: ones under ones, tens under tens.',
    'Add the ones first. If they make 10 or more, write the ones digit and carry 1 ten into the tens column.',
    'Check by estimating: 47 + 38 is about 50 + 40 = 90, so 85 makes sense.',
  ],
  subtraction: [
    'Always take the bottom number away from the top one, column by column, starting with the ones.',
    'If the top digit is smaller, exchange: take 1 ten from the tens column and turn it into 10 ones.',
    'Check by adding back: if 52 − 27 = 25, then 25 + 27 should make 52.',
  ],
  'place-value': [
    'Each place is worth 10 times the place to its right: ones, tens, hundreds, thousands.',
    'The value of a digit depends on its place: in 4,732 the 7 is worth 700.',
    'To round, look at the digit just to the right of where you are rounding. 5 or more rounds up; 4 or less rounds down.',
  ],
  multiplication: [
    'Multiplying means adding equal groups: 4 × 6 is 4 groups of 6.',
    'You can multiply in any order: 4 × 6 = 6 × 4.',
    'For bigger numbers, split them up: 23 × 4 = 20 × 4 + 3 × 4 = 80 + 12 = 92.',
  ],
  division: [
    'Dividing means sharing into equal groups, or finding how many groups fit.',
    'Division is the inverse (opposite) of multiplication: if 6 × 7 = 42, then 42 ÷ 7 = 6.',
  ],
  fractions: [
    'A fraction is part of a whole. The bottom number (denominator) is how many equal parts; the top number (numerator) is how many of those parts.',
    'To find a fraction of an amount, divide by the denominator, then multiply by the numerator: ¾ of 20 = 20 ÷ 4 × 3 = 15.',
    'If the denominators are the same, add the numerators and keep the denominator: 2/7 + 3/7 = 5/7.',
  ],
  'negative-numbers': [
    'Negative numbers are less than zero, like temperatures below freezing: −5 °C is colder than 0 °C.',
    'On a number line, numbers get bigger to the right and smaller to the left.',
    'To find the difference across zero, count to 0 first, then carry on: from −4 to 6 is 4 + 6 = 10.',
  ],
  'factors-primes': [
    'Factors of a number divide into it exactly. The factors of 12 are 1, 2, 3, 4, 6 and 12.',
    'Multiples are in a number\'s times table: multiples of 4 are 4, 8, 12, 16…',
    'A prime number has exactly two factors: 1 and itself (2, 3, 5, 7, 11…). 1 is not prime.',
    'The highest common factor (HCF) is the biggest factor two numbers share. The lowest common multiple (LCM) is the smallest multiple they share.',
  ],
  'order-of-operations': [
    'Work in this order: Brackets, then × and ÷ (left to right), then + and − (left to right).',
    '3 + 4 × 5 = 3 + 20 = 23, not 35.',
  ],
  'long-multiplication-division': [
    'Long multiplication: multiply by the ones digit, then by the tens digit (remember it is worth tens, so write a 0 first), then add the two rows.',
    'Long division: divide from the left, one digit at a time, and carry any remainder to the next digit.',
    'Estimate first, then check your answer is close.',
  ],
  'fractions-y6': [
    'Simplify by dividing the top and bottom by their highest common factor: 12/18 = 2/3.',
    'To add or subtract fractions, first make the denominators the same using a common multiple: ½ + ⅓ = 3/6 + 2/6 = 5/6.',
    'To multiply fractions, multiply the tops and multiply the bottoms: ½ × ¼ = ⅛.',
    'To divide a fraction by a whole number, multiply the denominator: ⅓ ÷ 2 = 1/6.',
  ],
  'decimals-percentages': [
    'Per cent means "out of 100": 25% = 25/100 = 0.25 = ¼.',
    'To find 10%, divide by 10. 5% is half of 10%. Build other percentages from these: 15% = 10% + 5%.',
    'Multiplying by 10, 100 or 1000 moves digits 1, 2 or 3 places to the left; dividing moves them to the right.',
  ],
  algebra: [
    'A letter stands for an unknown number. 3n means 3 × n.',
    'To find the unknown, undo each step with the opposite operation: undo + with −, and × with ÷.',
    'In a linear sequence the terms go up (or down) by the same amount each time.',
  ],
  'geometry-statistics': [
    'Angles on a straight line add up to 180°. Angles in a triangle add up to 180°. Angles around a point, and in a quadrilateral, add up to 360°.',
    'Area of a triangle = ½ × base × perpendicular height. Area of a parallelogram = base × perpendicular height.',
    'The diameter of a circle is twice the radius.',
    'The mean is the total of all the numbers divided by how many numbers there are.',
  ],
  'spelling-words': [
    'These are words Year 5 and 6 pupils are expected to spell. Many have double letters (accommodate), silent letters (yacht) or unusual patterns (queue).',
    'Try "look, say, cover, write, check", and break long words into syllables.',
  ],
  'spelling-patterns': [
    '-cious/-tious: if the root word ends in -ce, use -cious (space → spacious).',
    '-cial comes after a vowel (special); -tial after a consonant (partial).',
    '-able if you can hear a whole word before it (dependable); otherwise often -ible (possible).',
    'i before e except after c, when the sound is "ee": receive, ceiling.',
  ],
  homophones: [
    'Homophones sound the same but have different meanings and spellings.',
    'In British English, practice and advice (with c) are nouns; practise and advise (with s) are verbs.',
    'Affect is usually a verb and effect is usually a noun.',
  ],
  'grammar-y6': [
    'The subject does the verb; the object has the verb done to it.',
    'Active: "The dog ate it." Passive: "It was eaten by the dog." The passive uses was/were + a past participle.',
    'Formal writing uses words like "request" and "discover" instead of "ask for" and "find out", and the subjunctive "If I were…".',
    'Synonyms mean the same (big, large). Antonyms are opposites (big, small).',
  ],
  'punctuation-y6': [
    'A semi-colon joins two clauses that could each be a sentence: It\'s raining; I\'m fed up.',
    'A colon introduces a list or an explanation.',
    'A dash can also mark the boundary between two clauses.',
    'Hyphens join words to avoid confusion: a man-eating shark.',
  ],
  'living-things': [
    'Living things grow, need food and water, and produce young.',
    'Plants make their own food using sunlight, water and carbon dioxide (photosynthesis).',
    'Herbivores eat plants, carnivores eat meat and omnivores eat both.',
  ],
  'human-body': [
    'The heart pumps blood, the lungs take in oxygen, and the brain controls the body.',
    'Bones protect organs and support the body; muscles pull on bones to move them.',
    'Food travels from the mouth down the oesophagus to the stomach, then the intestines.',
  ],
  materials: [
    'Matter can be a solid (keeps its shape), a liquid (flows, takes the shape of its container) or a gas (spreads out to fill any space).',
    'Heating can melt solids and evaporate liquids; cooling can condense gases and freeze liquids.',
    'Pure water freezes at 0 °C and boils at 100 °C (at sea level).',
  ],
  'forces-energy': [
    'A force is a push or a pull. Gravity pulls things towards the Earth; friction slows moving things.',
    'Magnets attract iron and steel. Like poles repel; opposite poles attract.',
    'Light travels in straight lines, and sound is made by vibrations.',
  ],
  'earth-space': [
    'The Earth spins once a day (giving day and night) and orbits the Sun once a year.',
    'The Moon orbits the Earth and reflects light from the Sun.',
    'The seasons are caused by the tilt of the Earth\'s axis.',
  ],
  classification: [
    'Living things are sorted into groups by their features: micro-organisms, plants and animals.',
    'Vertebrates have a backbone: fish, amphibians, reptiles, birds and mammals. Invertebrates do not.',
    'Carl Linnaeus created the naming system scientists still use.',
  ],
  'circulatory-system': [
    'The circulatory system is the heart, blood vessels and blood.',
    'Arteries carry blood away from the heart; veins carry it back; tiny capillaries connect them.',
    'Blood carries oxygen, nutrients and water around the body. Exercise and a healthy diet keep the heart healthy; smoking harms it.',
  ],
  'evolution-inheritance': [
    'Offspring inherit features from their parents but are not identical to them (variation).',
    'Adaptations are features that help living things survive in their environment.',
    'Over many generations, the best-adapted survive and pass on their features. This is natural selection, described by Darwin and Wallace.',
    'Fossils show what living things were like millions of years ago.',
  ],
  'light-y6': [
    'Light travels in straight lines.',
    'We see things when light from a source, or light reflected off an object, travels into our eyes.',
    'Shadows form when an object blocks light, so they have the same shape as the object.',
  ],
  'electricity-y6': [
    'A series circuit is one complete loop. If there is a gap, nothing works.',
    'More cells (a higher voltage) make bulbs brighter and buzzers louder. More bulbs on the same cell make each one dimmer.',
    'Circuit diagrams use standard symbols for cells, bulbs, switches, buzzers and motors.',
  ],
};

type Entry = [RegExp, string, string];

/**
 * Key words and what they mean, per subject, so a word like "object" gets
 * its grammar meaning only in English questions.
 */
const MATHS_WORDS: Entry[] = [
  [/\bhighest common factor|\bHCF\b/i, 'Highest common factor (HCF)', 'The biggest number that divides exactly into both numbers.'],
  [/\blowest common multiple|\bLCM\b/i, 'Lowest common multiple (LCM)', 'The smallest number that is in both numbers\' times tables.'],
  [/\bprime\b/i, 'Prime number', 'A number with exactly two factors: 1 and itself.'],
  [/\bfactors?\b/i, 'Factor', 'A number that divides exactly into another number.'],
  [/\bmultiples?\b/i, 'Multiple', 'A number in another number\'s times table.'],
  [/\bsimplest form\b/i, 'Simplest form', 'A fraction where the top and bottom can\'t both be divided by the same number (other than 1).'],
  [/\d\/\d/, 'Fraction', 'The bottom number (denominator) says how many equal parts; the top number (numerator) says how many parts you have.'],
  [/\bperpendicular height\b/i, 'Perpendicular height', 'The height measured at a right angle (90°) to the base.'],
  [/\bparallelogram\b/i, 'Parallelogram', 'A four-sided shape with two pairs of parallel sides.'],
  [/\bquadrilateral\b/i, 'Quadrilateral', 'Any shape with four straight sides.'],
  [/\bregular\b/i, 'Regular shape', 'A shape whose sides are all the same length and whose angles are all equal.'],
  [/\binterior angle\b/i, 'Interior angle', 'An angle inside a shape, where two sides meet.'],
  [/\bradius\b/i, 'Radius', 'The distance from the centre of a circle to its edge.'],
  [/\bdiameter\b/i, 'Diameter', 'The distance across a circle through its centre: twice the radius.'],
  [/\bmean\b/i, 'Mean', 'A type of average: the total divided by how many numbers there are.'],
  [/\bsequence\b|\bterm\b/i, 'Sequence and term', 'A sequence is a list of numbers that follow a rule. Each number in it is a term.'],
  [/\bformula\b/i, 'Formula', 'A rule written with letters, like P = 4s, that tells you how to work something out.'],
  [/\d+n\b|\bn [+−=]/, 'Letter n', 'The letter stands for an unknown number. 3n means 3 × n.'],
  [/%/, 'Per cent (%)', 'Out of 100. 25% means 25 out of every 100.'],
  [/\bdecimal\b/i, 'Decimal', 'A number with a decimal point; digits after it are tenths, hundredths and thousandths.'],
  [/\bround\b|\bnearest\b/i, 'Rounding', 'Changing a number to a simpler one close to it: 47 rounded to the nearest 10 is 50.'],
  [/\bdigit\b/i, 'Digit', 'One of the symbols 0 to 9 used to write numbers.'],
  [/\bdifference\b/i, 'Difference', 'How much bigger one number is than another: subtract the smaller from the bigger.'],
  [/−\d|°C/, 'Negative number', 'A number less than zero, written with a minus sign, like −4.'],
  [/\(/, 'Brackets', 'Work out the part in brackets first.'],
  [/×/, 'Multiply (×)', 'Find the total of equal groups.'],
  [/÷/, 'Divide (÷)', 'Share into equal groups.'],
];

const ENGLISH_WORDS: Entry[] = [
  [/\bsynonym\b/i, 'Synonym', 'A word with the same or a similar meaning, like big and large.'],
  [/\bantonym\b/i, 'Antonym', 'A word with the opposite meaning, like hot and cold.'],
  [/\bformal\b/i, 'Formal', 'Language for serious writing or speech, such as letters or reports, rather than chatting.'],
  [/\bsubject\b/i, 'Subject', 'The person or thing doing the verb: "The dog barked."'],
  [/\bobject\b/i, 'Object', 'The person or thing the verb is done to, just after the verb: "I kicked the ball."'],
  [/\bpassive\b/i, 'Passive voice', 'The thing the action is done to comes first: "The window was broken (by me)."'],
  [/\bactive\b/i, 'Active voice', 'The one doing the action comes first: "I broke the window."'],
  [/\bsubjunctive\b/i, 'Subjunctive', 'A formal verb form, like "If I were you…" or "…requires that all pupils be honest."'],
  [/\badverbial\b/i, 'Adverbial', 'A word or phrase that tells you how, when, where or why, or links ideas, like "on the other hand".'],
  [/\bellipsis\b/i, 'Ellipsis', 'Leaving out words the reader can easily guess: "I wanted to help but I couldn\'t [help]."'],
  [/\bquestion tag\b/i, 'Question tag', 'A short question on the end of a statement: "…isn\'t it?"'],
  [/\bsemi-colon\b/i, 'Semi-colon (;)', 'Joins two clauses that could each be a sentence, or separates items in a complicated list.'],
  [/(?<!semi-)\bcolon\b/i, 'Colon (:)', 'Introduces a list or an explanation.'],
  [/\bdash\b/i, 'Dash (–)', 'Can join two clauses, or show extra information.'],
  [/\bhyphen\b/i, 'Hyphen (-)', 'Joins words or parts of words: man-eating, re-cover.'],
  [/\bparenthesis\b|\bbrackets\b/i, 'Parenthesis', 'Extra information added to a sentence, inside brackets, dashes or commas.'],
  [/\bindependent clause/i, 'Independent clause', 'A group of words with a verb that makes sense as a sentence on its own.'],
  [/\bspell/i, 'Spelling tip', 'Say the word slowly in syllables and look for double letters and silent letters.'],
];

const SCIENCE_WORDS: Entry[] = [
  [/\bvertebrates?\b/i, 'Vertebrate', 'An animal with a backbone.'],
  [/\binvertebrates?\b/i, 'Invertebrate', 'An animal without a backbone, like an insect or a worm.'],
  [/\bmammals?\b/i, 'Mammal', 'An animal that has hair or fur and feeds its young on milk.'],
  [/\bamphibians?\b/i, 'Amphibian', 'An animal like a frog that usually lives in water when young and on land as an adult.'],
  [/\breptiles?\b/i, 'Reptile', 'An animal with dry, scaly skin, like a lizard or snake.'],
  [/\bmicro-organism/i, 'Micro-organism', 'A living thing too small to see without a microscope, like bacteria.'],
  [/\bphotosynthesis\b/i, 'Photosynthesis', 'How plants make food from sunlight, water and carbon dioxide.'],
  [/\bproducer\b/i, 'Producer', 'A living thing that makes its own food, like a plant.'],
  [/\bfossils?\b/i, 'Fossil', 'The remains or traces of a living thing from long ago, preserved in rock.'],
  [/\boffspring\b/i, 'Offspring', 'The young of a plant or animal.'],
  [/\badapt/i, 'Adaptation', 'A feature that helps a living thing survive where it lives.'],
  [/\binherit/i, 'Inherited', 'Passed on from parents to their young.'],
  [/\bevolution\b|\bnatural selection\b/i, 'Evolution', 'Slow change in living things over many generations, as the best-adapted survive and pass on their features.'],
  [/\bcircuit\b/i, 'Circuit', 'A complete loop that electricity can flow around.'],
  [/\bseries\b/i, 'Series circuit', 'A circuit with only one loop, so all the parts are in a line.'],
  [/\bcells?\b[^.?]*\b(circuit|bulb|buzzer)|\b(circuit|bulb|buzzer)\b[^.?]*\bcells?\b/i, 'Cell (in electricity)', 'A battery: it pushes electricity around a circuit.'],
  [/\bvoltage\b|\bvolts?\b/i, 'Voltage', 'How hard a cell pushes electricity round a circuit, measured in volts (V).'],
  [/\bconduct/i, 'Conductor', 'A material that lets electricity (or heat) pass through it easily, like metal.'],
  [/\bopaque\b/i, 'Opaque', 'Lets no light through.'],
  [/\btranslucent\b/i, 'Translucent', 'Lets some light through, but you can\'t see clearly through it.'],
  [/\btransparent\b/i, 'Transparent', 'Lets light through so you can see clearly through it.'],
  [/\breflect/i, 'Reflect', 'When light bounces off a surface.'],
  [/\blight source\b/i, 'Light source', 'Something that gives out its own light, like the Sun or a torch.'],
  [/\bshadow\b/i, 'Shadow', 'A dark area where an object blocks light.'],
  [/\bperiscope\b/i, 'Periscope', 'A tube with mirrors that lets you see over things.'],
  [/\bcapillar/i, 'Capillaries', 'The tiniest blood vessels.'],
  [/\barter/i, 'Arteries', 'Blood vessels that carry blood away from the heart.'],
  [/\bveins?\b/i, 'Veins', 'Blood vessels that carry blood back to the heart.'],
  [/\bplasma\b/i, 'Plasma', 'The liquid part of blood.'],
  [/\bplatelets?\b/i, 'Platelets', 'Tiny parts of blood that help it clot.'],
  [/\bchambers?\b/i, 'Chambers', 'The four spaces inside the heart that fill with blood.'],
  [/\bevaporat/i, 'Evaporation', 'When a liquid turns into a gas.'],
  [/\bcondens/i, 'Condensation', 'When a gas cools and turns back into a liquid.'],
  [/\bprecipitation\b/i, 'Precipitation', 'Water falling from clouds: rain, sleet, snow or hail.'],
  [/\bsolution\b|\bdissolve/i, 'Solution', 'A mixture made when something dissolves completely in a liquid.'],
  [/\bfriction\b/i, 'Friction', 'A force that slows things down when surfaces rub together.'],
  [/\bgravity\b/i, 'Gravity', 'The force that pulls things towards the Earth.'],
  [/\bforce\b/i, 'Force', 'A push or a pull.'],
  [/\baxis\b/i, 'Axis', 'An imaginary line the Earth spins around.'],
];

export function topicNotes(skillId: string): string[] {
  return NOTES[skillId] ?? [];
}

export function allNotedSkills(): string[] {
  return Object.keys(NOTES);
}

/** Key words in the question and what they mean (up to 4, most specific first). */
export function wordsIn(q: Question): { term: string; meaning: string }[] {
  const text = `${q.prompt} ${(q.choices ?? []).join(' ')}`;
  const found: { term: string; meaning: string }[] = [];
  const words: Record<SubjectId, Entry[]> = { maths: MATHS_WORDS, english: ENGLISH_WORDS, science: SCIENCE_WORDS };
  for (const [re, term, meaning] of words[getSkill(q.skillId).subject]) {
    if (re.test(text) && !found.some((f) => f.term === term)) found.push({ term, meaning });
    if (found.length >= 4) break;
  }
  return found;
}

const tidy = (s: string) => s.toLowerCase().replace(/−/g, '-');

/** True if the text gives the answer away. */
export function revealsAnswer(text: string, answer: string): boolean {
  const t = tidy(text), a = tidy(answer).trim().replace(/%$/, '');
  if (/^-?[\d.]+(\/\d+)?%?$|^\d+ \d+\/\d+$/.test(a)) {
    const escaped = a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return new RegExp(`(^|[^\\d.])${escaped}(?![\\d]|\\.\\d)`).test(t);
  }
  return t.includes(a);
}

/**
 * A first step for this particular question, taken from its worked
 * explanation but stopping before anything that gives the answer away.
 */
export function stepHint(q: Question): string | null {
  const sentences = q.explanation.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? [q.explanation];
  const safe: string[] = [];
  for (const s of sentences) {
    if (revealsAnswer(s, q.answer)) break;
    safe.push(s);
  }
  if (safe.length) return safe.join(' ');
  // The first sentence already contains a number answer: show the working
  // with the answer blanked out instead ("12 ÷ 2 = ?").
  // Not for multiple choice ("? is bigger" says nothing), and not when the
  // answer's number also appears in the question (masking it would be confusing).
  if (q.choices || revealsAnswer(q.prompt, q.answer)) return null;
  const masked = maskNumber(sentences[0], q.answer);
  if (!masked || revealsAnswer(masked, q.answer)) return null;
  // Skip "hints" that only repeat the question.
  const bare = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  return bare(q.prompt).includes(bare(masked.replace(/\?/g, ''))) ? null : masked;
}

/** Replace every standalone occurrence of a number answer with "?". */
function maskNumber(text: string, answer: string): string | null {
  const a = answer.trim().replace(/%$/, '');
  if (!/^-?[\d.]+(\/\d+)?$|^\d+ \d+\/\d+$/.test(a)) return null;
  const forms = [a, a.replace(/^-/, '−')].map((f) => f.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  const re = new RegExp(`(^|[^\\d.])(${forms.join('|')})(?![\\d]|\\.\\d)`, 'g');
  return text.replace(re, '$1?');
}

export type HintStep = { kind: 'tip'; text: string } | { kind: 'step'; text: string } | { kind: 'remove'; choice: string };

/** Hints in order, from general to specific. None of them gives the answer. */
export function hintLadder(q: Question, rng: () => number): HintStep[] {
  const ladder: HintStep[] = [{ kind: 'tip', text: skillTip(q.skillId) }];
  const step = stepHint(q);
  if (step) ladder.push({ kind: 'step', text: step });
  if (q.choices && q.choices.length >= 3) {
    const wrong = q.choices.filter((c) => c !== q.answer);
    ladder.push({ kind: 'remove', choice: wrong[Math.floor(rng() * wrong.length)] });
  }
  return ladder;
}
