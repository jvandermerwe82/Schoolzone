import type { PilotVersionManifest } from './pilot-version-manifest';

export const PILOT_RELEASE_READINESS_VERSION = 1 as const;

export interface PilotReleaseAttestations {
  version: typeof PILOT_RELEASE_READINESS_VERSION;
  stage0ReadinessPassed: boolean;
  manifestArchived: boolean;
  emailSmokePassed: boolean;
  tutorSmokePassed: boolean | null;
  offsiteEncryptedBackupConfigured: boolean;
  restoreTestPassed: boolean;
  privacyNoticeReviewed: boolean;
  dpiaSignedOff: boolean;
  safeguardingLeadAndDeputyConfirmed: boolean;
  curriculumReviewCompleted: boolean;
}

export interface ReadinessCheck {
  id: string;
  status: 'pass' | 'fail' | 'warning' | 'not-applicable';
  detail: string;
}

export interface PilotReleaseReadiness {
  version: typeof PILOT_RELEASE_READINESS_VERSION;
  candidateGitSha: string;
  manifestGitSha: string;
  tutorEnabled: boolean;
  pass: boolean;
  failures: string[];
  warnings: string[];
  checks: ReadinessCheck[];
}

const fullSha = (value: string): string => {
  const sha = value.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Pilot candidate git SHA must be a full 40-character hexadecimal commit id.');
  }
  return sha;
};

const yes = (value: string | undefined): boolean => value?.trim().toLowerCase() === 'true';
const int = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const secretOk = (value: string | undefined): boolean => !!value && value.trim().length >= 32;
const emailLike = (value: string | undefined): boolean =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const httpsUrl = (value: string | undefined): URL | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const add = (
  checks: ReadinessCheck[],
  id: string,
  ok: boolean,
  passDetail: string,
  failDetail: string,
): void => {
  checks.push({
    id,
    status: ok ? 'pass' : 'fail',
    detail: ok ? passDetail : failDetail,
  });
};

const attestation = (
  checks: ReadinessCheck[],
  id: string,
  value: boolean,
  label: string,
): void => add(
  checks,
  id,
  value,
  `${label}: confirmed.`,
  `${label}: not confirmed.`,
);

export function evaluatePilotReleaseReadiness(input: {
  candidateGitSha: string;
  manifest: PilotVersionManifest;
  env: Record<string, string | undefined>;
  attestations: PilotReleaseAttestations;
}): PilotReleaseReadiness {
  const candidateGitSha = fullSha(input.candidateGitSha);
  const manifestGitSha = fullSha(input.manifest.sourceGitSha);
  const env = input.env;
  const checks: ReadinessCheck[] = [];

  add(
    checks,
    'source-sha',
    candidateGitSha === manifestGitSha,
    `Candidate SHA matches cohort manifest: ${candidateGitSha}.`,
    `Candidate SHA ${candidateGitSha} does not match cohort manifest ${manifestGitSha}.`,
  );

  add(
    checks,
    'node-env',
    env.NODE_ENV === 'production',
    'NODE_ENV is production.',
    'NODE_ENV must be production.',
  );

  const publicUrl = httpsUrl(env.APP_URL);
  add(
    checks,
    'https',
    !!publicUrl && !['localhost', '127.0.0.1', '::1'].includes(publicUrl.hostname),
    `APP_URL is public HTTPS: ${publicUrl?.origin ?? ''}.`,
    'APP_URL must be a non-localhost HTTPS URL.',
  );

  add(
    checks,
    'database',
    !!env.DATABASE_PATH
      && env.DATABASE_PATH.trim() !== ':memory:'
      && !env.DATABASE_PATH.trim().startsWith('file::memory:'),
    'DATABASE_PATH is configured for persistent storage.',
    'DATABASE_PATH must point to persistent storage and must not be in-memory.',
  );

  add(
    checks,
    'smtp-url',
    !!env.SMTP_URL?.trim(),
    'SMTP_URL is configured.',
    'SMTP_URL is required so verification, reset and safety mail is not log-only.',
  );
  add(
    checks,
    'mail-from',
    emailLike(env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? env.MAIL_FROM),
    'MAIL_FROM contains a usable email address.',
    'MAIL_FROM must contain a valid sender email address.',
  );
  add(
    checks,
    'admin-email',
    emailLike(env.ADMIN_EMAIL),
    'ADMIN_EMAIL is configured.',
    'ADMIN_EMAIL must be configured for school-approval notifications.',
  );

  add(
    checks,
    'admin-token',
    secretOk(env.ADMIN_TOKEN),
    'ADMIN_TOKEN is at least 32 characters.',
    'ADMIN_TOKEN must be a long random secret of at least 32 characters.',
  );
  add(
    checks,
    'export-salt',
    secretOk(env.EXPORT_SALT),
    'EXPORT_SALT is at least 32 characters.',
    'EXPORT_SALT must be a stable random secret of at least 32 characters.',
  );
  add(
    checks,
    'separate-research-secrets',
    !!env.ADMIN_TOKEN
      && !!env.EXPORT_SALT
      && env.ADMIN_TOKEN.trim() !== env.EXPORT_SALT.trim(),
    'ADMIN_TOKEN and EXPORT_SALT are separate secrets.',
    'ADMIN_TOKEN and EXPORT_SALT must not be the same secret.',
  );

  add(
    checks,
    'backup-dir',
    !!env.BACKUP_DIR?.trim(),
    'BACKUP_DIR is configured.',
    'BACKUP_DIR must be configured on persistent storage.',
  );
  const backupKeep = int(env.BACKUP_KEEP);
  add(
    checks,
    'backup-retention',
    backupKeep !== null && backupKeep >= 7,
    `BACKUP_KEEP is ${backupKeep} days.`,
    'BACKUP_KEEP must be an explicit integer of at least 7 days.',
  );
  const retentionDays = int(env.RETENTION_DAYS);
  add(
    checks,
    'data-retention',
    retentionDays !== null && retentionDays >= 1 && retentionDays <= 365,
    `RETENTION_DAYS is ${retentionDays}.`,
    'RETENTION_DAYS must be an explicit integer between 1 and 365 for this pilot gate.',
  );

  const port = int(env.PORT);
  add(
    checks,
    'port',
    port !== null && port >= 1 && port <= 65535,
    `PORT is ${port}.`,
    'PORT must be an explicit integer between 1 and 65535.',
  );

  const tutorEnabled = env.TUTOR_ENABLED !== 'false';
  if (tutorEnabled) {
    add(
      checks,
      'tutor-credentials',
      !!env.ANTHROPIC_API_KEY?.trim() || !!env.ANTHROPIC_AUTH_TOKEN?.trim(),
      'Tutor is enabled and Anthropic credentials are configured.',
      'Tutor is enabled but no Anthropic API/auth credential is configured.',
    );
  } else {
    checks.push({
      id: 'tutor-credentials',
      status: 'not-applicable',
      detail: 'Tutor is explicitly disabled for this pilot candidate.',
    });
  }

  if (!env.TRUST_PROXY?.trim()) {
    checks.push({
      id: 'trust-proxy',
      status: 'warning',
      detail: 'TRUST_PROXY is unset. Confirm this is intentional for the selected hosting topology.',
    });
  } else {
    checks.push({
      id: 'trust-proxy',
      status: 'pass',
      detail: `TRUST_PROXY is explicitly configured as ${env.TRUST_PROXY}.`,
    });
  }

  attestation(checks, 'stage0-readiness', input.attestations.stage0ReadinessPassed, 'Stage-0 end-to-end readiness');
  attestation(checks, 'manifest-archived', input.attestations.manifestArchived, 'Cohort manifest archived');
  attestation(checks, 'email-smoke', input.attestations.emailSmokePassed, 'Email smoke check');
  if (tutorEnabled) {
    attestation(checks, 'tutor-smoke', input.attestations.tutorSmokePassed === true, 'Tutor smoke check');
  } else {
    checks.push({
      id: 'tutor-smoke',
      status: 'not-applicable',
      detail: 'Tutor smoke check not required because tutor is disabled.',
    });
  }
  attestation(
    checks,
    'offsite-backup',
    input.attestations.offsiteEncryptedBackupConfigured,
    'Encrypted off-site backup',
  );
  attestation(checks, 'restore-test', input.attestations.restoreTestPassed, 'Backup restore test');
  attestation(checks, 'privacy-review', input.attestations.privacyNoticeReviewed, 'Privacy notice review');
  attestation(checks, 'dpia', input.attestations.dpiaSignedOff, 'DPIA sign-off');
  attestation(
    checks,
    'safeguarding',
    input.attestations.safeguardingLeadAndDeputyConfirmed,
    'Safeguarding lead and deputy',
  );
  attestation(
    checks,
    'curriculum-review',
    input.attestations.curriculumReviewCompleted,
    'Pilot curriculum/content review',
  );

  const failures = checks.filter((check) => check.status === 'fail').map((check) => check.detail);
  const warnings = checks.filter((check) => check.status === 'warning').map((check) => check.detail);

  return {
    version: PILOT_RELEASE_READINESS_VERSION,
    candidateGitSha,
    manifestGitSha,
    tutorEnabled,
    pass: failures.length === 0,
    failures,
    warnings,
    checks,
  };
}

export function pilotReleaseReadinessMarkdown(report: PilotReleaseReadiness): string {
  const icon = (status: ReadinessCheck['status']) =>
    status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : status === 'warning' ? 'WARN' : 'N/A';

  return `# SchoolZone Pilot Release Readiness v${report.version}

**Overall: ${report.pass ? 'PASS' : 'FAIL'}**

- Candidate git SHA: \`${report.candidateGitSha}\`
- Cohort manifest SHA: \`${report.manifestGitSha}\`
- Tutor enabled: **${report.tutorEnabled ? 'yes' : 'no'}**

## Checks

| Check | Status | Detail |
| --- | --- | --- |
${report.checks.map((check) => `| ${check.id} | ${icon(check.status)} | ${check.detail.replace(/\|/g, '\\|')} |`).join('\n')}

## Rule

A PASS means the software/configuration and declared manual preflight items satisfy
Pilot Release Readiness v1. It is **not** evidence that SchoolZone improves learning
and it does not replace privacy, safeguarding, curriculum or research governance review.
`;
}
