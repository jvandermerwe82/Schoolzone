# SchoolZone Pilot Analytics v1

Pilot Analytics v1 is the deterministic analysis layer for the research-consented exports created by Pilot Evidence v1.

It is intentionally separate from the production database and Brain. It consumes exported CSV files only.

## Inputs

Place these files in one directory:

- `events.csv`
- `checkpoints.csv`
- `support-preferences.csv`
- `support-outcomes.csv`
- `engagement.csv`

They correspond to the admin research exports documented in `pilot-evidence-v1.md`.

## Run

```bash
npm run pilot:analytics -- ./pilot-export ./review/pilot-analytics
```

The second path is optional.

Default output directory:

`review/pilot-analytics`

Outputs:

- `pilot-analytics-v1.json`
- `pilot-analytics-v1.md`

## Metrics

### Data integrity

- research answer rows
- learners represented in answer rows
- Pilot Evidence v1 coverage
- structured mission/session coverage
- data-quality warnings

### Independent academic outcome

Checkpoint gain is calculated only for learner-subject pairs with both:

- order 1 checkpoint
- order 2 checkpoint

For each pair:

`gain percentage points = post correct rate - pre correct rate`

Report includes:

- median
- IQR
- min/max
- proportion improving
- subject breakdown

Checkpoint gain is descriptive unless the study design provides a valid comparison.

### Brain calibration

For every answer with a valid predicted probability and binary outcome:

`Brier = (predicted probability - outcome)^2`

Lower is better.

The report includes:

- overall Brier
- first-10-answer Brier per learner
- later-answer Brier
- early-to-later Brier difference
- aggregate calibration gap
- five probability bands

This evaluates the Brain's confidence calibration, not only raw accuracy.

### Independence

A clean unaided answer is:

- not hinted
- not rapid
- has a valid outcome

The scorecard reports clean unaided correct rate separately from helped practice.

### Support evidence

Observed support outcomes are summarised by strategy using evidence-weighted delta.

The report also checks, where enough data exists, whether an explicit `prefer` strategy matches the learner's highest observed weighted strategy.

That agreement rate is descriptive. It does not imply a fixed learning style.

### Misconceptions

Reports:

- diagnosed misconception answer count
- affected learners
- unique known misconception ids

Pilot Analytics v1 does not infer new diagnoses or free-form misconception labels.

### Retention

Uses only answer rows where:

`due_review = 1`

Reports:

- due review count
- success rate
- lapse rate

This keeps scheduled retention evidence separate from ordinary practice.

### Teacher intent

Using:

- learner pseudonym
- teacher target canonical node
- route reason
- timestamps

the analyzer reconstructs:

`teacher target -> prerequisite work -> later return to target`

Reports:

- routed answer rows
- learners with teacher targets
- learner-target paths that included prerequisite work
- return-to-target rate
- median prerequisite answers before return

It does not currently claim teacher-target canonical mastery from event rows alone.

### Missions

A measurable mission requires at least one answer with:

- session id
- session position
- planned mission length

A mission is considered completed when the maximum recorded position reaches the planned length.

Important limitation:

> zero-answer exits are not represented in Pilot Evidence v1, so mission completion applies only to missions with at least one recorded answer.

### Engagement

Counts structured observable signals such as:

- stopped session
- continued voluntarily
- rapid guess
- requested help
- persisted after error

The analyzer does not translate them into medical, diagnostic or mental-state labels.

## Interpretation rules

The generated Markdown begins with:

> **Descriptive evidence report.**

That wording is deliberate.

The analytics engine may report:

- observed gain
- association
- calibration
- completion
- retention
- support evidence
- route transitions

It must not automatically conclude:

- SchoolZone caused an observed gain
- a child has a diagnosis
- a support works for all children in a diagnostic group
- a teacher is effective or ineffective

## Determinism

Pilot Analytics has no AI summarisation step.

Given the same five CSV exports and the same code version, it produces the same JSON metrics.

This is important for:

- reproducible pilot review
- version-to-version comparison
- external research review
- auditability

## Versioning

The output includes:

`"version": 1`

When the metric contract changes materially, create a new analytics version rather than silently changing the meaning of existing pilot results.
