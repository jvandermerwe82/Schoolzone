import { describe, expect, it } from 'vitest';
import { pilotVersionManifest } from './pilot-version-manifest';
import {
  evaluatePilotReleaseReadiness,
  pilotReleaseReadinessMarkdown,
  type PilotReleaseAttestations,
} from './pilot-release-readiness';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const readyEnv = (): Record<string, string> => ({
  NODE_ENV: 'production',
  APP_URL: 'https://schoolzone.example.org',
  DATABASE_PATH: '/data/schoolzone.db',
  SMTP_URL: 'smtps://user:password@smtp.example.org:465',
  MAIL_FROM: 'SchoolZone <no-reply@example.org>',
  ADMIN_EMAIL: 'admin@example.org',
  ADMIN_TOKEN: 'a'.repeat(64),
  EXPORT_SALT: 'b'.repeat(64),
  BACKUP_DIR: '/data/backups',
  BACKUP_KEEP: '14',
  RETENTION_DAYS: '365',
  PORT: '8787',
  TUTOR_ENABLED: 'true',
  ANTHROPIC_API_KEY: 'sk-ant-test-secret',
  TRUST_PROXY: 'true',
});

const attestations = (): PilotReleaseAttestations => ({
  version: 1,
  stage0ReadinessPassed: true,
  manifestArchived: true,
  emailSmokePassed: true,
  tutorSmokePassed: true,
  offsiteEncryptedBackupConfigured: true,
  restoreTestPassed: true,
  privacyNoticeReviewed: true,
  dpiaSignedOff: true,
  safeguardingLeadAndDeputyConfirmed: true,
  curriculumReviewCompleted: true,
});

describe('Pilot Release Readiness v1', () => {
  it('passes a fully configured exact-SHA candidate', () => {
    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env: readyEnv(),
      attestations: attestations(),
    });

    expect(report.pass).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.tutorEnabled).toBe(true);
    expect(report.checks.every((check) => check.status !== 'fail')).toBe(true);
  });

  it('fails when the deployed candidate does not match the cohort manifest', () => {
    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: 'b'.repeat(40),
      manifest: pilotVersionManifest(SHA),
      env: readyEnv(),
      attestations: attestations(),
    });

    expect(report.pass).toBe(false);
    expect(report.failures.join(' ')).toContain('does not match cohort manifest');
  });

  it('fails closed on weak research secrets and missing production infrastructure', () => {
    const env = readyEnv();
    env.NODE_ENV = 'development';
    env.APP_URL = 'http://localhost:5173';
    env.DATABASE_PATH = ':memory:';
    env.SMTP_URL = '';
    env.ADMIN_TOKEN = 'short';
    env.EXPORT_SALT = 'short';

    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env,
      attestations: attestations(),
    });

    expect(report.pass).toBe(false);
    const failures = report.failures.join('\n');
    expect(failures).toContain('NODE_ENV must be production');
    expect(failures).toContain('non-localhost HTTPS');
    expect(failures).toContain('persistent storage');
    expect(failures).toContain('SMTP_URL is required');
    expect(failures).toContain('ADMIN_TOKEN must be');
    expect(failures).toContain('EXPORT_SALT must be');
  });

  it('requires independent export salt rather than reusing the admin token', () => {
    const env = readyEnv();
    env.EXPORT_SALT = env.ADMIN_TOKEN;

    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env,
      attestations: attestations(),
    });

    expect(report.pass).toBe(false);
    expect(report.failures.join(' ')).toContain('must not be the same secret');
  });

  it('makes tutor credentials and tutor smoke not applicable when tutor is disabled', () => {
    const env = readyEnv();
    env.TUTOR_ENABLED = 'false';
    delete env.ANTHROPIC_API_KEY;
    const manual = attestations();
    manual.tutorSmokePassed = null;

    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env,
      attestations: manual,
    });

    expect(report.pass).toBe(true);
    expect(report.tutorEnabled).toBe(false);
    expect(report.checks.find((check) => check.id === 'tutor-credentials')?.status)
      .toBe('not-applicable');
    expect(report.checks.find((check) => check.id === 'tutor-smoke')?.status)
      .toBe('not-applicable');
  });

  it('treats missing TRUST_PROXY as an explicit warning rather than a universal failure', () => {
    const env = readyEnv();
    delete env.TRUST_PROXY;

    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env,
      attestations: attestations(),
    });

    expect(report.pass).toBe(true);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain('TRUST_PROXY');
  });

  it('fails when any required manual pilot attestation is not confirmed', () => {
    const manual = attestations();
    manual.restoreTestPassed = false;
    manual.curriculumReviewCompleted = false;

    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env: readyEnv(),
      attestations: manual,
    });

    expect(report.pass).toBe(false);
    expect(report.failures.join(' ')).toContain('Backup restore test');
    expect(report.failures.join(' ')).toContain('Pilot curriculum/content review');
  });

  it('never includes secret values in JSON or Markdown output', () => {
    const env = readyEnv();
    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env,
      attestations: attestations(),
    });
    const output = JSON.stringify(report) + pilotReleaseReadinessMarkdown(report);

    expect(output).not.toContain(env.ADMIN_TOKEN);
    expect(output).not.toContain(env.EXPORT_SALT);
    expect(output).not.toContain(env.ANTHROPIC_API_KEY);
    expect(output).not.toContain(env.SMTP_URL);
  });

  it('renders the exact candidate/manifest identity and overall result', () => {
    const report = evaluatePilotReleaseReadiness({
      candidateGitSha: SHA,
      manifest: pilotVersionManifest(SHA),
      env: readyEnv(),
      attestations: attestations(),
    });
    const markdown = pilotReleaseReadinessMarkdown(report);

    expect(markdown).toContain('Overall: PASS');
    expect(markdown).toContain(SHA);
    expect(markdown).toContain('source-sha');
    expect(markdown).toContain('Stage-0');
    expect(markdown).toContain('not');
  });
});
