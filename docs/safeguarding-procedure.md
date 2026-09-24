# Handling flagged AI tutor chats (DRAFT procedure)

> **Draft.** Fill in the names and times, and ideally review with someone who has safeguarding training (for example a school's designated safeguarding lead). This procedure is for the people running Schoolzone; parents are told directly by the app.

## What the app does automatically

When a child's message to the AI tutor matches the safety screen (wellbeing/self-harm, being hurt, sexual content, arranging contact, violence):

1. The message is **not** sent to the AI.
2. The child sees a kind message suggesting they talk to a trusted adult, with **Childline: 0800 1111**.
3. The message is saved and marked as flagged.
4. The **parent is emailed straight away** (at most once an hour per child) and sees a warning in the parent area.

The screen is a simple word-and-phrase check. It will flag some harmless messages and **miss some worrying ones**. It is not a substitute for a trusted adult.

## Who does what **[TO COMPLETE]**

| Role | Name | Contact |
| --- | --- | --- |
| Safeguarding lead (reviews flags) | | |
| Deputy (when the lead is away) | | |

## Checking flags

- **How often:** at least once every **[TO COMPLETE: e.g. working day]** during the pilot.
- **How:** the flagged chats are in the database table `tutor_messages` (`flagged` starts with `safety:`). **[TO COMPLETE: add a staff view if needed; today, parents see their own child's chats in the app.]**
- **Target response time** after a flag: **[TO COMPLETE: e.g. within 24 hours]**.

## What to do

1. **Read the message in context** (the chat before and after).
2. **If a child may be in immediate danger: call 999.**
3. If there is a concern but no immediate danger:
   - make sure the parent has seen the alert (the app emails them, but check it arrived);
   - if the concern involves the child's home or the parent, **don't** contact the parent first: get advice from the local authority's children's services or the **NSPCC Helpline, 0808 800 5000** (check current opening hours on nspcc.org.uk);
   - if the child was using Schoolzone through a school, tell the school's designated safeguarding lead.
4. **Record** what you saw, what you did, when, and who you told. Keep the record secure.
5. **Don't** try to investigate yourself or promise the child confidentiality.

## False positives

Many flags will be harmless (for example a word used in a maths or science context). Note them, so the safety screen can be improved, but never switch the screen off to reduce them.

## Review

Review this procedure and the flagged-chat log at the end of the pilot, or after any serious incident.
