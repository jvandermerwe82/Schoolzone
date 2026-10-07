import { describe, expect, it } from 'vitest';
import { diagnose } from '../brain/misconceptions';
import { checkAnswer } from './index';
import {
  coordinates,
  decodeCoordinatePoints,
  encodeCoordinatePoints,
  sameCoordinatePointSet,
} from './coordinates';

function seeded(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('coordinate visual questions', () => {
  it('creates a structured coordinate interaction at every level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const question = coordinates(level, seeded([0.15, 0.35, 0.55, 0.75]));
      expect(question.skillId).toBe('coordinates');
      expect(question.interaction?.kind).toBe('coordinate-plot');
      expect(question.exact).toBe(true);
      expect(decodeCoordinatePoints(question.answer)?.length).toBeGreaterThan(0);
    }
  });

  it('accepts the same plotted points in any selection order', () => {
    const question = coordinates(4, seeded([0.8, 0.4, 0.2]));
    const points = decodeCoordinatePoints(question.answer)!;
    const reversed = [...points].reverse().map(([x, y]) => `(${x}, ${y})`).join(';');
    expect(checkAnswer(question, reversed)).toBe(true);
    expect(sameCoordinatePointSet(question.answer, reversed)).toBe(true);
  });

  it('recognises swapping x and y as a specific misconception', () => {
    const question = coordinates(4, seeded([0.8, 0.9, 0.2]));
    const swap = question.bugs?.find(([id]) => id === 'coord-swap-xy');
    expect(swap).toBeTruthy();
    expect(checkAnswer(question, swap![1])).toBe(false);
    expect(diagnose(question, swap![1], false)).toBe('coord-swap-xy');
  });

  it('uses a stable canonical encoding for plotted points', () => {
    expect(encodeCoordinatePoints([[2, -1], [-3, 4], [0, 0]])).toBe('-3,4;0,0;2,-1');
  });
});
