import { describe, expect, it } from 'vitest';
import { screen } from './safety';

describe('safety screen', () => {
  it('flags secrecy, a warning sign of grooming', () => {
    for (const text of ['Don\'t tell your parents about this', 'he said it is our little secret', 'She told me not to tell', 'keep this secret ok', 'never tell anyone']) {
      expect(screen(text), text).toBe('wellbeing');
    }
  });

  it('leaves ordinary practice chat alone', () => {
    for (const text of ['I don\'t get the fraction bit', 'Can you tell me a hint?', 'Is the answer secretary?', 'What is the secret to long division?']) {
      expect(screen(text), text).toBeNull();
    }
  });
});
