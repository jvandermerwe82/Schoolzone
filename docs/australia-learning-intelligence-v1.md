# SchoolZone Australia — Learning Intelligence Architecture v1

Status: **foundation contract**
Branch: `arch/australia-learning-intelligence-v1`

## Product direction

SchoolZone is a personal learning system that connects the learner, parent, teacher and SchoolZone Brain around one evolving learning profile.

The teacher sets learning intent. SchoolZone determines the individual route. The learner's outcomes update the Brain. Parents and teachers see useful, bounded insight. Aggregated evidence may later support schools, researchers and education systems, but personal learner data remains purpose-limited and protected.

Australia is the first launch market. The architecture must remain curriculum- and jurisdiction-independent so future country packs can reuse the same Brain.

## Non-negotiable design rules

1. **Personalise the learner, not the label.** SchoolZone may record parent/teacher/learner-supplied support preferences and observed outcomes. It must not infer or diagnose ADHD, autism, dyslexia or another condition.
2. **Academic state and support state are different.** A learner can know the content while benefiting from a different presentation, pace or interaction.
3. **Preferences are not proof.** A parent, teacher or learner preference tells SchoolZone what to try. It does not count as evidence that the adjustment improves learning.
4. **Measured support outcomes need confidence.** SchoolZone should never present one successful session as a stable truth about a child.
5. **Teacher intent is a destination, not a forced route.** If prerequisites are weak, the Brain may remediate them before returning to the assigned objective.
6. **Competition rewards effort and growth, not only attainment.**
7. **Child data is not a commodity.** Individual profiles are for the child's service. System-level analytics must be de-identified/aggregated with governance and minimum cohort controls before external use.
8. **The AI tutor is not the learner model.** Deterministic/code-based intelligence owns skill state, mastery, misconceptions, support evidence and routing. Generative AI explains and converses within those constraints.
9. **Every inference must be retractable.** New evidence can weaken or reverse a prior support hypothesis.
10. **Australia first, global by contract.** Curriculum IDs, year levels and jurisdiction live outside the core learner model.

## Existing foundation we keep

The current repository already has strong components that become the Academic State:

- Elo-style per-skill ability estimation
- Bayesian Knowledge Tracing (`pKnown`)
- mastery and spaced review
- misconception diagnosis and resolution
- persistent stuck/help episodes
- personalised help-strategy history
- shared item-difficulty learning
- checkpoints
- teacher class view and homework intent
- parent consent and controls
- offline-safe profile/event sync
- AI tutor with deterministic answer/safety checks

We are not replacing these. Learning Intelligence v1 wraps and extends them.

## Canonical Learning Profile

The long-term profile has six conceptual layers.

### 1. Academic State

Current source of truth remains the existing `Profile.skills`, `misconceptions`, `help`, history, checkpoints and item model.

Answers:
- What does the learner know?
- What difficulty can they handle?
- What is likely misunderstood?
- What needs review?

### 2. Learning Support Profile

Stores two deliberately separate concepts:

**Explicit preferences**
- supplied by learner, parent or teacher;
- e.g. prefer read-aloud, avoid countdowns, use predictable steps.

**Observed effectiveness**
- derived from learning outcomes while a support strategy was active;
- scored with confidence from repeated evidence.

Examples of support strategies:
- chunked instructions
- visible steps
- read-aloud
- reduced visual density
- larger text
- extended response time
- shorter missions
- predictable session structure
- worked examples
- smaller steps
- visual examples
- reduced animation
- optional breaks

This layer does not contain diagnostic labels.

### 3. Engagement State

Behavioural observations, not medical interpretation.

Examples:
- rapid-guessing episodes
- persistence after errors
- voluntary continuation
- session duration
- disengagement after long runs
- recovery after a break
- help-seeking

These signals may influence session structure, but must not be described as a diagnosis.

### 4. Current Direction / Teacher Intent

A teacher, parent or learner can set a goal such as:

> Equivalent fractions this week.

Intent contains:
- objective
- target skill(s)
- curriculum references where available
- source
- priority
- assignment/due dates
- completion state

The Brain is allowed to traverse prerequisites before returning to the target.

### 5. Retention / Learning Memory

Current spaced review becomes the base.

Later this layer should distinguish:
- newly learned
- stable
- due for review
- decaying
- recovered after review

### 6. Curriculum Context

The Brain must not hard-code "England Year 6" as identity.

A learner can instead be attached to a curriculum context:
- jurisdiction
- curriculum framework/version
- local year/grade
- subject mappings

Initial target: Australian Curriculum Version 9. Future packs can coexist with England and other jurisdictions.

## Evidence hierarchy

Support decisions should use evidence in this order:

- **Preference evidence**: learner/parent/teacher says a support is helpful or should be avoided.
- **Observed outcome evidence**: measurable change while a support is active.
- **Repeated evidence**: outcome repeated across sessions/skills.
- **Contextual evidence**: support works in a specific subject, skill type or task form.
- **Stable evidence**: enough repeated evidence to make a high-confidence default.

A preference can cause SchoolZone to try an adjustment immediately, but only outcomes can establish effectiveness.

## Teacher → Brain → learner loop

1. Teacher assigns an objective.
2. SchoolZone maps it to canonical skill IDs.
3. The Brain checks readiness/prerequisites.
4. It chooses an individual route, difficulty and support strategy.
5. The learner practises.
6. Every answer updates academic state.
7. Support outcomes update the Learning Support Profile.
8. The teacher sees progress, common misconceptions and which learners need human attention.
9. Parent receives child-level insight and retains control over sharing.
10. The next session starts from the updated state.

## Data hierarchy

### Learner intelligence
Identifiable because it directly provides the service to that child.

### Class intelligence
Visible to an authorised teacher only where parent/school permissions allow.

### School intelligence
Aggregated curriculum and intervention patterns; avoid unnecessary child identity.

### Network / research intelligence
De-identified or aggregated evidence with minimum cohort rules.

### Education intelligence
Policy/research outputs should contain population-level findings, not individual learner profiles.

Before any external analytics API exists, SchoolZone needs:
- minimum cohort thresholds;
- suppression of sparse cells;
- documented data purpose;
- access logging;
- consent/legal-basis review;
- data-retention policy;
- independent privacy/security review.

## Australia implementation sequence

### A0 — architecture foundation (this change)
- canonical learning-intelligence contracts;
- curriculum contract;
- support preference vs outcome separation;
- deterministic confidence aggregation;
- no integration into existing persisted profile yet.

### A1 — Australian curriculum layer
- add Australian Curriculum v9 framework metadata;
- map Years 4–6 Maths, English and Science into canonical SchoolZone skills;
- retain England pack separately;
- add mapping tests and version provenance.

### A2 — Learning Support Profile persistence
- add versioned profile field with migration/defaulting;
- parent/learner/teacher preference inputs;
- support outcome events;
- confidence calculation;
- privacy/export rules.

### A3 — adaptive support routing
- use support evidence when choosing presentation/help;
- run only bounded, child-safe adjustments;
- measure outcomes;
- prevent rapid oscillation between settings.

### A4 — teacher intent v2
- multiple active objectives;
- due dates and priorities;
- curriculum references;
- per-learner route explanation;
- teacher intervention queue.

### A5 — Australian pilot evaluation
Measure learning gain, retention, misconception resolution, support-strategy effectiveness, engagement, teacher time saved and learner/parent experience.

## Definition of success for v1 architecture

We should be able to answer, in code and from auditable evidence:

> What does this learner know?

> What are they trying to achieve now?

> Where are they getting stuck?

> Which forms of help appear to work for them, and how confident are we?

> What does their teacher want them to work toward?

> What curriculum standard does that objective map to?

without using disability labels as an inference mechanism.
