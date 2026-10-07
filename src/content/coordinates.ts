import type { Level, Question } from '../brain/types';

export type CoordinatePoint = readonly [number, number];
type Rng = () => number;

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, values: readonly T[]): T => values[Math.floor(rng() * values.length)];

export function encodeCoordinatePoints(points: readonly CoordinatePoint[]): string {
  return [...points]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([x, y]) => `${x},${y}`)
    .join(';');
}

export function decodeCoordinatePoints(value: string): CoordinatePoint[] | null {
  const text = value.trim();
  if (!text) return [];
  const points: CoordinatePoint[] = [];
  for (const token of text.split(';')) {
    const match = token.trim().match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    points.push([Number(match[1]), Number(match[2])]);
  }
  return points;
}

export function sameCoordinatePointSet(a: string, b: string): boolean {
  const left = decodeCoordinatePoints(a);
  const right = decodeCoordinatePoints(b);
  if (!left || !right || left.length !== right.length) return false;
  return encodeCoordinatePoints(left) === encodeCoordinatePoints(right);
}

function coordinateBugs(points: readonly CoordinatePoint[], answer: string): [string, string][] {
  const candidates: [string, CoordinatePoint[]][] = [
    ['coord-swap-xy', points.map(([x, y]) => [y, x] as const)],
    ['coord-x-sign', points.map(([x, y]) => [-x, y] as const)],
    ['coord-y-sign', points.map(([x, y]) => [x, -y] as const)],
  ];
  const seen = new Set<string>();
  const bugs: [string, string][] = [];
  for (const [id, transformed] of candidates) {
    const encoded = encodeCoordinatePoints(transformed);
    if (encoded === answer || seen.has(encoded)) continue;
    seen.add(encoded);
    bugs.push([id, encoded]);
  }
  return bugs;
}

function makeCoordinateQuestion(
  level: Level,
  prompt: string,
  points: readonly CoordinatePoint[],
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  explanation: string,
  connect = false,
): Question {
  const answer = encodeCoordinatePoints(points);
  return {
    skillId: 'coordinates',
    level,
    id: `coordinates:${level}:${answer}`,
    prompt,
    answer,
    explanation,
    exact: true,
    bugs: coordinateBugs(points, answer),
    interaction: {
      kind: 'coordinate-plot',
      xValues: points.map(([x]) => x),
      yValues: points.map(([, y]) => y),
      ...bounds,
      connect,
    },
  };
}

function uniqueFirstQuadrantPoints(rng: Rng, count: number): CoordinatePoint[] {
  const points: CoordinatePoint[] = [];
  while (points.length < count) {
    const point: CoordinatePoint = [int(rng, 1, 6), int(rng, 1, 6)];
    if (!points.some(([x, y]) => x === point[0] && y === point[1])) points.push(point);
  }
  return points;
}

export function coordinates(level: Level, rng: Rng): Question {
  switch (level) {
    case 1: {
      const point: CoordinatePoint = [int(rng, 1, 5), int(rng, 1, 5)];
      return makeCoordinateQuestion(
        level,
        'Plot the point from the table on the coordinate grid.',
        [point],
        { xMin: 0, xMax: 6, yMin: 0, yMax: 6 },
        `Read x first and y second. The point is (${point[0]}, ${point[1]}).`,
      );
    }
    case 2: {
      const points = uniqueFirstQuadrantPoints(rng, 3);
      return makeCoordinateQuestion(
        level,
        'Plot all of the points from the table on the coordinate grid.',
        points,
        { xMin: 0, xMax: 7, yMin: 0, yMax: 7 },
        `For each column, read x first and y second. The plotted points are ${points.map(([x, y]) => `(${x}, ${y})`).join(', ')}.`,
      );
    }
    case 3: {
      const xValues = [-4, -2, 2, 4];
      const points = xValues.map((x, index) => {
        const sign = index % 2 === 0 ? -1 : 1;
        return [x, sign * int(rng, 1, 4)] as const;
      });
      return makeCoordinateQuestion(
        level,
        'Plot the points in all four quadrants.',
        points,
        { xMin: -6, xMax: 6, yMin: -6, yMax: 6 },
        'Start at the origin for each point. Move along the x-axis first, then move up or down to the y-coordinate.',
      );
    }
    case 4: {
      const slope = pick(rng, [-1, 1] as const);
      const intercept = int(rng, -3, 3);
      const xs = [-1, 0, 1];
      const points = xs.map((x) => [x, slope * x + intercept] as const);
      const sign = intercept >= 0 ? `+ ${intercept}` : `− ${Math.abs(intercept)}`;
      return makeCoordinateQuestion(
        level,
        'Graph the following points from the table of values to form a line.',
        points,
        { xMin: -6, xMax: 6, yMin: -6, yMax: 6 },
        `Each x-value pairs with the y-value beneath it. The points lie on the line y = ${slope === 1 ? 'x' : '−x'} ${sign}.`,
        true,
      );
    }
    case 5: {
      const slope = pick(rng, [-2, -1, 1, 2] as const);
      const intercept = int(rng, -2, 2);
      const xs = [-2, -1, 0, 1, 2];
      const points = xs.map((x) => [x, slope * x + intercept] as const);
      const slopeText = slope === 1 ? 'x' : slope === -1 ? '−x' : `${slope}x`;
      const interceptText = intercept === 0 ? '' : intercept > 0 ? ` + ${intercept}` : ` − ${Math.abs(intercept)}`;
      return makeCoordinateQuestion(
        level,
        'Plot the table of values, connect the points and identify the straight-line pattern.',
        points,
        { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
        `The table follows y = ${slopeText}${interceptText}. Plotting every ordered pair produces one straight line.`,
        true,
      );
    }
  }
}
