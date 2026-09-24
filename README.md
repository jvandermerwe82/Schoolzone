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

The brain learns from **every answer**. Here is what each answer updates:

| What it learns | How | Code |
| --- | --- | --- |
| **How hard a question the child can handle** (per skill) | Elo-style ability rating, as used by Math Garden ([Klinkenberg et al., 2011](https://www.sciencedirect.com/science/article/abs/pii/S0360131511000418)) | `model.ts` |
| **Whether the skill is really learned** | Bayesian Knowledge Tracing ([Corbett & Anderson, 1995](https://www.researchgate.net/figure/Bayesian-Knowledge-Tracing-Model-Corbett-and-Anderson-1995_fig1_331771496)) | `model.ts` |
| **Why an answer was wrong** | Matches wrong answers against known mistake patterns, e.g. forgetting to carry, "smaller from larger" subtraction ([Brown & Burton, 1978](https://www.sciencedirect.com/science/article/pii/S0364021378800044)), adding fraction tops and bottoms ([NFER](https://www.nfer.ac.uk/assessment-hub/what-are-the-common-mistakes-when-adding-fractions/)), spelling error types, and well-known science misconceptions | `misconceptions.ts`, `content/bugs.ts` |
| **Which mistakes the child still makes** | Repeating a mistake makes it "active". Getting right a question where that mistake would show up weakens it, until it's marked fixed | `misconceptions.ts` |
| **What kind of help works for this child** | Success rate of each way of helping; the best one is tried first | `help.ts` |
| **How hard each question really is** | The item side of Elo: difficulty adjusts after every answer, compared within each skill | `items.ts` |

### When the child is stuck, it doesn't move on

A wrong answer starts a **stuck episode** (`help.ts`). The app stays on the problem and tries one way of helping at a time:

1. **Explain the mistake**, then give a similar question. It's a little easier, unless the easier level can't show the same mistake.
2. **Show a worked example** step by step, then "your turn". Worked examples help beginners most ([worked-example effect](https://en.wikipedia.org/wiki/Worked-example_effect)).
3. **Give a hint** up front. On multiple choice, a hint also removes one wrong option.
4. **Break it down:** start at the easiest level and build back up.
5. **Go back to the earlier skill** it depends on, then return.

When one of these gets the child answering correctly, they climb back up to the original level **without help**. The episode ends only when they can do it on their own. Only then does that way of helping count as "helped" for this child.

If the child slips on the way back up, the app tries a **different** way. After every way has been tried, it starts another round. It never gives up and never quietly moves past the problem. An unfinished problem is picked up again next session.

### How it reads the child's answers

- **Hints:** a correct answer after a hint gets half credit for the rating. For mastery it is treated as practice, not proof, because counting hinted answers as plain wrong hurts accuracy ([Wang et al.](https://files.eric.ed.gov/fulltext/ED593119.pdf)).
- **Rushed guesses:** a wrong answer given faster than the question could be read (1.5 s plus reading time) counts as a guess, not as being stuck. The child gets a "take your time" nudge. This is based on response-time effort ([Wise & Kong, 2005](https://www.researchgate.net/publication/248940611_Response_Time_Effort_A_New_Measure_of_Examinee_Motivation_in_Computer-Based_Tests)).
- **Choosing difficulty:** questions are aimed at about **80%** success. Math Garden targets 75%, and [Wilson et al. (2019)](https://www.nature.com/articles/s41467-019-12552-4) derived about 85% for learning algorithms. 80% is my choice between the two.
- **Stretching:** after 4 unaided correct answers in a row, it tries a harder level if the child has at least a 50% chance at it. Easy questions tell the rating little, and without this a child could sit on easy questions for a long time.
- **Progression and reviews:** mastered skills unlock the next ones. Mastered skills come back for review after 1, 2, 4, 8… days.

All numeric settings are **my starting values, not taken from the papers**. Tune them with real data.

### Evidence from the tests (simulated children, seeded so repeatable)

- 20 simulated children, 40 questions each: success rate **80.2%** (target 80%), and the ability estimate is within about 0.5 of the hidden true value on average.
- Across those runs, children got stuck 63 times and worked through it 58 times. The other 5 were still being worked on when the simulation stopped. Typical length: 2 questions, longest 16.
- A simulated child who only learns from worked examples: the app learns to try worked examples first.
- A simulated child with the "forgets to carry" misconception: the app notices it, helps, and marks it fixed once the child stops making it.
- When the real question difficulties differ from the assumed ones, the learned difficulties move the right way for every level and predictions improve.
- The app's predicted success (about 81%) runs a little below actual success (about 87%) in these runs. Help and hints raise success above what the rating alone predicts. That's a known gap to tune with real data.

These show the logic behaves as designed. They don't prove real children learn faster; that needs real use.

`src/content/content.test.ts` independently recomputes 16,000 generated Year 6 maths answers and checks the spelling list against the statutory list. `src/brain/help.test.ts` checks that every mistake pattern attached to a question is really wrong and is recognised.

## Problem Solver

Every question has a **🧩 Problem Solver** panel the child can open (`src/content/solver.ts`):

- **💡 Hints, one step at a time.** First a strategy tip for the skill. Then the first step of *this* problem, taken from its worked explanation and stopped before anything that gives the answer away. Where the answer is a number, the working is shown with it blanked out ("12 ÷ 2 = ?"). On multiple choice, the last hint removes a wrong option. A test checks no step hint contains the answer across about 6,500 questions. About 89% of maths questions get a question-specific step; the rest get the tip, notes, word meanings and an example.
- **📘 About this topic.** Short notes on the skill, for every skill.
- **🔤 What do the words mean?** Plain definitions of the key terms in the question, matched by subject so "object" gets its grammar meaning only in English.
- **👀 Show me an example.** A similar question, solved step by step.

Using the Problem Solver is encouraged. The answer then counts as practice (half credit, not proof of mastery), the same as a hint.

## Badges and rewards

Children earn **badges** for reaching levels (for example "Year 6 Maths Champion" for mastering every Year 6 maths skill) and for achievements like streaks, practice days and 100 questions answered. Some are **Easter eggs** that stay secret ("???") until found:
- **Comeback Kid:** crack a problem after being stuck.
- **Bug Squasher:** stop making a mistake you used to make.
- **All-Rounder:** practise all three subjects in one day.
- **Never Give Up:** work through 5 tricky problems.

**Parents decide what each badge is worth.** When a learner is added, a parent must set up rewards before the child can start. The parent:
- creates a 4-digit PIN;
- picks a currency (£, R, $ or €);
- gives each badge a reward in their own words (e.g. "30 minutes of screen time"), an **amount of money**, or both;
- can switch badges off.

The child sees the reward when a badge unlocks, e.g. "30 minutes of screen time + R5.00". Parents see a "Rewards to give" list with totals (money earned, paid and still to pay) and mark each reward as given. Money is stored in whole cents to avoid rounding errors. A badge's value is fixed when it's earned, so changing it later doesn't change what's already owed.

The PIN is stored on the device and only keeps children out casually. It isn't strong security. Badges are defined in `src/brain/badges.ts`.

## Project layout

```
src/brain/     learner model, tutor, stuck-episode help, misconceptions, question calibration, badges, tests
src/content/   skill map, maths generators (maths.ts, maths-y6.ts), English and science question banks, Problem Solver (hints, notes, word meanings)
src/ui/        React screens: profiles, home (with badges), practice, parent dashboard, parent rewards area
```

## Adding content

- **A new skill:** add it to `src/content/skills.ts` with its prerequisites, then add a generator (maths-style) or a question bank (science-style).
- **A new subject** (such as history): add it to `SubjectId` and `SUBJECTS`, then add skills and questions. The brain needs no changes.

## Next steps worth considering

- Accounts and a backend so progress syncs across devices, plus a parent login.
- Fitting the constants to real data, per skill.
- An LLM tutor that talks through mistakes in the child's own words, using the learner model (and the diagnosed misconception) as context.
- More mistake patterns, especially for English grammar and science, where only some wrong options are tagged so far.
- Sharing question difficulty across all children (needs a backend); today it is learned per device.
- Review of the English and science question banks by a Year 6 teacher.
- Reading comprehension (needs passages written or licensed for the app).
- Remaining Year 6 maths topics: ratio, converting units, coordinates and pie charts.
- Calibrating each question's difficulty from real answers, instead of fixed levels.
