# Schoolzone

Extra maths and science practice for kids, with a **brain** that learns each child's skill set as they go.

## Run it

```bash
npm install
npm run dev      # open the URL it prints
npm test         # brain, content and simulated-learner tests
npm run build    # production build in dist/
```

Progress is saved in the browser (localStorage), so no account or server is needed yet.

## How the brain works

Every child has a learner model with two numbers **per skill** (`src/brain/model.ts`):

| Signal | Method | Used for |
| --- | --- | --- |
| **Ability** | Elo-style rating, the approach used by the Math Garden / Rekentuin system ([Klinkenberg et al., 2011](https://www.sciencedirect.com/science/article/abs/pii/S0360131511000418)) | Picking question difficulty |
| **Mastery** | Bayesian Knowledge Tracing ([Corbett & Anderson, 1995](https://www.researchgate.net/figure/Bayesian-Knowledge-Tracing-Model-Corbett-and-Anderson-1995_fig1_331771496)) | Deciding when a skill is learned, allowing for guesses and slips |

The tutor (`src/brain/tutor.ts`) uses them to decide what comes next:

1. **Right difficulty.** It picks the level (1–5) where the child is predicted to be right about **80%** of the time. Math Garden targets 75% ([Klinkenberg et al., 2011](https://eric.ed.gov/?id=EJ925823)), and [Wilson et al. (2019)](https://www.nature.com/articles/s41467-019-12552-4) derived ~85% as optimal for a broad class of learning algorithms. 80% sits between the two. It is a design choice, not a proven optimum for children.
2. **Frustration.** After 2 misses in a row the questions get easier. After 3, it walks the **skill map** back to the weakest unmastered prerequisite (for example Addition before Subtraction) and practises that first.
3. **Progression.** A skill counts as mastered when BKT reaches 95% and the child is predicted to get ≥75% of level-3 questions right. Mastering a skill's prerequisites (or reaching 80% on them) unlocks it.
4. **Not forgetting.** Mastered skills come back for review after 1, 2, 4, 8… days (up to 60). A missed review resets the gap to 1 day.
5. **Honesty check.** The dashboard compares the success the brain *predicted* with what actually happened. If those drift apart, the constants need re-tuning.

The numeric constants (step sizes, guess and slip rates, grade-based starting guesses) are **my starting values, not taken from the papers**. Tune them once real children are using the app.

### Evidence from the tests

`src/brain/brain.test.ts` runs simulated children with a hidden "true" ability. With the current settings (seeded, so repeatable):

- the brain's ability estimate lands within about 0.5 logits of the hidden value on average after 40 questions
- simulated children got about 80% of questions right, matching the target
- predicted success (76%) was close to actual success (78%)

These are simulations. They show the maths behaves as designed, not that real children learn faster. That needs real usage data.

## Project layout

```
src/brain/     learner model, tutor (what to practise next), parent insights, tests
src/content/   skill map, maths question generators, science question bank
src/ui/        React screens: profiles, home, practice, parent dashboard
```

## Adding content

- **A new skill:** add it to `src/content/skills.ts` with its prerequisites, then add a generator (maths-style) or a question bank (science-style).
- **A new subject** (such as English): add it to `SubjectId` and `SUBJECTS`, then add skills and questions. The brain needs no changes.

## Next steps worth considering

- Accounts and a backend so progress syncs across devices, plus a parent login.
- Using response time as a signal (Math Garden scores speed as well as accuracy).
- Fitting the constants to real data, per skill.
- An LLM tutor that explains mistakes in the child's own words, using the learner model as context.
- Review of the science question bank by a teacher.
