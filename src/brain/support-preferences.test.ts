import { describe, expect, it } from 'vitest';
import { SUPPORT_PREFERENCE_DEFINITIONS, supportPreferencesFor } from './support-preferences';

describe('support preference catalogue', () => {
  it('uses unique strategy ids', () => {
    const ids = SUPPORT_PREFERENCE_DEFINITIONS.map((item) => item.strategy);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps learner choices bounded to non-diagnostic support strategies', () => {
    const text = JSON.stringify(supportPreferencesFor('learner')).toLowerCase();
    for (const diagnostic of ['adhd', 'autism', 'dyslexia', 'disorder', 'diagnosis']) {
      expect(text).not.toContain(diagnostic);
    }
  });

  it('allows parents to express additional support preferences without changing learner evidence', () => {
    const parent = supportPreferencesFor('parent').map((item) => item.strategy);
    expect(parent).toContain('extended-response-time');
    expect(parent).toContain('reduced-visual-density');
  });
});
