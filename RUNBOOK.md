# SchoolZone — Operating Runbook

## Safe continuation

1. Read `HANDOFF.md`.
2. Verify the live default branch and Render deployment commit.
3. Verify CI on any candidate.
4. If persistence is touched, verify disk/server paths and backup behavior before code changes.
5. Never infer production from older Brain Lab or feature PRs.

## Dependency authority

- `package.json`
- `package-lock.json`
- install with `npm ci` for deterministic CI/builds.

Current package metadata declares ISC at the package root. Third-party package licences remain subject to their own terms; a final buyer handover should include a generated SBOM/licence report.

## Build / test

Primary commands:
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run brain:lab` when validating Brain Lab contracts
- pilot manifest/analytics scripts when preparing a cohort candidate.

## Production

Render service:
- source repository: SchoolZone
- production branch: `claude/adaptive-school-app-skills-i93pd7`
- build: `npm ci --include=dev && npm run build`
- start: production server command from Render configuration
- persistent disk mounted for server data.

## Persistence safety

Server/cloud state is authoritative when cloud mode is active. Local/browser storage is resilience support, not the canonical longitudinal record.

A release must not wipe:
- login/session continuity where expected;
- learner profile;
- score/progress;
- learning history.

## Recovery

A buyer/operator should verify:
- backup command;
- backup destination/retention;
- fresh restore into a separate environment;
- restart after restore;
- learner-profile/progress parity.

Current release diligence treats restore/redeploy survival as an open proof item rather than assuming it.

## Pilot

Before a two-child pilot:
- freeze exact candidate SHA;
- freeze consent/evidence boundary;
- define whether AI tutor is enabled;
- verify persistence survives redeploy;
- verify hints/animations/reporting;
- run CI + relevant Brain Lab/pilot gates.
