import type { Question } from '../brain/types';

export type AnimatedSupportKind = 'place-value' | 'column' | 'fraction' | 'groups';

export interface AnimatedSupportStep {
  title: string;
  text: string;
}

interface BaseSupport {
  kind: AnimatedSupportKind;
  title: string;
  steps: AnimatedSupportStep[];
}

export interface PlaceValueSupport extends BaseSupport {
  kind: 'place-value';
  digits: string[];
  places: string[];
  targetPlace: string | null;
}

export interface ColumnSupport extends BaseSupport {
  kind: 'column';
  operation: '+' | '−';
  top: string;
  bottom: string;
  regroup: boolean;
}

export interface FractionSupport extends BaseSupport {
  kind: 'fraction';
  fractions: { numerator: number; denominator: number }[];
  operation: '+' | '−' | '×' | '÷' | 'of' | 'compare' | 'simplify';
  amount?: number;
}

export interface GroupsSupport extends BaseSupport {
  kind: 'groups';
  operation: 'multiply' | 'divide';
  left: number;
  right: number;
}

export type AnimatedSupport =
  | PlaceValueSupport
  | ColumnSupport
  | FractionSupport
  | GroupsSupport;

const numberFrom = (value: string) => Number(value.replace(/,/g, ''));

function placeValueSupport(q: Question): PlaceValueSupport | null {
  const numberMatch = q.prompt.match(/(?:of|in|Round)\s+([\d,]+)/i)
    ?? q.prompt.match(/([\d,]{2,})/);
  if (!numberMatch) return null;
  const raw = numberMatch[1].replace(/,/g, '');
  if (!/^\d+$/.test(raw)) return null;

  const target = q.prompt.match(/\b(thousands|hundreds|tens|ones)\b/i)?.[1]?.toLowerCase() ?? null;
  const allPlaces = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];
  const places = raw
    .split('')
    .map((_, index) => allPlaces[raw.length - 1 - index] ?? `10^${raw.length - 1 - index}`);

  const steps: AnimatedSupportStep[] = [
    { title: 'Line up the places', text: 'Read the number from right to left: ones, tens, hundreds, then thousands.' },
    target
      ? { title: `Find the ${target}`, text: `Focus only on the ${target} column before you decide your answer.` }
      : { title: 'Find the target place', text: 'Look at the place named in the question and ignore the other digits for a moment.' },
    { title: 'Check the place value', text: 'Ask what the highlighted digit is worth in that position.' },
  ];

  return {
    kind: 'place-value',
    title: 'Place-value visual',
    digits: raw.split(''),
    places,
    targetPlace: target,
    steps,
  };
}

function columnSupport(q: Question): ColumnSupport | null {
  const match = q.prompt.match(/^(\d+)\s*([+−])\s*(\d+)\s*=\s*\?$/);
  if (!match) return null;
  const top = match[1];
  const bottom = match[3];
  const operation = match[2] as '+' | '−';
  const a = Number(top);
  const b = Number(bottom);
  const regroup = operation === '+'
    ? (a % 10) + (b % 10) >= 10
    : (a % 10) < (b % 10);

  const steps: AnimatedSupportStep[] = operation === '+'
    ? [
        { title: 'Line up the columns', text: 'Put ones under ones, tens under tens, and hundreds under hundreds.' },
        { title: 'Start with the ones', text: 'Add the ones column first.' },
        regroup
          ? { title: 'Regroup if needed', text: 'The ones make 10 or more, so carry one ten into the next column.' }
          : { title: 'Move left', text: 'When the ones are finished, move to the tens column.' },
      ]
    : [
        { title: 'Line up the columns', text: 'Put ones under ones, tens under tens, and hundreds under hundreds.' },
        { title: 'Start with the ones', text: 'Subtract the bottom ones digit from the top ones digit.' },
        regroup
          ? { title: 'Exchange one ten', text: 'The top ones digit is smaller, so exchange one ten for 10 ones before subtracting.' }
          : { title: 'Move left', text: 'When the ones are finished, move to the tens column.' },
      ];

  return {
    kind: 'column',
    title: operation === '+' ? 'Column addition visual' : 'Column subtraction visual',
    operation,
    top,
    bottom,
    regroup,
    steps,
  };
}

const fraction = (n: string, d: string) => ({
  numerator: Number(n),
  denominator: Number(d),
});

function fractionSupport(q: Question): FractionSupport | null {
  let match = q.prompt.match(/^(\d+)\/(\d+)\s*([+−×÷])\s*(\d+)\/(\d+)\s*=\s*\?/);
  if (match) {
    return {
      kind: 'fraction',
      title: 'Fraction visual',
      fractions: [fraction(match[1], match[2]), fraction(match[4], match[5])],
      operation: match[3] as '+' | '−' | '×' | '÷',
      steps: [
        { title: 'Read the denominators', text: 'The denominator tells you how many equal parts make the whole.' },
        match[3] === '+' || match[3] === '−'
          ? { title: 'Make the parts comparable', text: 'Before adding or subtracting, make sure both fractions use equal-sized parts.' }
          : { title: 'Follow the operation', text: match[3] === '×' ? 'For multiplication, work with the numerators and denominators separately.' : 'For division, think about how many groups of the second quantity fit.' },
        { title: 'Simplify at the end', text: 'When you finish the operation, check whether the fraction can be simplified.' },
      ],
    };
  }

  match = q.prompt.match(/^What is (\d+)\/(\d+) of (\d+)\?/i);
  if (match) {
    return {
      kind: 'fraction',
      title: 'Fraction-of-an-amount visual',
      fractions: [fraction(match[1], match[2])],
      operation: 'of',
      amount: Number(match[3]),
      steps: [
        { title: 'Split into equal parts', text: `Use the denominator to split ${match[3]} into equal groups.` },
        { title: 'Find one part first', text: 'Work out the size of one equal part before taking several parts.' },
        { title: 'Use the numerator', text: 'The numerator tells you how many of those equal parts to take.' },
      ],
    };
  }

  match = q.prompt.match(/^What is 1\/(\d+) of (\d+)\?/i);
  if (match) {
    return {
      kind: 'fraction',
      title: 'Unit-fraction visual',
      fractions: [fraction('1', match[1])],
      operation: 'of',
      amount: Number(match[2]),
      steps: [
        { title: 'Split the whole', text: `Divide ${match[2]} into ${match[1]} equal groups.` },
        { title: 'Take one group', text: 'A unit fraction has a numerator of 1, so you need one of those equal groups.' },
      ],
    };
  }

  match = q.prompt.match(/^What is half of (\d+)\?/i);
  if (match) {
    return {
      kind: 'fraction',
      title: 'Half visual',
      fractions: [{ numerator: 1, denominator: 2 }],
      operation: 'of',
      amount: Number(match[1]),
      steps: [
        { title: 'Make two equal groups', text: `Half means split ${match[1]} into 2 equal groups.` },
        { title: 'Use one group', text: 'One of the two equal groups is one half.' },
      ],
    };
  }

  match = q.prompt.match(/^Write (\d+)\/(\d+) in its simplest form/i);
  if (match) {
    return {
      kind: 'fraction',
      title: 'Simplifying fractions visual',
      fractions: [fraction(match[1], match[2])],
      operation: 'simplify',
      steps: [
        { title: 'Look for a common factor', text: 'Find a number that divides both the numerator and denominator exactly.' },
        { title: 'Divide both equally', text: 'Whatever you divide the top by, divide the bottom by the same number.' },
        { title: 'Check again', text: 'Stop when the top and bottom have no common factor greater than 1.' },
      ],
    };
  }

  if (/^Which fraction is bigger\?/i.test(q.prompt) && q.choices?.length === 2) {
    const parsed = q.choices
      .map((choice) => choice.match(/^(\d+)\/(\d+)$/))
      .filter((x): x is RegExpMatchArray => !!x)
      .map((x) => fraction(x[1], x[2]));
    if (parsed.length === 2) {
      return {
        kind: 'fraction',
        title: 'Compare fractions visual',
        fractions: parsed,
        operation: 'compare',
        steps: [
          { title: 'Compare equal-sized parts', text: 'If the denominators match, the fraction with more parts is larger.' },
          { title: 'If the numerators match', text: 'When both numerators are 1, fewer equal pieces means each piece is larger.' },
        ],
      };
    }
  }

  return null;
}

function groupsSupport(q: Question): GroupsSupport | null {
  const match = q.prompt.match(/^(\d+)\s*([×÷])\s*(\d+)\s*=\s*\?$/);
  if (!match) return null;
  const left = numberFrom(match[1]);
  const right = numberFrom(match[3]);
  const operation = match[2] === '×' ? 'multiply' : 'divide';

  return {
    kind: 'groups',
    title: operation === 'multiply' ? 'Equal-groups visual' : 'Division visual',
    operation,
    left,
    right,
    steps: operation === 'multiply'
      ? [
          { title: 'Think in equal groups', text: `Read this as equal groups rather than one long calculation.` },
          left > 12 || right > 12
            ? { title: 'Split a large factor', text: 'Break the larger factor into tens and ones, solve each part, then combine them.' }
            : { title: 'Build the groups', text: 'Use the same number in every group and count the groups carefully.' },
          { title: 'Check with the inverse', text: 'You can check multiplication by dividing the total back into equal groups.' },
        ]
      : [
          { title: 'Think: how many groups?', text: `You are splitting ${left} into equal groups of ${right}.` },
          { title: 'Use multiplication to help', text: `Ask: what number multiplied by ${right} would make ${left}?` },
          { title: 'Check the groups', text: 'Multiply your quotient by the divisor to check you get back to the starting amount.' },
        ],
  };
}

export function animatedSupportFor(q: Question): AnimatedSupport | null {
  if (q.skillId === 'place-value') return placeValueSupport(q);
  if (q.skillId === 'addition' || q.skillId === 'subtraction') return columnSupport(q);
  if (q.skillId === 'fractions' || q.skillId === 'fractions-y6') return fractionSupport(q);
  if (
    q.skillId === 'multiplication'
    || q.skillId === 'division'
    || q.skillId === 'long-multiplication-division'
  ) return groupsSupport(q);
  return null;
}
