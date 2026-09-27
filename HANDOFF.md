# SchoolZone — Engineering Handoff

**Last verified:** 27 September 2026  
**Canonical repository:** `jvandermerwe82/Schoolzone`

## Source-of-truth state

- Default / current production code branch: `claude/adaptive-school-app-skills-i93pd7`
- Current default repository SHA: `c94ab6844f4c581f008c8b52d67456fb48b02e4f` (handoff documentation merge only)
- Last runtime/product-code baseline before the handoff merge: `accf5b23d3146befa3bb2f4a4e2baf310ba9e9ea`
- Production runtime behavior was not changed by the handoff merge.
- Current audit cleanup: PR #30 — `audit/schoolzone-clean-code-safety-20260927` (exact-head CI green, but it predates the handoff merge and must be refreshed against the current default before merge consideration)
- PR #30 verified head: `1819524574c2215da2a2ef1da00fc5ea21c51a1f`
- PR #30 changes are documentation/comment authority cleanup only; no learner/runtime logic is changed.
- Older open Brain Lab / feature-stack PRs must not be assumed to represent production. Their open status is historical/experimental until explicitly reconciled.

## Verified gates

PR #30 exact head:
- SchoolZone CI: PASS
- Netlify deploy preview: PASS

The current source audit covered 103 non-test runtime/source files and found no unsafe TypeScript `any`, no TypeScript suppression directives, no TODO/FIXME/HACK debt and no empty catch blocks in that runtime scan.

## Product authority

- Launch direction: Australia first.
- Active curriculum registry: Australian Curriculum v9.
- Initial mapped scope: Years 4–6, Mathematics / English / Science.
- Original England Year 6 / SATs content remains in the repository as legacy/reuse content and must not automatically be treated as Australian curriculum evidence.
- Deterministic learner intelligence owns learner state, mastery, misconceptions, support evidence and routing.
- Generative tutoring is not the learner-model authority.

## Persistence / deployment rule

- Server/cloud state is authoritative when cloud mode is active.
- Browser storage is an offline/resilience mirror.
- Do not accept a deployment that wipes login, learner profile, score or learning history.
- Persistent server storage and restore behavior must remain part of pilot validation.

## Do not

- Do not treat an older open feature/Lab PR as production.
- Do not mix England content labels into Australian mastery claims without verified curriculum mapping.
- Do not change learner-state persistence or database storage without migration/restore proof.
- Do not merge, publish or alter production without explicit approval.

## Exact next action

Use the verified default branch as the production baseline. Close the documentation authority cleanup, then continue pilot-readiness validation: persistent learner state across deploys, animations/hints as intended, and two-child live pilot testing on the exact candidate.

## New-chat verification protocol

Before changing anything:
1. Read this file.
2. Verify the default branch SHA and current candidate PR head.
3. Verify CI and deployment-preview status on the exact candidate.
4. If the task touches persistence, verify the live server/storage configuration before changing code.
5. If live GitHub/deployment state differs from this file, live state wins and this handoff must be updated first.
6. Never infer production from branch age, PR number or apparent feature completeness.
