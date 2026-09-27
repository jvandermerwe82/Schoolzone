# SchoolZone — Architecture

## Product role

SchoolZone is vdM Solutions' Australia-first adaptive education product for students, parents and teachers.

## Canonical authorities

- Repository: `jvandermerwe82/Schoolzone`
- Current production/default branch: `claude/adaptive-school-app-skills-i93pd7`
- Live server: Render `schoolzone` service in Singapore
- Persistence: server/cloud authority with persistent Render disk; browser storage is an offline/resilience mirror.

## Core layers

1. **Curriculum/content** — Australian Curriculum v9 registry and mapped learning content.
2. **Learner model** — canonical progress, mastery, misconceptions, retention and support evidence.
3. **Adaptive policy** — placement, prerequisite routing, session regulation and support/scaffold decisions.
4. **Tutor interface** — optional generative tutoring/explanation layer; it does not own canonical learner state.
5. **Parent/teacher layer** — progress reporting, class view, interventions and support context.
6. **Persistence** — authoritative server state plus local resilience mirror and event queue.
7. **Brain Lab** — synthetic/controlled regression benchmarks; not a substitute for real learner evidence.

## Jurisdiction boundary

Australia is the active launch direction. Legacy England/SATs content remains reusable but must not be relabelled as Australian evidence without explicit mapping.

## Learner-safety boundary

SchoolZone may use observable learning/session evidence to adapt support. It must not infer or diagnose disability, ADHD, autism or other health conditions from behavior.

## Kernel boundary

SchoolZone may later consume generic vdM Intelligence Kernel primitives through a reviewed version. Learner data, education ontology, safeguards and child-specific state remain inside SchoolZone.
