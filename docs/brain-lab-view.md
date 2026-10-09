# Brain Lab view layer and the Year 5 fractions slice

This explains the read-only layer that shows what the SchoolZone learning engine decides, and the lesson changes that go with it. It reuses the existing Brain. It does not replace, retune or fork it.

## What is new

| Area | Files | What it does |
| --- | --- | --- |
| Pure selectors | `src/brain-view/selectors.ts`, `views.ts` | Turn real engine state into plain view models. Nothing is written back. |
| Evidence labels | `src/brain-view/evidence-mode.ts` | Labels an attempt as assisted practice, unaided demonstration, due review or independent delayed check. Presentation only. |
| Trace runner | `src/brain-view/trace.ts`, `scenarios.ts` | Plays scripted synthetic learners through the real `planNext`, `makeQuestion`, `curriculumEvidenceForQuestion` and `recordAnswer`. Clock and RNG are inputs. |
| Adult cards | `src/brain-view/audience.ts` | Parent and teacher summaries, with the sharing gate. Parity-tested against `server/classview.ts`. |
| Fraction bars | `src/content/fraction-bars.ts`, `src/ui/FractionBars.tsx` | Exact equal-piece bars the child can cut. Support only, the typed answer is unchanged. |
| Lesson strip | `src/brain-view/lesson-status.ts`, `src/ui/LessonStatus.tsx` | Tells the child what kind of attempt this is and how SchoolZone is helping. |
| Brain Lab | `src/ui/brain-lab/*`, `src/internal-lab.ts`, `src/main.tsx` | Internal explorer. Off unless built with the flag. |

## Running the Brain Lab

```
VITE_INTERNAL_BRAIN_LAB=true npm run dev
# open http://localhost:5173/#/internal/brain-lab
```

Or build it: `VITE_INTERNAL_BRAIN_LAB=true npm run build`.

When the variable is not exactly `true`, `main.tsx` never references the lab module, so the lab is absent from the build. A default build contains no lab chunk and no lab CSS. When it is on, the lab opens instead of the app, so no profile, sign-in, sync or storage code runs on that page.

Do not set the variable on the production service. For a Netlify deploy preview, set it for the deploy-preview context only.

## Guarantees, and where they are tested

- Synthetic learners only: `assertSyntheticProfile` refuses anything else (`trace.test.ts`).
- No profile mutation, no storage, network or tutor chat in `src/brain-view` (`trace.test.ts`).
- A helped answer is never labelled independent (`selectors.test.ts`, `trace.test.ts`).
- A curriculum status that rests on helped answers carries a caveat (`selectors.test.ts`).
- One wrong answer is a possible slip, two are a pattern (`selectors.test.ts`).
- The shown choice of help equals what `nextStrategy` chose (`trace.test.ts`).
- Teacher cards exist only when the parent shares, and match `pupilSummary` (`audience.test.ts`).
- Fraction bars: exact equal pieces, same total as the real generator answer, never a total in hint mode (`fraction-bars.test.ts`, `lesson-ui.test.tsx`).

## Findings in the existing engine, not changed here

1. `canonicalProgress` weights an answer by `hinted` and `rapid` only. An answer given while a help strategy was active but with no hint opened counts at full weight. The view layer labels these as assisted. The engine is unchanged.
2. Seven hinted correct direct answers produce canonical status `mastered`. The lab shows this with a caveat. Whether the engine should change is a curriculum and pilot-evidence decision.
3. `fractions-y6` level 2 is the only practice route for the Year 5 objective AC9M5N05, and the audit rates it `partial`.
4. Skill names shown to children come from the England-based registry, for example "Fractions (Year 6)" for an Australian Year 5 learner.
5. The existing static fraction visual draws at most 12 pieces, so a denominator above 12 is drawn with the wrong number of pieces. The new bars decline those and fall back to it.

## One generator change

`fractions-y6` levels 2 and 3 now list the "add the tops and the bottoms" answer as a catalogued mistake (`frac-add-across`) for addition only. Correct answers and explanations are untouched. This is the only live content change.
