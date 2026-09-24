import { useSpeech } from '../speech';

/** 🔊 Reads text aloud with an on-device voice. Hidden if the device has none. */
export function SpeakButton({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const speech = useSpeech();
  if (!speech.available) return null;
  return (
    <button type="button" className="speak" aria-label={label} title={label} onClick={() => speech.speak(text)}>🔊</button>
  );
}

/** What to read for a question: the prompt, then the choices. */
export const questionSpeech = (prompt: string, choices?: string[]) =>
  choices?.length ? `${prompt}. Is it: ${choices.join('; or ')}?` : prompt;
