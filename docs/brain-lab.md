# SchoolZone Brain Lab

Brain Lab is SchoolZone's deterministic synthetic evaluation environment.

It exists to answer two questions:

1. **Does the Brain learn a learner more accurately as evidence arrives?**
2. **Is a new Brain policy measurably better than a previous/challenger policy on the same hidden learners?**

## Hidden learner model

Each synthetic learner has properties the Brain never sees directly:

- latent academic ability;
- careless-slip rate;
- rapid-response rate;
- preferred help strategy;
- extra benefit from that strategy.

The Brain receives only normal answer outcomes and uses the same production learner-model functions used by SchoolZone.

## V1 metrics

- **Ability MAE** — absolute error between estimated and hidden ability.
- **Prediction Brier score** — squared error of predicted success probability.
- **Calibration gap** — difference between average predicted and actual success.
- **Answers to stable estimate** — first point where ability error stays within 0.6 for three observations.
- **Stable estimate rate** — proportion of synthetic learners reaching that threshold.
- **Learning curve** — the same metrics after fixed answer counts.

## Policy comparison

The evaluator accepts pluggable policies. V1 includes:

- `current` — the real production planning policy;
- `adaptive-80` — isolated adaptive difficulty without full orchestration;
- `static-mid` — deliberately simple level-3 reference baseline.

`static-mid` is **not** presented as a historical SchoolZone version. Future Brain releases should retain their prior policy as a named challenger so exact version-to-version comparisons can run on the same population and seeds.

## Running

Use:

`npm run brain:lab`

The command prints machine-readable JSON suitable for CI artifacts and later dashboards.

## CI

Every CI run on Brain Lab branches now executes the benchmark and uploads `brain-lab.json` as a retained artifact.

## Guardrail

Brain Lab does not mutate production learner data or change runtime policy. It is an evaluation harness only.
