# Schoolzone

Extra maths, English and science practice for kids, with a **brain** that learns each child's skill set as they go.

**Focus: Year 6** (age 10–11), following the [national curriculum in England](https://www.gov.uk/government/collections/national-curriculum) (2014). Earlier-year skills stay in the app as foundations. A Year 6 child confirms each of them in a question or two, and the brain steps back to them if the child is stuck on Year 6 work.

## Run it

```bash
npm install
npm test                  # all tests (brain, content, badges, server API)

# App only (offline mode: progress stays in this browser)
npm run dev

# App + server (accounts, sync, AI tutor)
cp .env.example .env      # add ANTHROPIC_API_KEY to switch the AI tutor on
npm run dev:server        # API on http://127.0.0.1:8787
npm run dev               # app; /api calls are proxied to the server

# Try the AI tutor screens without an API key (scripted replies, real safety checks)
npm run preview:scripted-tutor   # http://127.0.0.1:8788

# Production: build, then serve app + API from one process behind HTTPS
npm run build && npm start
```

If no server is reachable, the app runs in **offline mode**: everything stays in the browser and nothing is sent anywhere.

## Server ("the plumbing")

`server/` is a small Node server (Fastify, with Node's built-in SQLite). What it does:

| Area | What's in place |
| --- | --- |
| **Accounts** | Parent accounts (children never have logins). Passwords hashed with scrypt. Only a hash of each session token is stored. Cookies are http-only and SameSite=Lax, and Secure in production. Logins, sign-ups and PIN checks are rate-limited. |
| **Email** | The parent must confirm their email before adding a child, so they can always be reached. Password reset links work once and expire after an hour, and "forgot password" never reveals whether an email has an account. A reset or password change signs out every other device and sends a "your password was changed" email. Works with any SMTP provider (`SMTP_URL`); without it, emails go to the server log. |
| **Consent** | Versioned parental consent is recorded before any child data is stored. The AI tutor and research use are separate opt-ins, off by default. |
| **Data minimisation** | Only first name or nickname, year, avatar and practice data are stored. Children get random ids, and names never appear in answer logs. |
| **Sync** | Profiles are saved with version checks, so two devices can't silently overwrite each other; the copy with more practice wins. Answers queue on the device and are sent in batches, so nothing is lost offline. |
| **Shared learning** | Question difficulty is learned from every child's answers across the whole server, not per device. This uses no personal data. |
| **Research data** | Answer events are stored only with research consent. An admin export (`ADMIN_TOKEN`) gives pseudonymised CSV with no names or real ids. |
| **Deletion and retention** | Parents can delete a child or their whole account. Everything is removed. Withdrawing research consent deletes stored answers. Old events and chats are pruned after `RETENTION_DAYS`. |
| **AI tutor** | Claude via the official SDK (`TUTOR_MODEL`, default `claude-opus-5`, with Anthropic's server-side safety fallback enabled). It's switched on only with an API key and parental opt-in. Details below. |

### AI tutor safeguards

Anthropic has [guidelines for organisations whose products are used by minors](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors). How each is covered:

- **Clear that it's an AI:** the panel is labelled "AI tutor" and explains it's a computer program, not a person. The model is told to say so if asked.
- **Safety guidance for children:** shown before the first message (don't share personal details; a parent can read chats).
- **Content screening:** worrying messages (self-harm, being hurt, sexual content, arranging contact, violence) are never sent to the AI. The child gets a kind, fixed reply pointing to a trusted adult and [Childline, free on 0800 1111](https://www.childline.org.uk/). The message is flagged for the parent. AI replies are screened the same way.
- **Contact details:** emails, phone numbers and links are removed before anything is sent.
- **Never gives the answer:** tutors that hand out answers can harm learning ([Bastani et al., PNAS 2025](https://www.pnas.org/doi/10.1073/pnas.2422633122)). Every reply is checked by code: if it contains the answer or a wrong sum, it's retried once and then replaced with a pre-written hint.
- **Monitoring:** parents can read every chat. Flagged messages are highlighted in the parent area, and the parent is emailed straight away (at most once an hour per child). The email doesn't include the message itself.
- **Limits:** 60 messages per child per day by default (`TUTOR_DAILY_LIMIT`).

The safety screen is a simple word-and-phrase check. It will flag some harmless messages and miss some worrying ones. It's a first layer, not a full moderation system.

### Operations

- **Security headers** on every response: a strict Content-Security-Policy (no third-party scripts, fonts or frames), `nosniff`, no referrer, and HSTS when `APP_URL` is `https://`. API responses aren't cached.
- **Health check:** `GET /api/health` checks the database and returns 503 if it's unavailable.
- **Backups:** once a day (`VACUUM INTO`, a consistent copy) into `BACKUP_DIR`, keeping `BACKUP_KEEP` days. `npm run backup` makes one straight away.
- **Behind a proxy:** `TRUST_PROXY` makes rate limits see the real visitor address.
- **Docker:** `Dockerfile` builds one container that runs as a non-root user, with data in a `/data` volume.
- **Checks:** `npm run check:email -- you@example.com` and `npm run check:tutor` test the real email provider and API key.

See **[docs/deployment.md](docs/deployment.md)** for the step-by-step guide.

### Checkpoints (measuring whether it helps)

Before a child's first mission in a subject, the app offers a short **checkpoint**: every Year 6 skill at two levels (maths 16 questions, English 10, science 10), with no hints and no marking until the end. A second checkpoint is offered 28 days later using the other of two forms (A/B, counterbalanced per child). Children can choose "Later". Parents see first and latest scores in the parent area, and `GET /api/admin/checkpoints.csv` exports results for research-consented families. See [docs/evaluation-plan.md](docs/evaluation-plan.md), including its limits (no control group; forms not statistically equated).

### Schools and leaderboards

- **Joining:** a teacher registers the school (from "Teachers" on the player screen). It goes live only after an admin checks the teacher works there (`ADMIN_EMAIL` is told; approve with `/api/admin/schools`). The teacher then gets a join code, and parents enter it in the Parents area.
- **Two boards, two periods:** a **school board** (average per pupil, shown once a school has 5 pupils) and a **pupil board** inside each school, each for **This week** (effort points) and **All time** (XP).
- **Effort points** are counted by the server: 10 for a right answer, 5 with a hint, 2 for a real try, 0 for a rushed guess. Capped at 300 a day, new week every Monday (UK time), so long sessions don't win.
- **Privacy:** pupils are on the pupil board only if a parent switches it on, and then under a generated code name ("Swift Falcon"), never their real name, and only other pupils at the same school can see it. Only the top 10 are listed (plus the child's own place). Teachers see how many pupils joined, not who.
- **Known limit:** all-time XP is worked out on the child's device, so a determined adult could inflate it. Weekly points are counted and capped by the server, so they're much harder to game.

### Before children use it: pilot checklist

In place and tested: everything above (server API tests cover auth, consent, privacy between families, sync conflicts, events, research exports, deletion, retention, tutor safeguards, safety flags, security headers, health and backups).

| Item | Done in the code / docs | Still needs you |
| --- | --- | --- |
| **Hosting, HTTPS, backups** | Dockerfile, health check, HSTS, daily rotating backups, restore steps ([deployment.md](docs/deployment.md)) | Choose a host (ideally UK/EEA), set up HTTPS, copy backups off-site encrypted, test a restore |
| **Email and `APP_URL`** | SMTP support, `npm run check:email` | Choose a provider, set `SMTP_URL`, `MAIL_FROM`, `APP_URL`, and SPF/DKIM/DMARC |
| **Anthropic API key** | `npm run check:tutor` (checks the key, then two real tutor replies) | Create the key; review Anthropic's minors guidelines |
| **Privacy notice and DPIA** | Drafts: [privacy-notice.md](docs/privacy-notice.md), [dpia-draft.md](docs/dpia-draft.md); child-friendly "Your information" page in the app | Fill in the [TO COMPLETE] parts; qualified review; sign-off |
| **Flagged-chat process** | Draft: [safeguarding-procedure.md](docs/safeguarding-procedure.md) | Name a lead and deputy; set response times |
| **Year 6 teacher review** | `npm run content:export` writes every question, note and explanation (856 rows) to `review/schoolzone-content-review.csv`, with columns for the reviewer | Find a teacher to review it |
| **Before-and-after tests** | Checkpoints, parent view, export, [evaluation-plan.md](docs/evaluation-plan.md) | Recruit families; decide on a comparison group |

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

## Look and feel

The app is designed for Year 6 (age 10–11), not young children. The [Nielsen Norman Group](https://www.nngroup.com/articles/childrens-websites-usability-issues/) found children are acutely aware of age: they reject designs that look aimed at younger kids, and advise designing separately for 9–12s. Online gaming is near-universal at this age: 78% of 8–9-year-olds play online according to Ofcom's 2025 report, and Roblox was UK 7–12s' top mobile game in Childwise's summer 2025 survey ([Kidscreen](https://kidscreen.com/2025/10/17/which-roblox-games-are-kids-favorites/)). So the app uses the language of games:
- dark, game-launcher look with colour-coded **zones** (Maths, English, Science);
- a **player card** with level, XP bar and day streak;
- **missions** of 10 questions, with a progress bar, streak counter and "+XP" pop-ups;
- **achievements** with rarity (Common to Legendary), including secret Easter eggs;
- teen-friendly avatars and plain, non-babyish wording.

XP rewards effort: unaided correct answers earn most, answers after a hint earn half, rushed guesses earn nothing. The app uses the device's own fonts, so no font service receives children's IP addresses.

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
src/ui/        React screens: sign-in, consent, player select, home, missions, checkpoints, leaderboard, teachers, skills, parent area, "Your information"
src/api.ts     server client; src/sync.ts: offline-safe syncing
server/        API (app.ts), database (db.ts), schools and leaderboards (leaderboard.ts), backups (backup.ts), AI tutor (tutor.ts), safety screening (safety.ts), tests
scripts/       content export for teacher review, email and AI tutor checks
docs/          deployment guide and drafts: privacy notice, DPIA, safeguarding procedure, evaluation plan
```

## Adding content

- **A new skill:** add it to `src/content/skills.ts` with its prerequisites, then add a generator (maths-style) or a question bank (science-style).
- **A new subject** (such as history): add it to `SubjectId` and `SUBJECTS`, then add skills and questions. The brain needs no changes.

## Next steps worth considering

- Fitting the constants to real data, per skill.
- An LLM tutor that talks through mistakes in the child's own words, using the learner model (and the diagnosed misconception) as context.
- More mistake patterns, especially for English grammar and science, where only some wrong options are tagged so far.
- A child-friendly light theme option.
- Reading comprehension (needs passages written or licensed for the app).
- Remaining Year 6 maths topics: ratio, converting units, coordinates and pie charts.
- Calibrating each question's difficulty from real answers, instead of fixed levels.
