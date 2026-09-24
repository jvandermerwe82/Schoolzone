/**
 * First-line safety screening for the AI tutor, following Anthropic's
 * guidelines for organisations serving minors (content moderation,
 * monitoring and reporting).
 *
 * This is a simple word-and-phrase screen, deliberately cautious: it may flag
 * harmless messages, and it will miss some worrying ones. It is a first
 * layer, not a replacement for proper moderation and human review, which a
 * pilot should add before running at scale.
 */

export type SafetyCategory = 'wellbeing' | 'sexual' | 'contact' | 'violence';

const PATTERNS: [SafetyCategory, RegExp][] = [
  // Feeling unsafe, being hurt, or thoughts of self-harm.
  ['wellbeing', /\b(kill (myself|me)|want to die|wanna die|suicid\w*|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|end my life|nobody (loves|cares about) me)\b/i],
  ['wellbeing', /\b(being (hit|hurt|abused|bullied)|(hits|hurts|touches|touched|abuses) me|i'?m (scared|frightened) (of|at) home|not safe at home)\b/i],
  // Secrecy is a warning sign of grooming, whether a child reports it or an adult writes it.
  ['wellbeing', /\b((don'?t|do not|never) tell (your |my )?(mum|mom|dad|parents?|carers?|anyone|anybody|teachers?)|(our|a) (little )?secret|keep (this|it) (a )?secret|told me not to tell)\b/i],
  ['sexual', /\b(sex|sexy|nude|nudes|naked|porn\w*)\b/i],
  // Attempts to arrange contact or move the conversation elsewhere.
  ['contact', /\b(meet (up|me|you)|where do you live|your address|my address is|add me on|snapchat|whatsapp|instagram|tiktok|discord|send (me )?(a )?(pic|photo|picture))\b/i],
  ['violence', /\b(gun|knife|stab|shoot|bomb)s?\b/i],
];

export function screen(text: string): SafetyCategory | null {
  for (const [category, re] of PATTERNS) if (re.test(text)) return category;
  return null;
}

/** Kind, fixed replies. Nothing flagged is sent to the AI model. */
export const SAFE_REPLY: Record<SafetyCategory, string> = {
  wellbeing:
    'Thank you for telling me. This is really important, and a real person should help you with it. Please talk to a grown-up you trust, like a parent, carer or teacher, today. You can also call Childline free on 0800 1111, any time, day or night.',
  sexual: "I can only help with your practice question. If something online has made you uncomfortable, please tell a grown-up you trust. You can also call Childline free on 0800 1111.",
  contact: "I'm an AI tutor, so I can't meet up or chat on other apps, and it's best never to share where you live or your accounts online. Let's get back to your question!",
  violence: "I can only help with your practice question. If something is worrying you, please talk to a grown-up you trust, or call Childline free on 0800 1111.",
};
