import { CONSENT_VERSION } from './consent-version';
import { LEARNING_INTELLIGENCE_VERSION } from './brain/learning-intelligence';
import { PILOT_EVIDENCE_VERSION } from './pilot-evidence';
import {
  PILOT_ANALYTICS_VERSION,
  PILOT_STAGE0_THRESHOLDS,
} from './pilot-analytics';
import { AUSTRALIAN_CURRICULUM_V9, AUSTRALIA_INITIAL_SCOPE } from './curriculum/australia';
import { BRAIN_LAB_THRESHOLDS } from './brain-lab/benchmark';
import { SUPPORT_LAB_THRESHOLDS } from './brain-lab/support-learning';
import { MISCONCEPTION_LAB_THRESHOLDS } from './brain-lab/misconception-learning';
import { RETENTION_LAB_THRESHOLDS } from './brain-lab/retention';
import { SESSION_REGULATION_THRESHOLDS } from './brain-lab/session-regulation';
import { SCAFFOLD_FADING_THRESHOLDS } from './brain-lab/scaffold-fading';
import { TEACHER_INTENT_LAB_THRESHOLDS } from './brain-lab/teacher-intent';

export const PILOT_VERSION_MANIFEST_VERSION = 1 as const;

type NumericGate<T extends Record<string, number>> = {
  readonly [K in keyof T]: number;
};

export interface PilotVersionManifest {
  manifestVersion: typeof PILOT_VERSION_MANIFEST_VERSION;
  sourceGitSha: string;
  contracts: {
    consentVersion: string;
    learningIntelligenceVersion: number;
    pilotEvidenceVersion: number;
    pilotAnalyticsVersion: number;
  };
  curriculum: {
    id: string;
    name: string;
    jurisdiction: string;
    version: string;
    source: string;
    initialScope: {
      yearLevels: readonly string[];
      subjects: readonly string[];
    };
  };
  protectedGates: {
    academic: NumericGate<typeof BRAIN_LAB_THRESHOLDS>;
    supportLearning: NumericGate<typeof SUPPORT_LAB_THRESHOLDS>;
    misconceptionLearning: NumericGate<typeof MISCONCEPTION_LAB_THRESHOLDS>;
    retention: NumericGate<typeof RETENTION_LAB_THRESHOLDS>;
    sessionRegulation: NumericGate<typeof SESSION_REGULATION_THRESHOLDS>;
    scaffoldFading: NumericGate<typeof SCAFFOLD_FADING_THRESHOLDS>;
    teacherIntent: NumericGate<typeof TEACHER_INTENT_LAB_THRESHOLDS>;
    pilotStage0: NumericGate<typeof PILOT_STAGE0_THRESHOLDS>;
  };
}

const validateGitSha = (sha: string): string => {
  const value = sha.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(value)) {
    throw new Error('Pilot source git SHA must be a full 40-character hexadecimal commit id.');
  }
  return value;
};

/**
 * Immutable cohort/version lock.
 *
 * No timestamps, account details or runtime state are included. The same source
 * commit and code version therefore produce byte-equivalent JSON once pretty
 * printing is fixed by the caller.
 */
export function pilotVersionManifest(sourceGitSha: string): PilotVersionManifest {
  return {
    manifestVersion: PILOT_VERSION_MANIFEST_VERSION,
    sourceGitSha: validateGitSha(sourceGitSha),
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
    protectedGates: {
      academic: { ...BRAIN_LAB_THRESHOLDS },
      supportLearning: { ...SUPPORT_LAB_THRESHOLDS },
      misconceptionLearning: { ...MISCONCEPTION_LAB_THRESHOLDS },
      retention: { ...RETENTION_LAB_THRESHOLDS },
      sessionRegulation: { ...SESSION_REGULATION_THRESHOLDS },
      scaffoldFading: { ...SCAFFOLD_FADING_THRESHOLDS },
      teacherIntent: { ...TEACHER_INTENT_LAB_THRESHOLDS },
      pilotStage0: { ...PILOT_STAGE0_THRESHOLDS },
    },
  };
}

export function pilotVersionManifestMarkdown(manifest: PilotVersionManifest): string {
  return `# SchoolZone Pilot Version Manifest v${manifest.manifestVersion}

This file identifies the exact SchoolZone configuration used for a pilot cohort or analysis run.

## Source

- Git commit: \`${manifest.sourceGitSha}\`
- Consent contract: \`${manifest.contracts.consentVersion}\`
- Learning Intelligence schema: **v${manifest.contracts.learningIntelligenceVersion}**
- Pilot Evidence schema: **v${manifest.contracts.pilotEvidenceVersion}**
- Pilot Analytics schema: **v${manifest.contracts.pilotAnalyticsVersion}**

## Curriculum

- Pack: **${manifest.curriculum.name}**
- ID: \`${manifest.curriculum.id}\`
- Jurisdiction: **${manifest.curriculum.jurisdiction}**
- Version: **${manifest.curriculum.version}**
- Initial years: **${manifest.curriculum.initialScope.yearLevels.join(', ')}**
- Initial subjects: **${manifest.curriculum.initialScope.subjects.join(', ')}**
- Source: ${manifest.curriculum.source}

## Protected evaluation gates

The exact numeric gate values are stored in the JSON manifest alongside this file:

- academic learner-model quality
- support-learning quality
- misconception detection/recovery
- retention/spaced review
- adaptive session regulation
- scaffold fading / independence
- teacher-intent routing
- Stage-0 pilot evidence integrity

## Interpretation

A pilot result is only directly comparable with another run when the relevant
manifest fields are identical, or when differences are explicitly accounted for.

Changing the Brain, curriculum pack, evidence contract, analytics contract or
protected thresholds requires a new manifest tied to the new git commit.
`;
}


export const PILOT_ANALYSIS_PROVENANCE_VERSION = 1 as const;

export interface PilotAnalysisProvenance {
  version: typeof PILOT_ANALYSIS_PROVENANCE_VERSION;
  cohort: {
    manifestVersion: typeof PILOT_VERSION_MANIFEST_VERSION;
    sourceGitSha: string;
    pilotEvidenceVersion: number;
    learningIntelligenceVersion: number;
    consentVersion: string;
    curriculumId: string;
    curriculumVersion: string;
  };
  analysis: {
    sourceGitSha: string;
    pilotAnalyticsVersion: typeof PILOT_ANALYTICS_VERSION;
  };
}

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

/** Validate a stored cohort manifest before it is reused by an analysis run. */
export function parsePilotVersionManifest(json: string): PilotVersionManifest {
  const parsed = object(JSON.parse(json));
  if (!parsed || parsed.manifestVersion !== PILOT_VERSION_MANIFEST_VERSION) {
    throw new Error(`Pilot manifest version must be ${PILOT_VERSION_MANIFEST_VERSION}.`);
  }

  const sourceGitSha = validateGitSha(String(parsed.sourceGitSha ?? ''));
  const contracts = object(parsed.contracts);
  const curriculum = object(parsed.curriculum);
  const initialScope = curriculum ? object(curriculum.initialScope) : null;
  const protectedGates = object(parsed.protectedGates);

  if (
    !contracts
    || typeof contracts.consentVersion !== 'string'
    || contracts.consentVersion.length === 0
    || !Number.isInteger(contracts.learningIntelligenceVersion)
    || Number(contracts.learningIntelligenceVersion) < 1
    || !Number.isInteger(contracts.pilotEvidenceVersion)
    || Number(contracts.pilotEvidenceVersion) < 1
    || !Number.isInteger(contracts.pilotAnalyticsVersion)
    || Number(contracts.pilotAnalyticsVersion) < 1
  ) {
    throw new Error('Pilot manifest contract versions are missing or invalid.');
  }

  if (
    !curriculum
    || typeof curriculum.id !== 'string'
    || typeof curriculum.name !== 'string'
    || typeof curriculum.jurisdiction !== 'string'
    || typeof curriculum.version !== 'string'
    || typeof curriculum.source !== 'string'
    || !initialScope
    || !Array.isArray(initialScope.yearLevels)
    || !Array.isArray(initialScope.subjects)
  ) {
    throw new Error('Pilot manifest curriculum metadata is invalid.');
  }

  if (!protectedGates) {
    throw new Error('Pilot manifest protected evaluation gates are missing.');
  }

  return {
    ...(parsed as unknown as PilotVersionManifest),
    sourceGitSha,
  };
}

export function pilotAnalysisProvenance(
  cohortManifest: PilotVersionManifest,
  analysisSourceGitSha: string,
): PilotAnalysisProvenance {
  return {
    version: PILOT_ANALYSIS_PROVENANCE_VERSION,
    cohort: {
      manifestVersion: cohortManifest.manifestVersion,
      sourceGitSha: cohortManifest.sourceGitSha,
      pilotEvidenceVersion: cohortManifest.contracts.pilotEvidenceVersion,
      learningIntelligenceVersion: cohortManifest.contracts.learningIntelligenceVersion,
      consentVersion: cohortManifest.contracts.consentVersion,
      curriculumId: cohortManifest.curriculum.id,
      curriculumVersion: cohortManifest.curriculum.version,
    },
    analysis: {
      sourceGitSha: validateGitSha(analysisSourceGitSha),
      pilotAnalyticsVersion: PILOT_ANALYTICS_VERSION,
    },
  };
}
