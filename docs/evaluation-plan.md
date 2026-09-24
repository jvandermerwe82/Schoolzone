# Pilot evaluation plan

The question the pilot answers: **do children who use Schoolzone improve on Year 6 skills, and is it the practice that helps?**

## What's built in

- **Checkpoints**: fixed tests (no hints, no marking until the end) per subject. Maths has 16 questions, English 10 and science 10: every Year 6 skill at level 2 and level 4.
  - The **first** checkpoint is offered before a child's first mission in a subject; the **second** is offered 28 days later.
  - Two forms, **A and B**, test the same skills at the same levels with different questions. Each child gets the other form the second time.
  - **Counterbalanced**: about half the children take A first and half take B first (fixed per child), so a form that happens to be harder doesn't bias the results.
  - Checkpoints don't change the adaptive brain, and children can't use hints during them.
- **Research export** (only for families who opted in, names removed):
  - `GET /api/admin/checkpoints.csv` with header `x-admin-token`: one row per checkpoint answer.
  - `GET /api/admin/events.csv`: every practice answer (skill, level, correct, hints, time, diagnosed mistake, help strategy).

## Suggested design

1. Recruit **[TO COMPLETE: e.g. 20–30]** Year 6 children with parental consent (research opt-in).
2. Week 0: first checkpoints (before practice).
3. Weeks 1–4: normal use. Suggest **[TO COMPLETE: e.g. 3 × 15 minutes a week]**.
4. Week 4+: second checkpoints.
5. Short survey for children and parents: enjoyment, difficulty, and whether the AI tutor was helpful.

## Analysis

- For each child and subject: change in % correct from the first to the second checkpoint. Report the median and range, not just the average.
- Per skill: which skills improved most and least.
- Link to practice: did children who practised a skill more improve more on it? (From `events.csv`.)
- Check the forms: compare children's first-checkpoint scores on A vs B. A large gap means the forms aren't equally hard.

## Limits, stated honestly

- **No control group.** Children would also improve from school lessons over four weeks, so a gain alone doesn't prove Schoolzone caused it. The stronger design is a comparison group, e.g. half start Schoolzone four weeks later ("waitlist control"), with both groups taking both checkpoints.
- **Small numbers.** With 20–30 children, only large effects will be clear.
- **The forms aren't statistically equated.** Counterbalancing reduces the effect of that, but doesn't remove it.
- **Self-selection.** Families who volunteer may be more engaged than average.
