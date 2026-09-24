/** A strategy tip for each skill (never the answer). Used by the Problem Solver. */

const TIPS: Record<string, string> = {
  // Maths
  'number-sense': 'Count on or back one step at a time. For bigger numbers, compare the tens digit first.',
  addition: 'Add the ones first. If they make 10 or more, carry 1 to the tens.',
  subtraction: 'Start with the ones. If the top digit is smaller, exchange 1 ten for 10 ones first.',
  'place-value': 'Name the places from the right: ones, tens, hundreds, thousands. To round, look at the next digit: 5 or more rounds up.',
  multiplication: 'Use your times tables, or split the bigger number into tens and ones and multiply each part.',
  division: 'Division undoes multiplication: what times the number you\'re dividing by makes the big number?',
  fractions: 'To find a fraction of a number, divide by the bottom number, then multiply by the top number.',
  'negative-numbers': 'Picture a number line or a thermometer. Count to 0 first, then carry on past it.',
  'factors-primes': 'Factors divide exactly into a number and come in pairs. A prime has exactly two factors: 1 and itself.',
  'order-of-operations': 'Brackets first, then × and ÷, then + and −. Don\'t just go left to right.',
  'long-multiplication-division': 'Split the 2-digit number into tens and ones, multiply each part, then add. For division, estimate first.',
  'fractions-y6': 'Adding or subtracting? Make the bottom numbers the same first. Multiplying? Multiply tops and bottoms. Simplify at the end.',
  'decimals-percentages': 'Per cent means out of 100: 10% is ÷ 10 and 5% is half of 10%. × 10 moves digits one place left.',
  algebra: 'Do the opposite operation to undo each step. 3n means 3 × n.',
  'geometry-statistics': 'Straight line and triangle: 180°. Around a point and quadrilateral: 360°. Triangle area = ½ × base × height. Mean = total ÷ how many.',
  // English
  'spelling-words': 'Say the word slowly in syllables. Look out for double letters and silent letters.',
  'spelling-patterns': 'Think of a related word: caution → cautious, observation → observant, finance → financial.',
  homophones: 'Work out what the word has to mean in this sentence, then pick the spelling with that meaning.',
  'grammar-y6': 'Find the verb first. The subject does the verb; the object has it done to them.',
  'punctuation-y6': 'Check whether each part could stand on its own as a sentence.',
  // Science
  'living-things': 'Think about what living things need: food, water, air and (for plants) light.',
  'human-body': 'Picture where the organ is in the body and what job it does.',
  materials: 'Think about solids, liquids and gases, and what happens when things heat up or cool down.',
  'forces-energy': 'Forces are pushes and pulls. Think about which way things move and what slows them down.',
  'earth-space': 'Remember: Earth spins once a day and travels round the Sun once a year.',
  classification: 'Vertebrates have a backbone: fish, amphibians, reptiles, birds and mammals.',
  'circulatory-system': 'The heart pumps blood; arteries carry it away from the heart and veins bring it back.',
  'evolution-inheritance': 'Living things with helpful features survive and pass those features on to their young.',
  'light-y6': 'Light travels in straight lines, from a source to an object and into your eyes.',
  'electricity-y6': 'A series circuit is one loop. More cells: brighter. More bulbs: dimmer.',
};

export function skillTip(skillId: string): string {
  return TIPS[skillId] ?? 'Read the question carefully and take it one step at a time.';
}
