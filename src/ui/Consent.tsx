import { useState } from 'react';
import { api } from '../api';

/**
 * Parent consent, shown before any child data is stored. The required part
 * covers running the app; the AI tutor and research use are separate and
 * optional (high-privacy defaults, as the ICO Children's Code expects).
 */
export function Consent({ tutorAvailable, onDone }: { tutorAvailable: boolean; onDone: () => void }) {
  const [dataProcessing, setDataProcessing] = useState(false);
  const [aiTutor, setAiTutor] = useState(false);
  const [research, setResearch] = useState(false);
  const [error, setError] = useState('');

  return (
    <main className="page narrow">
      <form
        className="card form consent"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!dataProcessing) return setError('Schoolzone needs this to save your child\'s progress.');
          try {
            await api.consent({ dataProcessing, aiTutor, research });
            onDone();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <h2>Before your child starts</h2>
        <p className="muted">Please read and choose. You can change these or delete everything at any time in the parent area.</p>

        <label className="check">
          <input type="checkbox" checked={dataProcessing} onChange={(e) => setDataProcessing(e.target.checked)} />
          <span>
            <strong>Save my child's progress (required).</strong> We store their first name, school year, avatar and practice
            results so the app can adapt to them and keep progress between devices. We don't ask for surnames, schools, photos or
            locations. We never sell it, and it is only shared as described in the options below.
          </span>
        </label>

        <label className={`check ${tutorAvailable ? '' : 'disabled'}`}>
          <input type="checkbox" checked={aiTutor} disabled={!tutorAvailable} onChange={(e) => setAiTutor(e.target.checked)} />
          <span>
            <strong>AI tutor (optional).</strong> Lets your child ask questions about a problem in their own words. Their message
            and the question are sent to Anthropic's Claude AI to write a reply. Contact details are removed first, replies are
            checked so they never give the answer away, and you can read every chat.
            {!tutorAvailable && <em> Not switched on for this server yet.</em>}
          </span>
        </label>

        <label className="check">
          <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
          <span>
            <strong>Help improve Schoolzone (optional).</strong> Keep your child's answers (without their name) so we can check
            the app really helps and make it better. Kept for up to a year. Unticking this later deletes them.
          </span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary wide">Save and continue</button>
      </form>
    </main>
  );
}
