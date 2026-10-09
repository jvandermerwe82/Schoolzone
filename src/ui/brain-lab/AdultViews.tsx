import { useState } from 'react';
import { withheldTeacherCard, type ParentCard, type TeacherCard } from '../../brain-view/audience';
import { Card, num, pct, Row } from './parts';

function Parent({ card }: { card: ParentCard }) {
  return (
    <article className="bl-adult" aria-label="Parent summary">
      <h4>{card.headline}</h4>
      <p>{card.thisWeek}</p>
      <p className="bl-lead">{card.statusLine}</p>
      <p className="bl-note">{card.evidenceNote}</p>
      {card.howSchoolZoneHelped.length > 0 && (
        <>
          <h5>How SchoolZone helped</h5>
          <ul>{card.howSchoolZoneHelped.map((line) => <li key={line}>{line}</li>)}</ul>
        </>
      )}
      {card.watchFor.length > 0 && (
        <>
          <h5>Worth knowing</h5>
          <ul>{card.watchFor.map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.line}</li>)}</ul>
        </>
      )}
      {card.tryAtHome.length > 0 && (
        <>
          <h5>You could try at home</h5>
          <ul>{card.tryAtHome.map((line) => <li key={line}>{line}</li>)}</ul>
        </>
      )}
      {card.whatSeemsToHelp.length > 0 && (
        <>
          <h5>What seems to help</h5>
          <ul>{card.whatSeemsToHelp.map((line) => <li key={line}>{line}</li>)}</ul>
        </>
      )}
      <p className="bl-small">{card.footer}</p>
    </article>
  );
}

function Teacher({ card }: { card: TeacherCard }) {
  if (!card.visible || !card.objective) {
    return (
      <article className="bl-adult" aria-label="Teacher summary">
        <p className="bl-lead">Nothing to show</p>
        <p>{card.withheldReason}</p>
        <p className="bl-small">{card.footer}</p>
      </article>
    );
  }
  const o = card.objective;
  return (
    <article className="bl-adult" aria-label="Teacher summary">
      <h4>{o.title}</h4>
      <p className="bl-muted">{o.code ? `Australian Curriculum v9 ${o.code}` : ''}</p>
      <dl className="bl-dl">
        <Row k="Evidence status"><strong>{o.statusLabel}</strong></Row>
        <Row k="Direct evidence">{o.directEvidence} answers: {o.independentDirect} with no help, {o.assistedDirect} with help</Row>
        <Row k="Weighted success">{pct(o.weightedSuccess)} (confidence {num(o.confidence)})</Row>
        <Row k="This week">{card.answeredThisWeek} questions</Row>
        <Row k="Stuck now">{card.stuckNow ? `${card.stuckNow.skill}, level ${card.stuckNow.level}` : 'No'}</Row>
      </dl>
      {o.caveat && <p className="bl-warn" role="note">{o.caveat}</p>}
      {card.patterns.length > 0 && (<><h5>Mistake patterns</h5><ul>{card.patterns.map((p) => <li key={p.name}>{p.name} (seen {p.seen} times)</li>)}</ul></>)}
      {card.possibleSlips.length > 0 && (<><h5>Possible slips (not yet a pattern)</h5><ul>{card.possibleSlips.map((p) => <li key={p.name}>{p.name} (seen {p.seen} {p.seen === 1 ? 'time' : 'times'})</li>)}</ul></>)}
      {card.supportNotes.length > 0 && (<><h5>Support notes</h5><ul>{card.supportNotes.map((line) => <li key={line}>{line}</li>)}</ul></>)}
      <p className="bl-small">{card.footer}</p>
    </article>
  );
}

export function AdultViews({ parent, teacher }: { parent: ParentCard; teacher: TeacherCard }) {
  const [shared, setShared] = useState(true);
  return (
    <Card title="What adults would see" source="live-engine-synthetic" id="adults" wide>
      <p className="bl-note">
        Both summaries come from the same engine state as the trace. Neither shows a name, an individual answer or a chat.
        A teacher sees a pupil only when a parent has switched on sharing.
      </p>
      <div className="bl-adults">
        <div>
          <h4 className="bl-col-title">Parent</h4>
          <Parent card={parent} />
        </div>
        <div>
          <div className="bl-col-head">
            <h4 className="bl-col-title">Teacher</h4>
            <label className="bl-switch">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              <span>Parent has shared progress</span>
            </label>
          </div>
          <Teacher card={shared ? teacher : withheldTeacherCard()} />
        </div>
      </div>
    </Card>
  );
}
