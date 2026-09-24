import { describe, expect, it } from 'vitest';
import { pickVoice, speakable } from './speech';

describe('read-aloud', () => {
  it('reads maths symbols as words', () => {
    expect(speakable('47 × 38 = ?')).toBe('47 times 38 equals what?');
    expect(speakable('The temperature is −7 °C. It rises by 14 °C.')).toBe('The temperature is minus 7 degrees Celsius. It rises by 14 degrees Celsius.');
    expect(speakable('12 − 5 = 7')).toBe('12 minus 5 equals 7');
    expect(speakable('What is 3/4 of 12,500?')).toBe('What is 3 over 4 of 12500?');
    expect(speakable('Count by 5s: 5, 10, __')).toBe('Count by 5s: 5, 10, blank');
    expect(speakable('Find 25% of 80 ÷ 2')).toBe('Find 25 percent of 80 divided by 2');
  });

  it('only ever uses an on-device English voice, British first', () => {
    const v = (lang: string, localService: boolean, isDefault = false) => ({ lang, localService, default: isDefault });
    expect(pickVoice([v('en-GB', false), v('en-US', true)])).toEqual(v('en-US', true));
    expect(pickVoice([v('en-US', true, true), v('en-GB', true)])).toEqual(v('en-GB', true));
    expect(pickVoice([v('en-GB', false), v('fr-FR', true)])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});
