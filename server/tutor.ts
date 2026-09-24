/**
 * AI tutor: a conversation about the current question, powered by Claude.
 *
 * "The AI talks, the code checks." Safeguards, in order:
 * 1. The child's message is trimmed, length-limited, and scrubbed of
 *    contact details before it leaves the server.
 * 2. The system prompt tells the model to guide with questions and never
 *    give the final answer (tutors that hand out answers can harm learning:
 *    Bastani et al., PNAS 2025).
 * 3. Every reply is checked by code: if it contains the answer, or any
 *    written sum ("7 + 8 = 16") that is wrong, it is retried once and then
 *    replaced with a safe, pre-written hint.
 * 4. Refusals and API errors fall back to that safe hint too.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Question } from '../src/brain/types';
import { revealsAnswer, stepHint } from '../src/content/solver';
import { skillTip } from '../src/content/hints';
import { SAFE_REPLY, screen, type SafetyCategory } from './safety';

export interface TutorTurn { role: 'user' | 'assistant'; content: string }

export interface TutorModel {
  reply(system: string, messages: TutorTurn[]): Promise<{ text: string; refused: boolean }>;
}

export interface TutorRequest {
  question: Question;
  /** The child's answer, if they've given one. */
  given?: string;
  /** Plain-language description of the diagnosed mistake, if any. */
  misconception?: string;
  /** Earlier turns in this conversation. */
  history: TutorTurn[];
  message: string;
}

export interface TutorResult {
  reply: string;
  /** Why the model's own reply was replaced, if it was. */
  flagged: 'answer-leak' | 'wrong-maths' | 'refused' | 'error' | `safety:${SafetyCategory}` | null;
}

const MAX_MESSAGE = 400;

/** Remove things a child shouldn't share: emails, phone numbers, web links. */
export function scrub(message: string): string {
  return message
    .slice(0, MAX_MESSAGE)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link removed]')
    .replace(/(\+?\d[\d\s-]{8,}\d)/g, '[number removed]')
    .trim();
}

/** Find written sums like "7 + 8 = 15" or "12 × 3 = 36" and check each one. Returns the first wrong one. */
export function findWrongSum(text: string): string | null {
  const re = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷/])\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/g;
  for (const m of text.matchAll(re)) {
    const [a, op, b, c] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])];
    const v = op === '+' ? a + b : op === '-' || op === '−' ? a - b : op === '×' || op === 'x' || op === '*' ? a * b : a / b;
    if (Math.abs(v - c) > 1e-9) return m[0];
  }
  return null;
}

export const SYSTEM_PROMPT = `You are Schoolzone's AI tutor, helping a Year 6 pupil (age 10-11) in England with one practice question. If asked, say clearly that you are an AI, not a person.

How you teach:
- Guide the pupil to work it out themselves. Ask one short, helpful question at a time, or give one small next step.
- Never state the final answer, and never confirm or deny a specific guess by repeating the answer. If they ask for the answer, encourage them to try the next step instead.
- If they have made a mistake, help them see why, kindly and specifically.
- Keep replies short: at most 3 short sentences. Use British English and words a 10-year-old knows.
- Be warm but not babyish: no baby talk, and only occasional emoji.
- If you write a calculation, make sure it is exactly correct.

Staying safe:
- Only talk about this question and the topic it covers. If they ask about something else, say you can only help with this question.
- Never ask for personal information (full name, address, school, phone, passwords, photos). If they share some, don't repeat it, and remind them not to share personal details online.
- If they say anything suggesting they are unsafe, upset or being hurt, reply kindly that they should talk to a trusted adult, such as a parent, carer or teacher, straight away, and don't continue the maths in that reply.
- Don't include links. Don't make things up; if you're not sure, say so.`;

/** The question details the tutor sees (the pupil never sees this). */
export function contextFor(req: TutorRequest): string {
  const q = req.question;
  return [
    'Question details (for you only; do not reveal the answer):',
    `Question: ${q.prompt}`,
    q.choices ? `Options: ${q.choices.join(' | ')}` : null,
    `Correct answer: ${q.answer}`,
    `Worked explanation: ${q.explanation}`,
    req.given ? `The pupil answered: ${req.given}` : 'The pupil has not answered yet.',
    req.misconception ? `Likely mistake: ${req.misconception}` : null,
  ].filter(Boolean).join('\n');
}

/** A pre-written reply that is always safe to show. */
export function safeFallback(q: Question): string {
  const step = stepHint(q);
  return step ? `Let's take it step by step. ${step} What comes next?` : `Here's a tip: ${skillTip(q.skillId)} What could you try first?`;
}

function check(text: string, q: Question): TutorResult['flagged'] {
  if (revealsAnswer(text, q.answer)) return 'answer-leak';
  if (findWrongSum(text)) return 'wrong-maths';
  return null;
}

export async function askTutor(model: TutorModel, req: TutorRequest): Promise<TutorResult> {
  // Worrying messages never reach the AI: the child gets a fixed, kind reply
  // pointing to a trusted adult, and the chat is flagged for the parent.
  const concern = screen(req.message);
  if (concern) return { reply: SAFE_REPLY[concern], flagged: `safety:${concern}` };
  const message = scrub(req.message);
  const messages: TutorTurn[] = [
    { role: 'user', content: contextFor(req) },
    { role: 'assistant', content: 'Understood. I will guide the pupil without giving the answer.' },
    ...req.history.slice(-10),
    { role: 'user', content: message || '(no message)' },
  ];
  try {
    let out = await model.reply(SYSTEM_PROMPT, messages);
    if (out.refused) return { reply: safeFallback(req.question), flagged: 'refused' };
    const outConcern = screen(out.text);
    if (outConcern) return { reply: safeFallback(req.question), flagged: `safety:${outConcern}` };
    let problem = check(out.text, req.question);
    if (problem) {
      // One retry with a firm reminder, then the safe fallback.
      out = await model.reply(SYSTEM_PROMPT, [
        ...messages,
        { role: 'assistant', content: out.text },
        { role: 'user', content: '(Note from the app, not the pupil: your last reply either gave away the answer or contained a calculation that was not exactly correct. Please give a shorter hint without the answer, and double-check any sums.)' },
      ]);
      problem = out.refused ? 'refused' : check(out.text, req.question);
      if (problem) return { reply: safeFallback(req.question), flagged: problem };
    }
    return { reply: out.text.trim(), flagged: null };
  } catch {
    return { reply: safeFallback(req.question), flagged: 'error' };
  }
}

/** Claude, via the official SDK. Model and effort come from settings. */
export class ClaudeTutorModel implements TutorModel {
  private client: Anthropic;
  constructor(private model: string, private effort: 'low' | 'medium' | 'high') {
    this.client = new Anthropic();
  }

  async reply(system: string, messages: TutorTurn[]): Promise<{ text: string; refused: boolean }> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 4000,
      // Server-side fallback: if a safety classifier declines, the API retries
      // on Anthropic's recommended model instead of returning a refusal.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: this.effort },
      // The system prompt never changes, so it is cached across requests.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    if (response.stop_reason === 'refusal') return { text: '', refused: true };
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    return { text, refused: false };
  }
}
