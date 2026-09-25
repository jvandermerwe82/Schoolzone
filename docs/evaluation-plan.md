# SchoolZone Australia pilot evaluation plan

The pilot must answer a narrower and more defensible question than "does the app work?":

> **Do learners using SchoolZone show measurable improvement, and do SchoolZone's adaptive decisions become more accurate and useful as evidence accumulates?**

The full instrumentation contract is documented in [Pilot Evidence v1](./pilot-evidence-v1.md).

## Launch scope

Initial evaluation scope:

- Australia
- Years 4–6
- Year 5 anchor cohort
- Mathematics, English and Science where the Australian Curriculum mapping/content route is verified
- learners with and without additional support needs

The pilot should not be restricted to neurodivergent learners. Support needs are evaluated at the level of what helps the learner, not from inferred diagnoses.

## Primary academic outcome

Choose and freeze one primary academic outcome before recruitment.

The current built-in independent outcome is the fixed SchoolZone checkpoint system:

- no hints;
- no marking until the end;
- alternate A/B forms;
- counterbalanced form order;
- checkpoints do not update the adaptive Brain.

Before a formal outcome study, Australian checkpoint content must be curriculum-reviewed for the target year levels.

## Secondary outcomes

Pilot Evidence v1 supports the following secondary outcomes.

### Brain calibration

- Brier prediction error
- probability calibration
- calibration change from early to later use
- pKnown/ability estimates against later independent outcomes

### Independence

- unaided clean success
- helped success followed by later independent success
- time/questions from help to resolution

### Support effectiveness

- support strategy tried
- helped / switched / resolved
- learner/parent stated support preference
- observed support outcome
- whether SchoolZone corrects an inaccurate starting prior

### Misconceptions

- recurring known mistake pattern
- time to intervention
- time to clean contradictory evidence
- recurrence after apparent resolution

### Retention

- due-review success
- lapse rate
- recovery cost after lapse
- later independent success
- review burden

### Teacher intent

- teacher target
- prerequisite route
- return to target
- wrong-answer exposure
- questions to strong target evidence
- target completion by due date where available

### Engagement

Use observable metrics only:

- mission completion
- early exit
- continued voluntarily
- help requested
- rapid responses
- persistence after error

Do not translate these signals into diagnostic or mental-state labels.

## Research exports

All administrative research exports require the admin token and use salted pseudonymous learner identifiers.

Current exports:

- `GET /api/admin/checkpoints.csv`
- `GET /api/admin/events.csv`
- `GET /api/admin/support-preferences.csv`
- `GET /api/admin/support-outcomes.csv`
- `GET /api/admin/engagement.csv`

Answer-event research rows are stored only when the parent has opted into research.

Withdrawing research consent deletes stored answer-event research rows.

Structured profile exports exclude names and free-text preference notes.

## Recommended study sequence

### Stage 0 — evidence plumbing

A small technical cohort verifies:

- consent behavior
- event completeness
- offline event delivery
- export correctness
- pseudonym stability
- checkpoint scheduling
- research withdrawal/deletion
- absence of raw text leakage

This stage is not an effectiveness study.

### Stage 1 — feasibility

Assess:

- learner usability
- parent acceptability
- teacher workflow
- data completeness
- mission completion
- accessibility/support usability
- checkpoint completion

### Stage 2 — outcome study

Before starting:

1. define the primary endpoint;
2. choose a comparison design;
3. calculate the sample size needed for that endpoint;
4. freeze the exact cohort git SHA and generate `pilot-version-manifest-v1.json`;
5. pre-specify missing-data handling;
6. pre-specify exclusions;
7. pre-specify subgroup analyses;
8. archive the curriculum/content and software version lock with the study record.

A waitlist, stepped-wedge or other suitable comparison design is stronger than a simple pre/post study.

## Analysis principles

Report distributions, not only averages.

For checkpoint outcomes include:

- median change
- interquartile range
- full range
- proportion improving
- form A/B baseline comparison
- confidence intervals when appropriate

For adaptive metrics compare early and later periods per learner where possible.

Do not select only learners who completed the most practice when making overall effectiveness claims.

## Important limitations

A simple before/after gain does not establish causation.

Potential confounding includes:

- normal school instruction
- maturation
- family engagement
- teacher effects
- self-selection
- differing exposure time

Checkpoint forms are not yet psychometrically equated.

Small subgroup results must not be presented as generalisable findings.

## Decision rule

Pilot results should be used to decide one of three things for each Brain subsystem:

- **retain** — real evidence is consistent with the intended behavior;
- **challenge** — evidence identifies a measurable weakness worth a controlled challenger;
- **do not tune yet** — evidence is insufficient or too confounded.

The same rule used in Brain Lab applies to real-world tuning:

> Do not promote a Brain change because it sounds smarter. Promote it only when the evidence shows a better trade-off without damaging protected outcomes.
