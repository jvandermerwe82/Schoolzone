/**
 * Year 6 maths generators, following the national curriculum in England
 * (2014) Year 6 programme of study. Every answer is computed.
 * Negative answers are stored with an ASCII "-" and shown with "−".
 */
import type { Level, Question } from '../brain/types';
import { ignoreBrackets, leftToRight, withBugs } from './bugs';
import { gcd, int, pick, q, simplify, type Rng } from './maths';

const neg = (n: number) => String(n).replace('-', '−');

/** Proper or mixed number, simplified: 7/4 → "1 3/4". */
export function mixed(n: number, d: number): string {
  const g = gcd(n, d);
  const [sn, sd] = [n / g, d / g];
  const whole = Math.floor(sn / sd);
  const rest = sn % sd;
  if (rest === 0) return String(whole);
  return whole === 0 ? `${rest}/${sd}` : `${whole} ${rest}/${sd}`;
}

/** Exact decimal string for m / 10^scale, e.g. (375, 3) → "0.375". */
export function decimal(m: number, scale: number): string {
  if (scale <= 0) return String(m * 10 ** -scale);
  const sign = m < 0 ? '-' : '';
  const digits = String(Math.abs(m)).padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale);
  const frac = digits.slice(-scale).replace(/0+$/, '');
  return sign + whole + (frac ? `.${frac}` : '');
}

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};
const factorsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((i) => n % i === 0);
const nextPrime = (n: number) => { let p = n + 1; while (!isPrime(p)) p++; return p; };

function negativeNumbers(level: Level, rng: Rng): Question {
  const id = 'negative-numbers';
  switch (level) {
    case 1: {
      const a = int(rng, 0, 5), b = int(rng, a + 1, a + 6);
      return withBugs(q(id, level, `What is ${a} − ${b}?`, a - b,
        `Start at ${a} and count back ${b}. You pass 0 and land on ${neg(a - b)}.`), [['neg-sign', b - a]]);
    }
    case 2: {
      const t = -int(rng, 1, 9), r = int(rng, 1, 15);
      return withBugs(q(id, level, `The temperature is ${neg(t)} °C. It rises by ${r} °C. What is the temperature now?`, t + r,
        `Count up ${r} from ${neg(t)}: ${neg(t)} + ${r} = ${neg(t + r)} °C.`), [['neg-ignore-sign', -t + r], ['neg-sign', -(t + r)]]);
    }
    case 3: {
      const a = -int(rng, 1, 12), b = int(rng, 1, 15);
      return withBugs(q(id, level, `What is the difference between ${neg(a)} °C and ${b} °C?`, b - a,
        `From ${neg(a)} up to 0 is ${-a}, then 0 up to ${b} is ${b}. Together: ${-a} + ${b} = ${b - a}.`), [['neg-ignore-sign', Math.abs(b + a)]]);
    }
    case 4: {
      if (rng() < 0.5) {
        const a = -int(rng, 5, 20), b = int(rng, 1, 19);
        return withBugs(q(id, level, `What is ${neg(a)} + ${b}?`, a + b,
          `Start at ${neg(a)} and count up ${b}: ${neg(a + b)}.`), [['neg-ignore-sign', -a + b], ['neg-sign', -(a + b)]]);
      }
      const a = int(rng, 1, 15), b = int(rng, a + 1, 30);
      return withBugs(q(id, level, `What is ${a} − ${b}?`, a - b,
        `${b} is ${b - a} more than ${a}, so ${a} − ${b} = ${neg(a - b)}.`), [['neg-sign', b - a]]);
    }
    case 5: {
      if (rng() < 0.5) {
        const d = -int(rng, 20, 150), r = int(rng, 10, 200);
        return withBugs(q(id, level, `A submarine is at ${neg(d)} m (below sea level). It rises ${r} m. What is its new position in metres?`, d + r,
          `${neg(d)} + ${r} = ${neg(d + r)} m.`), [['neg-sign', -(d + r)], ['neg-ignore-sign', -d + r]]);
      }
      const f = -int(rng, 5, 25), k = int(rng, 12, 30);
      return withBugs(q(id, level, `A freezer is at ${neg(f)} °C and the kitchen is ${k} °C. How many degrees warmer is the kitchen?`, k - f,
        `From ${neg(f)} to 0 is ${-f}, and from 0 to ${k} is ${k}: ${-f} + ${k} = ${k - f} degrees.`), [['neg-ignore-sign', k + f]]);
    }
  }
}

function factorsPrimes(level: Level, rng: Rng): Question {
  const id = 'factors-primes';
  const nextPrimeQ = (n: number) => {
    const p = nextPrime(n);
    const skipped = Array.from({ length: p - n - 1 }, (_, i) => n + 1 + i);
    const why = skipped.length ? ` (${skipped.join(', ')} ${skipped.length === 1 ? 'is not prime' : 'are not prime'})` : '';
    const oddNonPrime = skipped.find((x) => x % 2 === 1 && x > 1);
    return withBugs(q(id, level, `What is the next prime number after ${n}?`, p,
      `A prime number has exactly two factors: 1 and itself. The next one after ${n} is ${p}${why}.`), [['prime-odd', oddNonPrime]]);
  };
  const hcfQ = (a: number, b: number) => {
    const h = gcd(a, b);
    return withBugs(q(id, level, `What is the highest common factor (HCF) of ${a} and ${b}?`, h,
      `Factors of ${a}: ${factorsOf(a).join(', ')}. Factors of ${b}: ${factorsOf(b).join(', ')}. The highest one in both lists is ${h}.`),
    [['hcf-lcm-mixup', (a * b) / h]]);
  };
  switch (level) {
    case 1: return nextPrimeQ(int(rng, 2, 20));
    case 2: {
      const n = int(rng, 6, 40);
      const f = factorsOf(n);
      return q(id, level, `How many factors does ${n} have?`, f.length, `The factors of ${n} are ${f.join(', ')}. That is ${f.length} factors.`);
    }
    case 3: {
      const g = int(rng, 2, 8);
      const a = g * int(rng, 1, 6);
      let b = g * int(rng, 1, 6);
      while (b === a) b = g * int(rng, 1, 6);
      return hcfQ(a, b);
    }
    case 4: {
      const a = int(rng, 2, 12);
      let b = int(rng, 2, 12);
      while (b === a) b = int(rng, 2, 12);
      const l = (a * b) / gcd(a, b);
      const multiples = (n: number) => Array.from({ length: l / n }, (_, i) => n * (i + 1)).join(', ');
      return withBugs(q(id, level, `What is the lowest common multiple (LCM) of ${a} and ${b}?`, l,
        `Multiples of ${a}: ${multiples(a)}. Multiples of ${b}: ${multiples(b)}. The first one in both lists is ${l}.`),
      [['lcm-product', a * b], ['hcf-lcm-mixup', gcd(a, b)]]);
    }
    case 5: {
      if (rng() < 0.5) return nextPrimeQ(int(rng, 30, 100));
      const g = pick(rng, [6, 8, 12, 14, 16]);
      const a = g * int(rng, 2, 6);
      let b = g * int(rng, 2, 6);
      while (b === a) b = g * int(rng, 2, 6);
      return hcfQ(a, b);
    }
  }
}

function orderOfOperations(level: Level, rng: Rng): Question {
  const id = 'order-of-operations';
  const rule = 'Brackets first, then × and ÷, then + and −.';
  switch (level) {
    case 1: {
      const a = int(rng, 1, 20), b = int(rng, 2, 9), c = int(rng, 2, 9);
      return q(id, level, `${a} + ${b} × ${c} = ?`, a + b * c, `${rule} ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${a + b * c}.`);
    }
    case 2: {
      if (rng() < 0.5) {
        const a = int(rng, 2, 9), b = int(rng, 2, 9), c = int(rng, 1, a * b);
        return q(id, level, `${a} × ${b} − ${c} = ?`, a * b - c, `${rule} ${a} × ${b} = ${a * b}, then ${a * b} − ${c} = ${a * b - c}.`);
      }
      const c = int(rng, 2, 9), b = c * int(rng, 2, 9), a = int(rng, 1, 30);
      return q(id, level, `${a} + ${b} ÷ ${c} = ?`, a + b / c, `${rule} ${b} ÷ ${c} = ${b / c}, then ${a} + ${b / c} = ${a + b / c}.`);
    }
    case 3: {
      const a = int(rng, 2, 12), b = int(rng, 1, 12), c = int(rng, 2, 9);
      if (rng() < 0.5) {
        return q(id, level, `(${a} + ${b}) × ${c} = ?`, (a + b) * c, `${rule} ${a} + ${b} = ${a + b}, then ${a + b} × ${c} = ${(a + b) * c}.`);
      }
      const big = a + b;
      return q(id, level, `(${big} − ${b}) × ${c} = ?`, a * c, `${rule} ${big} − ${b} = ${a}, then ${a} × ${c} = ${a * c}.`);
    }
    case 4: {
      const a = int(rng, 2, 9), c = int(rng, 1, 9), b = c + int(rng, 1, 9), d = int(rng, 1, 20);
      const r = a * (b - c) + d;
      return q(id, level, `${a} × (${b} − ${c}) + ${d} = ?`, r,
        `${rule} ${b} − ${c} = ${b - c}, then ${a} × ${b - c} = ${a * (b - c)}, then + ${d} = ${r}.`);
    }
    case 5: {
      const a = int(rng, 2, 9), b = int(rng, 1, 9), c = int(rng, 2, 9), e = int(rng, 2, 9);
      const product = (a + b) * c;
      const k = int(rng, 1, Math.max(1, Math.floor(product / e)));
      const d = e * k;
      const r = product - k;
      return q(id, level, `(${a} + ${b}) × ${c} − ${d} ÷ ${e} = ?`, r,
        `${rule} (${a} + ${b}) = ${a + b}; ${a + b} × ${c} = ${product}; ${d} ÷ ${e} = ${k}; ${product} − ${k} = ${r}.`);
    }
  }
}

function longMultiplicationDivision(level: Level, rng: Rng): Question {
  const id = 'long-multiplication-division';
  const mult = (a: number, b: number) => {
    const tens = Math.floor(b / 10) * 10, ones = b % 10;
    const expl = b < 10
      ? `Multiply each digit of ${a} by ${b}, carrying as you go: ${a} × ${b} = ${a * b}.`
      : `Split ${b} into ${tens} and ${ones}: ${a} × ${tens} = ${a * tens}, ${a} × ${ones} = ${a * ones}. Add them: ${a * tens} + ${a * ones} = ${a * b}.`;
    return q(id, level, `${a} × ${b} = ?`, a * b, expl);
  };
  const div = (d: number, quotient: number) => {
    const n = d * quotient;
    return q(id, level, `${n} ÷ ${d} = ?`, quotient,
      `Work through ${n} from the left, dividing by ${d} each time. Check: ${quotient} × ${d} = ${n}.`);
  };
  switch (level) {
    case 1: return mult(int(rng, 100, 999), int(rng, 2, 9));
    case 2: return mult(int(rng, 12, 99), int(rng, 12, 99));
    case 3: return mult(int(rng, 100, 999), int(rng, 12, 99));
    case 4: return rng() < 0.5 ? div(int(rng, 2, 9), int(rng, 100, 999)) : div(int(rng, 11, 25), int(rng, 11, 40));
    case 5: {
      if (rng() < 0.5) return mult(int(rng, 1000, 9999), int(rng, 11, 99));
      const d = int(rng, 12, 99);
      return div(d, int(rng, 12, Math.min(99, Math.floor(9999 / d))));
    }
  }
}

function fractionsY6(level: Level, rng: Rng): Question {
  const id = 'fractions-y6';
  switch (level) {
    case 1: {
      const d = int(rng, 3, 12);
      let n = int(rng, 1, d - 1);
      while (gcd(n, d) !== 1) n = int(rng, 1, d - 1);
      const k = int(rng, 2, 6);
      return {
        ...q(id, level, `Write ${n * k}/${d * k} in its simplest form.`, `${n}/${d}`,
          `The highest common factor of ${n * k} and ${d * k} is ${k}. Divide both by ${k}: ${n}/${d}.`),
        exact: true,
      };
    }
    case 2: {
      const d1 = pick(rng, [2, 3, 4, 5]), m = pick(rng, [2, 3]), d2 = d1 * m;
      const a = int(rng, 1, d1 - 1), b = int(rng, 1, d2 - 1);
      const top = a * m + b;
      return q(id, level, `${a}/${d1} + ${b}/${d2} = ?`, mixed(top, d2),
        `Make the denominators the same: ${a}/${d1} = ${a * m}/${d2}. Then ${a * m}/${d2} + ${b}/${d2} = ${top}/${d2}` +
        (mixed(top, d2) === `${top}/${d2}` ? '.' : ` = ${mixed(top, d2)}.`));
    }
    case 3: {
      const [d1, d2] = pick(rng, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [4, 3]] as const);
      const a = int(rng, 1, d1 - 1), b = int(rng, 1, d2 - 1);
      const common = d1 * d2;
      let x = a * d2, y = b * d1;
      let op = '+';
      if (rng() < 0.5 && x !== y) { op = '−'; }
      let [p1, p2] = [`${a}/${d1}`, `${b}/${d2}`];
      if (op === '−' && x < y) { [x, y] = [y, x]; [p1, p2] = [p2, p1]; }
      const top = op === '+' ? x + y : x - y;
      return q(id, level, `${p1} ${op} ${p2} = ?`, mixed(top, common),
        `Use a common denominator of ${common}: ${x}/${common} ${op} ${y}/${common} = ${top}/${common}` +
        (mixed(top, common) === `${top}/${common}` ? '.' : ` = ${mixed(top, common)}.`));
    }
    case 4: {
      const b = int(rng, 2, 6), d = int(rng, 2, 6);
      const a = int(rng, 1, b - 1), c = int(rng, 1, d - 1);
      const ans = simplify(a * c, b * d);
      return {
        ...q(id, level, `${a}/${b} × ${c}/${d} = ?  Give your answer in its simplest form.`, ans,
          `Multiply the tops and the bottoms: ${a * c}/${b * d}` + (ans === `${a * c}/${b * d}` ? '.' : `, which simplifies to ${ans}.`)),
        exact: true,
      };
    }
    case 5: {
      if (rng() < 0.5) {
        const d = int(rng, 2, 6), n = int(rng, 1, d - 1), w = int(rng, 2, 5);
        const ans = simplify(n, d * w);
        return q(id, level, `${n}/${d} ÷ ${w} = ?`, ans,
          `Dividing by ${w} is the same as multiplying the denominator by ${w}: ${n}/${d * w}` + (ans === `${n}/${d * w}` ? '.' : ` = ${ans}.`));
      }
      const [d1, d2] = pick(rng, [[2, 3], [2, 4], [3, 4], [2, 5], [4, 8], [3, 6]] as const);
      const w1 = int(rng, 1, 3), w2 = int(rng, 1, 3);
      const a = int(rng, 1, d1 - 1), b = int(rng, 1, d2 - 1);
      const l = (d1 * d2) / gcd(d1, d2);
      const top = (w1 + w2) * l + a * (l / d1) + b * (l / d2);
      return q(id, level, `${w1} ${a}/${d1} + ${w2} ${b}/${d2} = ?`, mixed(top, l),
        `Add the whole numbers: ${w1} + ${w2} = ${w1 + w2}. Add the fractions using ${l} as the denominator: ` +
        `${a * (l / d1)}/${l} + ${b * (l / d2)}/${l} = ${a * (l / d1) + b * (l / d2)}/${l}. Total: ${mixed(top, l)}.`);
    }
  }
}

function decimalsPercentages(level: Level, rng: Rng): Question {
  const id = 'decimals-percentages';
  switch (level) {
    case 1: {
      const [n, d] = pick(rng, [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 10], [3, 10], [7, 10], [1, 100]] as const);
      const hundredths = (n * 100) / d;
      if (rng() < 0.5) {
        return q(id, level, `Write ${n}/${d} as a decimal.`, decimal(hundredths, 2),
          `${n}/${d} = ${hundredths}/100 = ${decimal(hundredths, 2)}.`);
      }
      return q(id, level, `Write ${n}/${d} as a percentage.`, `${hundredths}%`,
        `Per cent means "out of 100". ${n}/${d} = ${hundredths}/100 = ${hundredths}%.`);
    }
    case 2: {
      const p = pick(rng, [10, 100, 1000]);
      const places = Math.log10(p);
      if (rng() < 0.5) {
        const m = int(rng, 11, 999), scale = pick(rng, [1, 2]);
        const x = decimal(m, scale);
        return q(id, level, `${x} × ${p} = ?`, decimal(m, scale - places),
          `Multiplying by ${p} moves each digit ${places} place${places > 1 ? 's' : ''} to the left: ${decimal(m, scale - places)}.`);
      }
      const scale = p === 1000 ? 0 : p === 100 ? pick(rng, [0, 1]) : pick(rng, [0, 1, 2]);
      const m = int(rng, 1, 999);
      const x = decimal(m, scale);
      return q(id, level, `${x} ÷ ${p} = ?`, decimal(m, scale + places),
        `Dividing by ${p} moves each digit ${places} place${places > 1 ? 's' : ''} to the right: ${decimal(m, scale + places)}.`);
    }
    case 3: {
      const pct = pick(rng, [10, 20, 25, 50, 75]);
      const amount = 20 * int(rng, 1, 20);
      const ans = (pct * amount) / 100;
      const how = pct === 50 ? 'halve it' : pct === 25 ? 'divide by 4' : pct === 75 ? 'find 25% (÷ 4) and multiply by 3'
        : pct === 10 ? 'divide by 10' : 'find 10% (÷ 10) and double it';
      return q(id, level, `What is ${pct}% of ${amount}?`, ans, `To find ${pct}%, ${how}: ${pct}% of ${amount} = ${ans}.`);
    }
    case 4: {
      const pct = pick(rng, [5, 15, 30, 35, 45, 60, 65, 85]);
      const amount = 20 * int(rng, 2, 25);
      const ten = amount / 10, five = amount / 20;
      const ans = (pct * amount) / 100;
      return q(id, level, `What is ${pct}% of ${amount}?`, ans,
        `10% of ${amount} is ${ten} and 5% is ${five}. Build ${pct}% from those: ${pct}% of ${amount} = ${ans}.`);
    }
    case 5: {
      if (rng() < 0.5) {
        const n = pick(rng, [1, 3, 5, 7]);
        return q(id, level, `Write ${n}/8 as a decimal.`, decimal(n * 125, 3),
          `1/8 = 1 ÷ 8 = 0.125, so ${n}/8 = ${n} × 0.125 = ${decimal(n * 125, 3)}.`);
      }
      const m = int(rng, 101, 999), w = int(rng, 2, 9);
      return q(id, level, `${decimal(m, 2)} × ${w} = ?`, decimal(m * w, 2),
        `Work out ${m} × ${w} = ${m * w}, then put the 2 decimal places back: ${decimal(m * w, 2)}.`);
    }
  }
}

function algebra(level: Level, rng: Rng): Question {
  const id = 'algebra';
  switch (level) {
    case 1: {
      const n = int(rng, 5, 60), b = int(rng, 3, 40);
      if (rng() < 0.5) return q(id, level, `n + ${b} = ${n + b}. What is n?`, n, `Undo the + ${b}: ${n + b} − ${b} = ${n}.`);
      return q(id, level, `n − ${b} = ${n}. What is n?`, n + b, `Undo the − ${b}: ${n} + ${b} = ${n + b}.`);
    }
    case 2: {
      const a = int(rng, 2, 12), n = int(rng, 2, 12);
      return q(id, level, `${a}n = ${a * n}. What is n?`, n, `${a}n means ${a} × n. Undo it: ${a * n} ÷ ${a} = ${n}.`);
    }
    case 3: {
      const a = int(rng, 2, 9), n = int(rng, 2, 12), b = int(rng, 1, 20);
      return q(id, level, `${a}n + ${b} = ${a * n + b}. What is n?`, n,
        `Subtract ${b}: ${a}n = ${a * n}. Divide by ${a}: n = ${n}.`);
    }
    case 4: {
      const kind = int(rng, 0, 2);
      if (kind === 0) {
        const s = int(rng, 3, 25);
        return q(id, level, `The perimeter of a square is P = 4s. What is P when s = ${s}?`, 4 * s, `P = 4 × ${s} = ${4 * s}.`);
      }
      if (kind === 1) {
        const n = int(rng, 2, 12), c = int(rng, 3, 9), f = int(rng, 1, 10);
        return q(id, level, `Tickets cost C = ${c}n + ${f} pounds for n people. What is C when n = ${n}?`, c * n + f,
          `C = ${c} × ${n} + ${f} = ${c * n} + ${f} = ${c * n + f}.`);
      }
      const s = int(rng, 1, 20), d = int(rng, 2, 9);
      return q(id, level, `A sequence starts at ${s} and goes up by ${d} each time. What is the 10th term?`, s + 9 * d,
        `From the 1st term to the 10th there are 9 steps of ${d}: ${s} + 9 × ${d} = ${s + 9 * d}.`);
    }
    case 5: {
      if (rng() < 0.5) {
        const a = int(rng, 1, 20), d = int(rng, 2, 9);
        const seq = [0, 1, 2, 3].map((i) => a + i * d).join(', ');
        return q(id, level, `A sequence goes ${seq}, … What is the 20th term?`, a + 19 * d,
          `It goes up by ${d} each time. The 20th term is 19 steps after the first: ${a} + 19 × ${d} = ${a + 19 * d}.`);
      }
      const a = int(rng, 2, 9), n = int(rng, 3, 15), b = int(rng, 1, a * n - 1);
      return q(id, level, `${a}n − ${b} = ${a * n - b}. What is n?`, n,
        `Add ${b}: ${a}n = ${a * n}. Divide by ${a}: n = ${n}.`);
    }
  }
}

function geometryStatistics(level: Level, rng: Rng): Question {
  const id = 'geometry-statistics';
  const meanQ = (count: number, lo: number, hi: number) => {
    const m = int(rng, lo, hi);
    const xs: number[] = [];
    for (let i = 0; i < count - 1; i++) xs.push(m + int(rng, -Math.floor(m / 2), Math.floor(m / 2)));
    const last = m * count - xs.reduce((a, b) => a + b, 0);
    if (last <= 0) return meanQ(count, lo, hi);
    xs.push(last);
    const total = m * count;
    return q(id, level, `What is the mean of ${xs.join(', ')}?`, m,
      `Add them up: ${xs.join(' + ')} = ${total}. Divide by how many there are (${count}): ${total} ÷ ${count} = ${m}.`);
  };
  switch (level) {
    case 1: {
      const x = int(rng, 20, 160);
      return q(id, level, `Two angles sit on a straight line. One is ${x}°. What is the other, in degrees?`, 180 - x,
        `Angles on a straight line add up to 180°: 180 − ${x} = ${180 - x}°.`);
    }
    case 2: {
      const a = int(rng, 20, 100), b = int(rng, 20, 150 - a);
      return q(id, level, `A triangle has angles of ${a}° and ${b}°. What is the third angle, in degrees?`, 180 - a - b,
        `Angles in a triangle add up to 180°: 180 − ${a} − ${b} = ${180 - a - b}°.`);
    }
    case 3: {
      if (rng() < 0.3) {
        const r = int(rng, 2, 30);
        return q(id, level, `A circle has a radius of ${r} cm. What is its diameter, in cm?`, 2 * r,
          `The diameter is twice the radius: 2 × ${r} = ${2 * r} cm.`);
      }
      const b = 2 * int(rng, 1, 10), h = int(rng, 2, 20);
      return q(id, level, `A triangle has a base of ${b} cm and a perpendicular height of ${h} cm. What is its area in cm²?`, (b * h) / 2,
        `Area of a triangle = ½ × base × height = ½ × ${b} × ${h} = ${(b * h) / 2} cm².`);
    }
    case 4: {
      if (rng() < 0.5) {
        const b = int(rng, 3, 15), h = int(rng, 2, 12);
        return q(id, level, `A parallelogram has a base of ${b} cm and a perpendicular height of ${h} cm. What is its area in cm²?`, b * h,
          `Area of a parallelogram = base × height = ${b} × ${h} = ${b * h} cm².`);
      }
      return meanQ(4, 6, 20);
    }
    case 5: {
      const kind = int(rng, 0, 2);
      if (kind === 0) {
        const [n, name] = pick(rng, [[5, 'pentagon'], [6, 'hexagon'], [8, 'octagon'], [9, 'nonagon'], [10, 'decagon'], [12, 'dodecagon']] as const);
        const each = ((n - 2) * 180) / n;
        return q(id, level, `What is the size of each interior angle of a regular ${name} (${n} sides), in degrees?`, each,
          `The interior angles of a ${n}-sided shape add up to (${n} − 2) × 180 = ${(n - 2) * 180}°. Shared equally: ${(n - 2) * 180} ÷ ${n} = ${each}°.`);
      }
      if (kind === 1) {
        const a = int(rng, 50, 130), b = int(rng, 50, 130), c = int(rng, 40, Math.min(130, 330 - a - b));
        return q(id, level, `A quadrilateral has angles of ${a}°, ${b}° and ${c}°. What is the fourth angle, in degrees?`, 360 - a - b - c,
          `Angles in a quadrilateral add up to 360°: 360 − ${a} − ${b} − ${c} = ${360 - a - b - c}°.`);
      }
      return meanQ(5, 20, 80);
    }
  }
}

const n = (x: string) => Number(x);

/**
 * Attach the answers that common mistakes would give, worked out from the
 * question itself. (Negative numbers and factors attach theirs directly.)
 */
function addBugs(q: Question): Question {
  const p = q.prompt;
  let m: RegExpMatchArray | null;
  switch (q.skillId) {
    case 'order-of-operations': {
      const tokens = (p.replace(' = ?', '').match(/\d+|[()+−×÷]/g) ?? []).map((t) => (/\d/.test(t) ? Number(t) : t));
      const bugs: [string, number][] = [['order-left-to-right', leftToRight(tokens)], ['order-ignore-brackets', ignoreBrackets(tokens)]];
      return withBugs(q, p.includes('(') ? bugs.reverse() : bugs);
    }
    case 'long-multiplication-division':
      if ((m = p.match(/^(\d+) × (\d+) = \?$/)) && n(m[2]) >= 10) {
        const [a, b] = [n(m[1]), n(m[2])];
        return withBugs(q, [['long-mult-place-value', a * Math.floor(b / 10) + a * (b % 10)], ['mult-added', a + b]]);
      }
      return q;
    case 'fractions-y6':
      if ((m = p.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+) = \?$/))) return withBugs(q, [['frac-add-across', `${n(m[1]) + n(m[3])}/${n(m[2]) + n(m[4])}`]]);
      if ((m = p.match(/^(\d+) (\d+)\/(\d+) \+ (\d+) (\d+)\/(\d+) = \?$/))) {
        return withBugs(q, [['frac-add-across', n(m[1]) + n(m[4]) + (n(m[2]) + n(m[5])) / (n(m[3]) + n(m[6]))]]);
      }
      if ((m = p.match(/^(\d+)\/(\d+) ÷ (\d+) = \?$/))) return withBugs(q, [['frac-div-multiplied', simplify(n(m[1]) * n(m[3]), n(m[2]))]]);
      return q;
    case 'decimals-percentages':
      if ((m = p.match(/^Write (\d+)\/(\d+) as a decimal\.$/))) return withBugs(q, [['dec-fraction-digits', `${m[1]}.${m[2]}`]]);
      if ((m = p.match(/^([\d.]+) × (\d+) = \?$/)) && n(m[2]) % 10 === 0) {
        return withBugs(q, [['dec-add-zero', n(m[1])], ['dec-wrong-direction', n(m[1]) / n(m[2])]]);
      }
      if ((m = p.match(/^([\d.]+) ÷ (\d+) = \?$/))) return withBugs(q, [['dec-wrong-direction', n(m[1]) * n(m[2])]]);
      if ((m = p.match(/^What is (\d+)% of (\d+)\?$/))) return withBugs(q, [['pct-divide', n(m[2]) / n(m[1])]]);
      return q;
    case 'algebra':
      if ((m = p.match(/^n \+ (\d+) = (\d+)\./))) return withBugs(q, [['algebra-wrong-inverse', n(m[2]) + n(m[1])]]);
      if ((m = p.match(/^n − (\d+) = (\d+)\./))) return withBugs(q, [['algebra-wrong-inverse', n(m[2]) - n(m[1])]]);
      if ((m = p.match(/^(\d+)n = (\d+)\./))) return withBugs(q, [['algebra-an-as-sum', n(m[2]) - n(m[1])]]);
      if ((m = p.match(/^(\d+)n \+ (\d+) = (\d+)\./))) {
        return withBugs(q, [['algebra-wrong-inverse', (n(m[3]) + n(m[2])) / n(m[1])], ['algebra-order', n(m[3]) / n(m[1]) - n(m[2])]]);
      }
      if ((m = p.match(/^(\d+)n − (\d+) = (\d+)\./))) {
        return withBugs(q, [['algebra-wrong-inverse', (n(m[3]) - n(m[2])) / n(m[1])], ['algebra-order', n(m[3]) / n(m[1]) + n(m[2])]]);
      }
      if ((m = p.match(/P = 4s\. What is P when s = (\d+)/))) return withBugs(q, [['algebra-an-as-sum', 4 + n(m[1])]]);
      if ((m = p.match(/C = (\d+)n \+ (\d+) pounds .* n = (\d+)/))) return withBugs(q, [['algebra-an-as-sum', n(m[1]) + n(m[3]) + n(m[2])]]);
      if ((m = p.match(/starts at (\d+) and goes up by (\d+) each time/))) return withBugs(q, [['sequence-off-by-one', n(m[1]) + 10 * n(m[2])]]);
      if ((m = p.match(/sequence goes (\d+), (\d+),/))) return withBugs(q, [['sequence-off-by-one', n(m[1]) + 20 * (n(m[2]) - n(m[1]))]]);
      return q;
    case 'geometry-statistics':
      if ((m = p.match(/straight line\. One is (\d+)°/))) return withBugs(q, [['angle-wrong-total', 360 - n(m[1])]]);
      if ((m = p.match(/triangle has angles of (\d+)° and (\d+)°/))) return withBugs(q, [['angle-wrong-total', 360 - n(m[1]) - n(m[2])]]);
      if ((m = p.match(/triangle has a base of (\d+) cm and a perpendicular height of (\d+) cm/))) return withBugs(q, [['area-no-half', n(m[1]) * n(m[2])]]);
      if ((m = p.match(/parallelogram has a base of (\d+) cm and a perpendicular height of (\d+) cm/))) return withBugs(q, [['area-halved', (n(m[1]) * n(m[2])) / 2]]);
      if ((m = p.match(/radius of (\d+) cm/))) return withBugs(q, [['radius-diameter', n(m[1]) / 2]]);
      if ((m = p.match(/^What is the mean of ([\d, ]+)\?$/))) return withBugs(q, [['mean-no-divide', m[1].split(', ').map(Number).reduce((a, b) => a + b, 0)]]);
      if ((m = p.match(/regular \w+ \((\d+) sides\)/))) return withBugs(q, [['polygon-exterior', 360 / n(m[1])]]);
      return q;
    default:
      return q;
  }
}

const GENERATORS: Record<string, (level: Level, rng: Rng) => Question> = {
  'negative-numbers': negativeNumbers,
  'factors-primes': factorsPrimes,
  'order-of-operations': orderOfOperations,
  'long-multiplication-division': longMultiplicationDivision,
  'fractions-y6': fractionsY6,
  'decimals-percentages': decimalsPercentages,
  algebra,
  'geometry-statistics': geometryStatistics,
};

export const MATHS_Y6_GENERATORS: Record<string, (level: Level, rng: Rng) => Question> = Object.fromEntries(
  Object.entries(GENERATORS).map(([id, gen]) => [id, (level: Level, rng: Rng) => addBugs(gen(level, rng))]),
);
