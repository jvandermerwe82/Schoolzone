/**
 * Read-aloud using the browser's built-in speech.
 *
 * Privacy: only voices the browser marks as local (`localService`) are used,
 * so the text never goes to an online speech service. If a device has no
 * local English voice, read-aloud is simply not offered.
 */
import { useEffect, useState } from 'react';

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/** The best on-device English voice: British first. */
export function pickVoice(voices: Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'default'>[]) {
  const local = voices.filter((v) => v.localService && v.lang.toLowerCase().startsWith('en'));
  return local.find((v) => v.lang.toLowerCase() === 'en-gb')
    ?? local.find((v) => v.default)
    ?? local[0]
    ?? null;
}

/** Turn maths symbols and blanks into words a speech voice reads naturally. */
export function speakable(text: string): string {
  return text
    .replace(/(\d),(\d{3})/g, '$1$2') // 12,500 → 12500 (voices read the comma as a pause)
    .replace(/_{2,}/g, ' blank ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/(^|\s)[−-](?=\d)/g, '$1minus ') // −7 (a negative number)
    .replace(/\s[−-]\s/g, ' minus ')
    .replace(/\s\+\s/g, ' plus ')
    .replace(/=\s*\?/g, ' equals what?')
    .replace(/\s=\s/g, ' equals ')
    .replace(/°C/g, ' degrees Celsius')
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/(\d)\/(\d)/g, '$1 over $2')
    .replace(/²/g, ' squared')
    .replace(/³/g, ' cubed')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Read-aloud for components: `available` is false when there's no on-device voice. */
export function useSpeech() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const load = () => setVoice(pickVoice(s.getVoices()) as SpeechSynthesisVoice | null);
    load();
    s.addEventListener('voiceschanged', load);
    return () => { s.removeEventListener('voiceschanged', load); s.cancel(); };
  }, []);
  return {
    available: !!voice,
    speak: (text: string, rate = 0.95) => {
      const s = synth();
      if (!s || !voice) return;
      s.cancel();
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      s.speak(u);
    },
    stop: () => synth()?.cancel(),
  };
}
