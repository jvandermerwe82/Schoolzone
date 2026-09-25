# SchoolZone Pilot Version Lock v1

A SchoolZone pilot result must answer:

> **Exactly which SchoolZone did this cohort use, and exactly which analytics code produced this report?**

Pilot Version Lock v1 makes that answer explicit and reproducible.

## Two different versions matter

A real pilot has two source versions that must not be conflated.

### 1. Cohort source

The exact application/Brain/curriculum/evidence configuration used by participants.

This is frozen **before the first participant starts**.

### 2. Analysis source

The exact analytics code used when the exported pilot data is analysed.

This may be the same commit as the cohort source, or a later commit if old pilot data is re-analysed.

Pilot Analytics records both.

## Cohort manifest

Generate the cohort lock from the exact commit that will be deployed to the pilot:

```bash
npm run pilot:manifest -- ./pilot-export
```

This writes:

- `pilot-version-manifest-v1.json`
- `pilot-version-manifest-v1.md`

Do not regenerate or overwrite the cohort manifest after participants begin.

The JSON manifest records:

- full 40-character git commit SHA;
- consent contract version;
- Learning Intelligence schema version;
- Pilot Evidence schema version;
- Pilot Analytics schema version at cohort freeze;
- Australian Curriculum pack id, jurisdiction and version;
- initial curriculum scope;
- exact Brain Lab protected thresholds:
  - academic learner-model gate;
  - support-learning gate;
  - misconception gate;
  - retention gate;
  - teacher-intent gate;
- exact Stage-0 evidence-integrity thresholds.

No names, account ids, timestamps or participant data are included.

## Analysing a locked cohort

The analysis input directory must contain:

- `pilot-version-manifest-v1.json`
- `events.csv`
- `checkpoints.csv`
- `support-preferences.csv`
- `support-outcomes.csv`
- `engagement.csv`

Run:

```bash
npm run pilot:analytics -- ./pilot-export ./review/pilot-analytics
```

The report package contains:

- `pilot-analytics-v1.json`
- `pilot-analytics-v1.md`
- `cohort-pilot-version-manifest-v1.json`
- `pilot-analysis-provenance-v1.json`

The provenance file records separately:

- cohort git SHA;
- cohort evidence/intelligence/consent/curriculum versions;
- analysis git SHA;
- analytics version used for the analysis.

## Why the manifest is deterministic

The cohort manifest deliberately has no generated timestamp.

Given:

- the same source git SHA;
- the same SchoolZone source code;

the manifest serialises to the same values.

Operational dates belong in study administration records, not in the software-version identity.

## Historical cohorts

An old cohort manifest remains readable after SchoolZone versions change.

The parser validates the manifest's structure; it does not silently replace old contract versions with current versions.

If a newer analytics version cannot understand an older export schema, that incompatibility must be reported explicitly rather than rewriting the cohort record.

## Comparability rule

Two results are directly software-comparable only when the relevant manifest fields match, or the difference is explicitly analysed.

Examples:

- Same cohort source + same analytics source: direct re-run.
- Same cohort source + newer analytics source: re-analysis; retain both SHAs.
- Different Brain/curriculum source: different treatment configuration.
- Different evidence schema: confirm measurement compatibility before comparing.
- Different protected thresholds: record the change and reason.

## Pilot freeze checklist

Before first participant:

1. Choose the exact candidate commit.
2. Confirm CI is green on that exact commit.
3. Confirm all Brain Lab gates are green.
4. Confirm Stage-0 readiness harness is green.
5. Generate `pilot-version-manifest-v1.json`.
6. Archive that file with pilot governance records.
7. Deploy that exact SHA.
8. Do not change the cohort's Brain/curriculum/evidence contract mid-study without treating it as a new cohort/version.

## What this does not do

The manifest does not:

- prove the Brain is effective;
- establish causal impact;
- identify a participant;
- contain research results;
- replace ethics/privacy/governance review;
- permit silent mid-pilot updates.

It is a software provenance contract so pilot evidence can later be interpreted against the system that actually produced it.
