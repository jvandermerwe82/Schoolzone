import { describe, expect, it } from 'vitest';
import { SKILLS } from '../content/skills';
import {
  AUSTRALIAN_V9_EXISTING_SKILL_AUDIT,
  AUSTRALIAN_V9_EXISTING_SKILL_MAPPINGS,
  AUSTRALIAN_V9_REFERENCES,
  australianMappingsForSkill,
  australianReference,
} from './australia-v9-mapping';

describe('Australian Curriculum v9 reuse audit', () => {
  it('audits every current canonical SchoolZone skill exactly once', () => {
    const ids = AUSTRALIAN_V9_EXISTING_SKILL_AUDIT.map((item) => item.skillId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(SKILLS.map((skill) => skill.id)));
  });

  it('only maps to curriculum references that exist in the pack', () => {
    const refs = new Set(AUSTRALIAN_V9_REFERENCES.map((item) => item.id));
    for (const mapping of AUSTRALIAN_V9_EXISTING_SKILL_MAPPINGS) {
      expect(refs.has(mapping.curriculumRefId)).toBe(true);
    }
  });

  it('distinguishes partial content reuse from verified mapping confidence', () => {
    const mapping = australianMappingsForSkill('negative-numbers').find((item) => item.curriculumRefId.endsWith('AC9M6N01'));
    expect(mapping?.confidence).toBe('verified');
    expect(mapping?.coverage).toBe('partial');
  });

  it('finds a verified reference by official content code', () => {
    expect(australianReference('AC9S6U03')).toMatchObject({
      frameworkId: 'au-ac-v9',
      subject: 'science',
      yearLevel: '6',
    });
  });

  it('does not silently invent unknown codes', () => {
    expect(australianReference('AC9M99FAKE')).toBeNull();
  });
});
