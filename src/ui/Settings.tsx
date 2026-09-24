import type { AccessSettings, Profile } from '../brain/types';
import { useSpeech } from '../speech';

const OPTIONS: { key: keyof AccessSettings; title: string; about: string }[] = [
  { key: 'autoRead', title: '🔊 Read questions aloud', about: 'Each question is read out when it appears. You can always tap 🔊 to hear it again.' },
  { key: 'easyRead', title: '📖 Easier-to-read text', about: 'More space between letters, words and lines. Helpful if words seem to jump around.' },
  { key: 'bigText', title: '🔠 Bigger text', about: 'Makes everything larger.' },
  { key: 'calm', title: '🌙 Calm mode', about: 'Turns off animations and pop-up effects.' },
];

/** The child's own display and sound settings. */
export function Settings({ profile, onSave, onBack }: { profile: Profile; onSave: (p: Profile) => void; onBack: () => void }) {
  const speech = useSpeech();
  const s = profile.settings;
  return (
    <main className="page narrow">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who"><span className="avatar small">{profile.avatar}</span> Settings</span>
      </header>
      <section className="card settings-list">
        <h2>⚙️ Make Schoolzone work for you</h2>
        {OPTIONS.map((o) => {
          const unavailable = o.key === 'autoRead' && !speech.available;
          return (
            <label key={o.key} className="check">
              <input
                type="checkbox"
                checked={s[o.key] && !unavailable}
                disabled={unavailable}
                onChange={(e) => onSave({ ...profile, settings: { ...s, [o.key]: e.target.checked } })}
              />
              <span>
                <strong>{o.title}</strong><br />
                <small className="muted">{unavailable ? 'This device has no built-in voice, so read-aloud isn\'t available here.' : o.about}</small>
              </span>
            </label>
          );
        })}
        {speech.available && (
          <button type="button" onClick={() => speech.speak('Hi! This is how questions will sound.')}>🔊 Try the voice</button>
        )}
        <p className="muted small">Read-aloud uses a voice built into this device, so nothing you read is sent anywhere.</p>
      </section>
    </main>
  );
}
