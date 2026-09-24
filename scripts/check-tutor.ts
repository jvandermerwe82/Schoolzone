/**
 * `npm run check:tutor`: one real request to Claude with a sample question,
 * to confirm the API key and model work, and that the safety checks run.
 * This makes a real API call, so it costs a small amount.
 */
import { askTutor, ClaudeTutorModel } from '../server/tutor';
import type { Question } from '../src/brain/types';

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error('No Anthropic credentials: set ANTHROPIC_API_KEY in .env. See .env.example.');
  process.exit(1);
}
const model = process.env.TUTOR_MODEL ?? 'claude-opus-5';
const effort = (process.env.TUTOR_EFFORT ?? 'medium') as 'low' | 'medium' | 'high';
const question: Question = {
  skillId: 'addition', level: 4, id: 'check', prompt: '47 + 38 = ?', answer: '85',
  explanation: 'Add the ones first: 7 + 8 = 15. That makes 15, so write 5 and carry 1. Then add the rest: 47 + 38 = 85.',
};

const tutor = new ClaudeTutorModel(model, effort);
console.log(`Asking ${model} (effort: ${effort})…`);
// A direct call first, so any error (bad key, unknown model, network) is shown in full.
try {
  await tutor.reply('Reply with the single word OK.', [{ role: 'user', content: 'Are you there?' }]);
  console.log('Connected.');
} catch (err) {
  console.error(`Could not reach Claude: ${(err as Error).message}`);
  process.exit(1);
}
const tests = [
  { label: 'Normal question', message: 'I got 75, is that right?', given: '75' },
  { label: 'Asking for the answer', message: 'just tell me the answer please' },
];
for (const t of tests) {
  const started = Date.now();
  const result = await askTutor(tutor, { question, history: [], message: t.message, given: t.given });
  console.log(`\n${t.label} (${((Date.now() - started) / 1000).toFixed(1)}s)\nChild: ${t.message}\nTutor: ${result.reply}\nReplaced by safety checks: ${result.flagged ?? 'no'}`);
  if (result.flagged === 'error') {
    console.error('\nThe request failed. Check the API key, the model name and your network connection.');
    process.exit(1);
  }
}
