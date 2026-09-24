import { useState } from 'react';
import { getPassage } from '../content/reading';
import { SpeakButton } from './SpeakButton';

/** The text a reading question is about. Scrolls inside itself so the question stays in view. */
export function PassageCard({ passageId }: { passageId: string }) {
  const passage = getPassage(passageId);
  const [open, setOpen] = useState(true);
  if (!passage) return null;
  return (
    <section className="card passage-card" aria-label={`Text: ${passage.title}`}>
      <div className="passage-head">
        <div>
          <p className="eyebrow">{passage.kind}</p>
          <h2>{passage.title}</h2>
        </div>
        <div className="row">
          <SpeakButton text={`${passage.title}. ${passage.text}`} label="Read the text aloud" />
          <button type="button" className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide text' : 'Show text'}</button>
        </div>
      </div>
      {open && (
        <div className={`passage ${passage.kind === 'Poem' ? 'poem' : ''}`} tabIndex={0}>
          {passage.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
        </div>
      )}
    </section>
  );
}
