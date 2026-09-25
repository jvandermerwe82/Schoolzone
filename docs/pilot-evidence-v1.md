# SchoolZone Pilot Evidence v1

Pilot Evidence v1 is the real-world measurement layer for SchoolZone's Australia-first pilot.

Its purpose is not to collect more child data. Its purpose is to make the minimum research-consented learning data already produced by SchoolZone sufficient to answer whether the system is learning the learner and helping them improve.

## Principles

1. **Separate service data from research data.**
   - Operational profiles continue to support the product.
   - Structured answer research rows are stored only when the parent has separately opted in to research.
   - Withdrawing research consent deletes stored answer-event research rows.

2. **No raw child text in Pilot Evidence.**
   Research events do not contain:
   - child or parent names;
   - email addresses;
   - raw answers;
   - question text;
   - AI tutor chat;
   - teacher notes;
   - parent notes;
   - support-preference notes;
   - diagnosis fields.

3. **Pseudonymous export.**
   Administrative research exports use a salted HMAC pseudonym rather than the real child id.

4. **Observed behaviour is not diagnosis.**
   Rapid guesses, session stopping, requested help and other engagement signals describe observed app behaviour only.

5. **Model estimates are not ground truth.**
   pKnown, ability, predicted correctness and canonical progress are model outputs. Pilot analysis must compare them with independent outcomes such as checkpoints and later review performance.

## Answer-event schema

`GET /api/admin/events.csv` exports research-consented practice answers.

Pilot Evidence v1 adds:

- `event_version`
- `session_id`
- `session_position`
- `mission_length`
- `plan_reason`: new / continue / review / help / climb
- `help_event`: stuck / helped / switched / resolved
- `diagnostic`
- `due_review`
- `curriculum_id`
- `canonical_node_id`
- `evidence_strength`
- `teacher_target_node_id`
- `teacher_route_reason`: target / prerequisite
- `p_known_before`
- `p_known_after`
- `ability_before`
- `ability_after`
- `mastered_after`

Existing event fields remain:

- skill / level / item
- correct
- hinted
- rapid
- response time
- predicted probability
- diagnosed misconception id
- active deterministic help strategy

Older clients remain valid because Pilot Evidence fields are optional on the wire.

## Structured profile exports

All require the admin token and include only children whose latest consent has research enabled.

### `GET /api/admin/checkpoints.csv`

Independent fixed-form checkpoint answers for pre/post learning evaluation.

### `GET /api/admin/support-preferences.csv`

Exports only:

- pseudonymous learner
- timestamp
- source: learner / parent / teacher
- support strategy
- preference value

Optional preference notes are explicitly excluded.

### `GET /api/admin/support-outcomes.csv`

Exports measured support evidence:

- strategy
- delta
- evidence weight
- evidence source
- subject
- skill

### `GET /api/admin/engagement.csv`

Exports observable signals such as:

- rapid guess
- requested help
- persisted after error
- stopped session
- continued voluntarily
- resumed after break

No diagnostic interpretation is exported.

## Pilot outcome framework

### 1. Learning gain — primary

Source: checkpoint export.

Pre-specify the primary academic outcome before analysis. Recommended reporting:

- pre/post change by subject;
- median, interquartile range and full range;
- proportion improving;
- form A/B baseline comparison;
- confidence intervals where sample size supports them.

Do not treat raw gain as causal evidence without a comparison design.

### 2. Brain calibration

Source: answer events.

Measure:

- Brier score: `(predicted - outcome)^2`;
- calibration by probability band;
- calibration early vs later in the learner history;
- pKnown / ability movement against later independent outcomes.

Question:

> Does SchoolZone become better calibrated as evidence accumulates?

### 3. Independent learning

Source: answer events.

Define an unaided clean answer as:

- correct;
- not hinted;
- not rapid.

Track:

- unaided success rate;
- transition from helped success to later independent success;
- time/questions from help episode to resolved;
- pKnown/ability movement before and after intervention.

### 4. Support effectiveness

Sources:

- answer events;
- support preferences;
- support outcomes.

Measure:

- which support was tried;
- helped / switched / resolved outcomes;
- repeated effectiveness by learner and context;
- whether learner/parent starting preferences predict later observed effectiveness;
- whether SchoolZone corrects an inaccurate starting preference.

Do not infer ADHD, autism, dyslexia or another diagnosis from support effectiveness.

### 5. Misconception resolution

Source: answer events plus profile state where needed.

Measure:

- repeated misconception occurrence;
- intervention following misconception;
- questions until clean contradictory evidence / resolution;
- recurrence after apparent resolution.

### 6. Retention

Source: answer events.

`due_review = 1` distinguishes genuine scheduled review from ordinary practice.

Measure:

- due-review success rate;
- lapse rate;
- recovery questions after a lapse;
- later independent success;
- review burden per learner;
- retention by prior mastery confidence.

### 7. Teacher-intent efficiency

Source: answer events.

The combination of:

- `teacher_target_node_id`;
- `canonical_node_id`;
- `teacher_route_reason`

allows reconstruction of:

teacher target -> prerequisite repair -> return to target.

Measure:

- prerequisite questions before return;
- wrong-answer exposure;
- proportion returning to target;
- questions to strong target evidence;
- target completion by due date when applicable;
- teacher-assigned objective outcomes vs comparable non-teacher practice.

### 8. Mission engagement

Sources:

- answer events;
- engagement export.

Within each `session_id`:

- maximum session position;
- planned mission length;
- mission completion;
- early exit;
- help use;
- rapid-guess concentration by position.

Use observable wording such as "session completion" or "rapid-response frequency", not inferred mental-state labels.

## Recommended pilot design

### Stage 0 — technical evidence pilot

Use a small internal/friendly cohort only to verify:

- consent;
- event completeness;
- exports;
- pseudonym stability;
- checkpoint scheduling;
- no sensitive-text leakage;
- offline outbox delivery;
- deletion/withdrawal behavior.

Do not use Stage 0 to claim effectiveness.

### Stage 1 — feasibility pilot

Australia, Years 4–6 with Year 5 as the anchor cohort.

Evaluate:

- usability;
- completion;
- data quality;
- teacher workflow;
- parent/learner acceptability;
- support accessibility;
- preliminary learning signals.

### Stage 2 — outcome evaluation

Before recruitment:

- choose one primary academic outcome;
- choose the comparison design;
- power the required sample size from the intended analysis rather than choosing a convenient number;
- pre-specify exclusions and missing-data handling;
- pre-specify subgroup analyses;
- freeze Brain/model versions used by the cohort.

A waitlist, stepped-wedge or other suitable comparison design is materially stronger than a simple before/after pilot.

## Interpretation safeguards

SchoolZone pilot data may support statements such as:

- "learners using SchoolZone improved by X on this measure";
- "this support strategy was associated with better subsequent independent performance in this cohort";
- "the Brain's probability estimates became better calibrated over time."

It must not automatically support statements such as:

- "SchoolZone caused the gain" without an appropriate design;
- "this child has ADHD/autism/dyslexia";
- "strategy X works for all learners with diagnosis Y";
- "teacher X is more effective than teacher Y."

## Current research boundary

Pilot Evidence v1 is an instrumentation layer. It does not change:

- Brain routing;
- support selection;
- mastery thresholds;
- canonical curriculum completion;
- teacher decisions;
- production recommendation policy.

It exists so those systems can later be calibrated with real evidence rather than synthetic tuning alone.
