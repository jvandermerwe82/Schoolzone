import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from './consent-version';
import { LEARNING_INTELLIGENCE_VERSION } from './brain/learning-intelligence';
import { PILOT_EVIDENCE_VERSION } from './pilot-evidence';
import { PILOT_ANALYTICS_VERSION, PILOT_STAGE0_THRESHOLDS } from './pilot-analytics';
import { AUSTRALIAN_CURRICULUM_V9, AUSTRALIA_INITIAL_SCOPE } from './curriculum/australia';
import { BRAIN_LAB_THRESHOLDS } from './brain-lab/benchmark';
import { SUPPORT_LAB_THRESHOLDS } from './brain-lab/support-learning';
import { MISCONCEPTION_LAB_THRESHOLDS } from './brain-lab/misconception-learning';
import { RETENTION_LAB_THRESHOLDS } from './brain-lab/retention';
import { TEACHER_INTENT_LAB_THRESHOLDS } from './brain-lab/teacher-intent';
import {
  PILOT_ANALYSIS_PROVENANCE_VERSION,
  PILOT_VERSION_MANIFEST_VERSION,
  parsePilotVersionManifest,
  pilotAnalysisProvenance,
  pilotVersionManifest,
  pilotVersionManifestMarkdown,
} from './pilot-version-manifest';

const SHA = '8c74433c1b9b86a2caf64f5fd3f4b9d2191d41db';

describe('Pilot Version Manifest v1', () => {
  it('captures all versioned contracts and curriculum metadata by value', () => {
    const manifest = pilotVersionManifest(SHA);

    expect(manifest).toMatchObject({
      manifestVersion: PILOT_VERSION_MANIFEST_VERSION,
      sourceGitSha: SHA,
      contracts: {
        consentVersion: CONSENT_VERSION,
        learningIntelligenceVersion: LEARNING_INTELLIGENCE_VERSION,
        pilotEvidenceVersion: PILOT_EVIDENCE_VERSION,
        pilotAnalyticsVersion: PILOT_ANALYTICS_VERSION,
      },
      curriculum: {
        id: AUSTRALIAN_CURRICULUM_V9.id,
        name: AUSTRALIAN_CURRICULUM_V9.name,
        jurisdiction: AUSTRALIAN_CURRICULUM_V9.jurisdiction,
        version: AUSTRALIAN_CURRICULUM_V9.version,
        source: AUSTRALIAN_CURRICULUM_V9.source,
        initialScope: {
          yearLevels: [...AUSTRALIA_INITIAL_SCOPE.yearLevels],
          subjects: [...AUSTRALIA_INITIAL_SCOPE.subjects],
        },
      },
    });
  });

  it('locks every protected gate used by the pilot stack', () => {
    const manifest = pilotVersionManifest(SHA);
    expect(manifest.protectedGates).toEqual({
      academic: BRAIN_LAB_THRESHOLDS,
      supportLearning: SUPPORT_LAB_THRESHOLDS,
      misconceptionLearning: MISCONCEPTION_LAB_THRESHOLDS,
      retention: RETENTION_LAB_THRESHOLDS,
      teacherIntent: TEACHER_INTENT_LAB_THRESHOLDS,
      pilotStage0: PILOT_STAGE0_THRESHOLDS,
    });
  });

  it('is deterministic for the same source commit', () => {
    expect(JSON.stringify(pilotVersionManifest(SHA)))
      .toBe(JSON.stringify(pilotVersionManifest(SHA)));
  });

  it('changes the lock when the source commit changes', () => {
    const other = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(pilotVersionManifest(SHA).sourceGitSha).not.toBe(
      pilotVersionManifest(other).sourceGitSha,
    );
  });

  it('requires a full immutable commit SHA rather than a branch or short hash', () => {
    expect(() => pilotVersionManifest('main')).toThrow(/40-character/);
    expect(() => pilotVersionManifest('8c74433')).toThrow(/40-character/);
  });

  it('contains no runtime timestamps, account ids or user data', () => {
    const json = JSON.stringify(pilotVersionManifest(SHA));
    expect(json).not.toMatch(/generatedAt|createdAt|parent|child|email|name":"Stage/i);
  });

  it('round-trips a stored cohort manifest through validation', () => {
    const manifest = pilotVersionManifest(SHA);
    expect(parsePilotVersionManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('keeps historical cohort contract versions readable', () => {
    const manifest = pilotVersionManifest(SHA);
    const historical = {
      ...manifest,
      contracts: {
        ...manifest.contracts,
        consentVersion: 'historical-consent-v1',
        pilotEvidenceVersion: 2,
        pilotAnalyticsVersion: 2,
      },
    };
    expect(parsePilotVersionManifest(JSON.stringify(historical))).toMatchObject({
      contracts: {
        consentVersion: 'historical-consent-v1',
        pilotEvidenceVersion: 2,
        pilotAnalyticsVersion: 2,
      },
    });
  });

  it('rejects malformed contract versions rather than rewriting them', () => {
    const manifest = pilotVersionManifest(SHA);
    const malformed = {
      ...manifest,
      contracts: { ...manifest.contracts, pilotEvidenceVersion: 0 },
    };
    expect(() => parsePilotVersionManifest(JSON.stringify(malformed)))
      .toThrow(/missing or invalid/);
  });

  it('records cohort and analysis commits separately', () => {
    const cohort = pilotVersionManifest(SHA);
    const analysisSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(pilotAnalysisProvenance(cohort, analysisSha)).toEqual({
      version: PILOT_ANALYSIS_PROVENANCE_VERSION,
      cohort: {
        manifestVersion: PILOT_VERSION_MANIFEST_VERSION,
        sourceGitSha: SHA,
        pilotEvidenceVersion: PILOT_EVIDENCE_VERSION,
        learningIntelligenceVersion: LEARNING_INTELLIGENCE_VERSION,
        consentVersion: CONSENT_VERSION,
        curriculumId: AUSTRALIAN_CURRICULUM_V9.id,
        curriculumVersion: AUSTRALIAN_CURRICULUM_V9.version,
      },
      analysis: {
        sourceGitSha: analysisSha,
        pilotAnalyticsVersion: PILOT_ANALYTICS_VERSION,
      },
    });
  });

  it('renders a human-readable manifest without changing the locked values', () => {
    const manifest = pilotVersionManifest(SHA);
    const markdown = pilotVersionManifestMarkdown(manifest);
    expect(markdown).toContain(SHA);
    expect(markdown).toContain('Australian Curriculum');
    expect(markdown).toContain('9.0');
    expect(markdown).toContain(CONSENT_VERSION);
    expect(markdown).toContain('Pilot Evidence schema');
  });
});
