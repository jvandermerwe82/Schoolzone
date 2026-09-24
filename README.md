# Schoolzone

Extra maths, English and science practice for kids, with a **brain** that learns each child's skill set as they go.

**Focus: Year 6** (age 10–11), following the [national curriculum in England](https://www.gov.uk/government/collections/national-curriculum) (2014). Earlier-year skills stay in the app as foundations. A Year 6 child confirms each of them in a question or two, and the brain steps back to them if the child is stuck on Year 6 work.

## Run it

```bash
npm install
npm run dev      # open the URL it prints
npm test         # brain, content and simulated-learner tests
npm run build    # production build in dist/
```

Progress is saved in the browser (localStorage), so no account or server is needed yet.

## What's covered

| Subject | Year 6 skills | Source |
| --- | --- | --- |
| **Maths** | Negative numbers · Factors, multiples & primes · Order of operations · Long multiplication & division · Fractions (simplify, add/subtract with different denominators, multiply, divide) · Decimals & percentages · Algebra · Angles, area & the mean | Year 6 programme of study |
| **English** | Tricky spellings (the full Years 5–6 statutory word list) · Spelling patterns · Homophones · Grammar (active/passive, subject/object, formal language, subjunctive, synonyms/antonyms) · Punctuation (semi-colons, colons, dashes, hyphens) | [Appendix 1: Spelling](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/239784/English_Appendix_1_-_Spelling.pdf), [Appendix 2: Vocabulary, grammar and punctuation](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/335190/English_Appendix_2_-_Vocabulary_grammar_and_punctuation.pdf), and the English glossary |
| **Science** | Classifying living things · Heart, blood & health · Evolution & inheritance · Light · Electricity (series circuits) | Year 6 programme of study |

Maths questions are generated, so they never run out, and every answer is computed. Maths also keeps 7 foundation skills from Years 1–4, and science keeps 5 earlier topics.

English uses British spelling (practise/practice, licence/license, programme, marvellous). Spelling difficulty levels are my own judgement, not official groupings.

## How the brain works

Every child has a learner model with two numbers **per skill** (`src/brain/model.ts`):

| Signal | Method | Used for |
| --- | --- | --- |
| **Ability** | Elo-style rating, the approach used by the Math Garden / Rekentuin system ([Klinkenberg et al., 2011](https://www.sciencedirect.com/science/article/abs/pii/S0360131511000418)) | Picking question difficulty |
| **Mastery** | Bayesian Knowledge Tracing ([Corbett & Anderson, 1995](https://www.researchgate.net/figure/Bayesian-Knowledge-Tracing-Model-Corbett-and-Anderson-1995_fig1_331771496)) | Deciding when a skill is learned, allowing for guesses and slips |

The tutor (`src/brain/tutor.ts`) uses them to decide what comes next:

1. **Right difficulty.** It picks the level (1–5) where the child is predicted to be right about **80%** of the time. Math Garden targets 75% ([Klinkenberg et al., 2011](https://eric.ed.gov/?id=EJ925823)), and [Wilson et al. (2019)](https://www.nature.com/articles/s41467-019-12552-4) derived ~85% as optimal for a broad class of learning algorithms. 80% sits between the two. It is a design choice, not a proven optimum for children.
2. **Frustration.** After 2 misses in a row the questions get easier. After 3, it walks the **skill map** back to the weakest unmastered prerequisite (for example Addition before Subtraction) and practises that first.
3. **Starting point.** The child's school year sets a starting guess for each skill. Skills from two or more years below it start as "probably known", so a Year 6 child moves past them quickly. In simulation, a typical Year 6 child reached Year 6 maths after about 10 questions.
4. **Progression.** A skill counts as mastered when BKT reaches 95% and the child is predicted to get ≥75% of level-3 questions right. Mastering a skill's prerequisites (or reaching 80% on them) unlocks it.
5. **Not forgetting.** Mastered skills come back for review after 1, 2, 4, 8… days (up to 60). A missed review resets the gap to 1 day.
6. **Honesty check.** The dashboard compares the success the brain *predicted* with what actually happened. If those drift apart, the constants need re-tuning.

The numeric constants (step sizes, guess and slip rates, school-year starting guesses) are **my starting values, not taken from the papers**. Tune them once real children are using the app.

### Evidence from the tests

`src/brain/brain.test.ts` runs simulated children with a hidden "true" ability. With the current settings (seeded, so repeatable):

- the brain's ability estimate lands within about 0.5 logits of the hidden value on average after 40 questions
- simulated children got about 80% of questions right, matching the target
- predicted success (77%) was close to actual success (78%)

These are simulations. They show the maths behaves as designed, not that real children learn faster. That needs real usage data.

`src/content/content.test.ts` recomputes the answer to 16,000 generated Year 6 maths questions from the question text alone, using separate code from the app. It also checks that the spelling list matches all 100 statutory words, and that no wrong choice is a word from that list. I picked the misspellings by hand to avoid real words, such as "lightening", "solider" and the American "neighbor". A teacher's review would still be worthwhile.

## Project layout

```
src/brain/     learner model, tutor (what to practise next), parent insights, tests
src/content/   skill map, maths generators (maths.ts, maths-y6.ts), English and science question banks
src/ui/        React screens: profiles, home, practice, parent dashboard
```

## Adding content

- **A new skill:** add it to `src/content/skills.ts` with its prerequisites, then add a generator (maths-style) or a question bank (science-style).
- **A new subject** (such as history): add it to `SubjectId` and `SUBJECTS`, then add skills and questions. The brain needs no changes.

## Next steps worth considering

- Accounts and a backend so progress syncs across devices, plus a parent login.
- Using response time as a signal (Math Garden scores speed as well as accuracy).
- Fitting the constants to real data, per skill.
- An LLM tutor that explains mistakes in the child's own words, using the learner model as context.
- Review of the English and science question banks by a Year 6 teacher.
- Reading comprehension (needs passages written or licensed for the app).
- Remaining Year 6 maths topics: ratio, converting units, coordinates and pie charts.
- Calibrating each question's difficulty from real answers, instead of fixed levels.
