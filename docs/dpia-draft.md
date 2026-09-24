# Data protection impact assessment: Schoolzone (DRAFT)

> **Draft to start from, not a finished assessment.** The ICO's Children's Code (standard 2) expects a DPIA for online services likely to be used by children, and the ICO publishes a DPIA template for this in [Annex D of the Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-d-dpia-template/). This draft follows the ICO's seven steps and describes what the software does. The risk ratings are a starting suggestion, and the people accountable for Schoolzone must review and sign it off. Items marked **[TO COMPLETE]** need your input.

## Step 1: Why a DPIA is needed

Schoolzone processes personal data of children aged about 10–11, including learning performance, and (optionally) sends children's free-text messages to an AI provider. Children's data and innovative technology (AI) are both reasons the ICO expects a DPIA.

## Step 2: The processing

**Nature.** Parents create accounts and child profiles. Children answer practice questions; the app adapts difficulty, diagnoses mistake patterns, and records progress. Optionally, children chat with an AI tutor (Anthropic's Claude) about a question.

**Scope.**
- Data: parent and teacher emails, teacher homework notes, SATs practice results, display settings, hashed password and PIN, consent records; school name and membership, generated code name, leaderboard choice, weekly points; child first name or nickname, school year, avatar, answers, timings, hints used, skills, mistake patterns, badges, XP, checkpoint results; optional tutor messages.
- No special category data is requested. Tutor messages could contain sensitive information a child chooses to type (e.g. about their wellbeing).
- Volume: pilot of **[TO COMPLETE: number]** families.
- Retention: events and chats up to 365 days (configurable); profiles until deleted; backups 14 days (configurable).

**Context.** Children are vulnerable users. Parents control accounts. Used at home **[TO COMPLETE: or in school]**.

**Purposes.** Personalised practice; keeping children safe; measuring whether the app helps (optional research).

## Step 3: Consultation **[TO COMPLETE]**

Who has been or will be consulted: parents, children (e.g. a small user group), a Year 6 teacher, a safeguarding lead, a data protection adviser.

## Step 4: Necessity and proportionality

- Only first names or nicknames; no surnames, schools, dates of birth, photos or locations.
- Answer logs use random ids; research exports are pseudonymised with a keyed hash.
- The AI tutor and research use are separate opt-ins, off by default.
- Contact details are removed from tutor messages before they are sent; worrying messages are not sent at all.
- Parents can see all chats and delete data at any time; withdrawing research consent deletes kept answers.
- Data is deleted automatically after the retention period.

## Step 5: Risks

| # | Risk | Likelihood | Severity | Overall |
| --- | --- | --- | --- | --- |
| 1 | A child shares personal or sensitive information with the AI tutor | Possible | Significant | Medium |
| 2 | A child discloses harm or self-harm and it isn't acted on | Remote–possible | Severe | High |
| 3 | The AI tutor says something inappropriate or wrong | Remote | Significant | Medium |
| 4 | Unauthorised access to a family's data (e.g. weak or reused password) | Possible | Significant | Medium |
| 5 | Server or backup breach | Remote | Severe | Medium |
| 6 | Data used beyond what parents expect (function creep) | Remote | Significant | Low |
| 7 | Gamification nudges children to overuse the app | Possible | Minimal–significant | Low–medium |
| 8 | Leaderboards: a child is identified by classmates, or feels bad about a low rank | Possible | Minimal–significant | Medium |
| 9 | Someone pretends to be a school to gather children into a group | Remote | Significant | Low–medium |
| 10 | A teacher account sees named pupils' learning data, or misuses homework notes to contact children | Remote | Significant | Medium |

## Step 6: Measures

| Risk | Measures in place | Still to do |
| --- | --- | --- |
| 1 | AI disclosure and safety guidance shown to children; contact details removed; parents can read all chats | Review chats during the pilot |
| 2 | Safety screening sends a trusted-adult/Childline message; message not sent to the AI; parent emailed straight away and warned in the parent area | **Named safeguarding lead and response process** (see `docs/safeguarding-procedure.md`); screening is keyword-based and will miss some messages |
| 3 | Guided system prompt; code checks block answer leaks and wrong sums; Anthropic's safety classifiers and fallback | Monitor flagged replies; add Anthropic's child-safety system prompt if provided |
| 4 | Passwords ≥10 chars, scrypt hashing, rate limits, email confirmation, reset signs out all devices, password-change alerts | Consider two-factor sign-in later |
| 5 | Hashed secrets; only token hashes stored; security headers; data only in `/data` volume | **HTTPS hosting, encrypted backups, access control** [TO COMPLETE] |
| 6 | Purposes stated in consent; research opt-in; no advertising | Review annually |
| 7 | Missions are short (10 questions); no pay-to-win; XP rewards effort not speed; weekly points capped at 300 a day and reset every Monday; neutral wording, no "you'll lose your place" messages | Consider daily time reminders for parents |
| 8 | Pupil board off by default (parent opt-in); generated code names only, never real names; visible only inside the child's own school; top 10 only (no bottom of the table); school board shows averages, only from 5 pupils; points reward effort (right answers, hints, tries) not just ability | Ask children and teachers in the pilot how the board feels; a child who recognises a classmate's avatar could guess who they are |
| 10 | Sharing with the teacher is off by default and chosen per child by the parent; the teacher sees skills and mistake patterns only, never answers, chats or rewards; the class view is only for the school's own, admin-approved teacher; homework notes are 140 characters, with links, contact details and worrying phrases (including secrecy, e.g. "don't tell your parents") rejected | Agree with schools how teachers use this data (e.g. under the school's own data policy); consider whether schools should be joint controllers |
| 9 | Schools go live only after an admin checks the teacher works there; teachers see no pupil names or answers; join-code guessing is rate-limited; codes can be replaced | **Decide how you check teachers** [TO COMPLETE], e.g. a reply from the school office |

## Step 7: Sign-off **[TO COMPLETE]**

| Item | Name / date | Notes |
| --- | --- | --- |
| Measures approved by | | |
| Residual risks approved by | | If any high risk remains, consult the ICO before going ahead |
| Data protection adviser's advice | | |
| Review date | | |
