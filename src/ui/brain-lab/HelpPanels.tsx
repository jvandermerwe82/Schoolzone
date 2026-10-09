import type {
  HelpEpisodeView, MisconceptionView, RouteView, StrategyChoiceView, SupportView, TraceBreakView,
} from '../../brain-view/views';
import { Card, Meter, num, pct, Row } from './parts';

export function StrategyCard({ choice }: { choice: StrategyChoiceView }) {
  return (
    <Card title="Choosing a way of helping" source="live-engine-synthetic" id="strategy">
      <p className="bl-lead">Chosen: <strong>{choice.options.find((o) => o.chosen)?.label}</strong></p>
      <p className="bl-note">{choice.because}</p>
      <ul className="bl-options">
        {choice.options.map((option) => (
          <li key={option.strategy} className={`${option.chosen ? 'chosen' : ''}${option.tried ? ' tried' : ''}`}>
            <div className="bl-option-head">
              <span>{option.label}</span>
              <span>{option.chosen ? 'chosen' : option.tried ? 'already tried' : ''}</span>
            </div>
            <Meter value={option.score} label={`${option.label}: score ${num(option.score)}`} tone={option.chosen ? 'blue' : 'grey'} />
            <p className="bl-small">
              score {num(option.score)} = past success {num(option.baseScore)}
              {option.learnerPreference ? `, learner preference ${option.learnerPreference > 0 ? '+' : ''}${num(option.learnerPreference)}` : ''}
              {option.parentPreference ? `, parent preference ${option.parentPreference > 0 ? '+' : ''}${num(option.parentPreference)}` : ''}
              {option.observedApplied ? `, measured results ${option.observed > 0 ? '+' : ''}${num(option.observed)}` : ''}
            </p>
          </li>
        ))}
      </ul>
      <p className="bl-note">Past success leads. Preferences and measured results are small, capped nudges, and measured results only count once repeated.</p>
    </Card>
  );
}

export function EpisodeCard({ episode }: { episode: HelpEpisodeView | null }) {
  return (
    <Card title="Help episode" source="live-engine-synthetic" id="episode">
      {!episode ? (
        <p className="bl-note">No help episode is open. The learner is not stuck.</p>
      ) : (
        <>
          <p className="bl-lead">Stuck on <strong>{episode.skillName}</strong> at level {episode.stuckLevel}</p>
          <dl className="bl-dl">
            <Row k="Now">{episode.phaseLabel}</Row>
            <Row k="Already tried">{episode.tried.length ? episode.tried.join(', ') : 'nothing yet'}</Row>
            <Row k="Credited with helping">{episode.helpedBy ?? 'not yet'}</Row>
            <Row k="Answers in this episode">{episode.attempts}</Row>
          </dl>
          <p className="bl-note">{episode.endsWhen}</p>
        </>
      )}
    </Card>
  );
}

export function MisconceptionCard({ items }: { items: MisconceptionView[] }) {
  return (
    <Card title="Mistake patterns" source="live-engine-synthetic" id="mistakes">
      {items.length === 0 ? (
        <p className="bl-note">No known mistake has matched yet.</p>
      ) : (
        <ul className="bl-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="bl-option-head">
                <strong>{item.name}</strong>
                <span className={`bl-tag ${item.status}`}>{item.statusLabel}</span>
              </div>
              <Meter value={item.strength} label={`${item.name}: strength ${pct(item.strength)}`} tone={item.status === 'active-pattern' ? 'amber' : 'grey'} marker={0.5} />
              <p className="bl-small">{item.evidenceLabel} Strength {pct(item.strength)}; a pattern needs 50%.</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SupportCard({ support }: { support: SupportView }) {
  return (
    <Card title="Help that seems to work: said versus measured" source="live-engine-synthetic" id="support" wide>
      <p className="bl-note">{support.caution}</p>
      <table className="bl-table">
        <thead>
          <tr>
            <th scope="col">Way of helping</th>
            <th scope="col">Tried / helped</th>
            <th scope="col">Stated (learner / parent)</th>
            <th scope="col">Measured while in use</th>
            <th scope="col">Used to choose?</th>
          </tr>
        </thead>
        <tbody>
          {support.rows.map((row) => (
            <tr key={row.strategy}>
              <th scope="row">{row.label}</th>
              <td>{row.tried} / {row.helped}{row.helpedRate !== null ? ` (${pct(row.helpedRate)})` : ''}</td>
              <td>{row.stated.learner ?? 'no view'} / {row.stated.parent ?? 'no view'}</td>
              <td>{row.observed.strengthLabel}{row.observed.evidenceCount > 0 ? ` (${row.observed.evidenceCount} results, ${row.observed.score >= 0 ? 'favourable' : 'unfavourable'})` : ''}</td>
              <td>{row.observed.usedInRouting ? 'yes, capped' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function RouteCard({ route }: { route: RouteView }) {
  return (
    <Card title="Teacher intent and the route taken" source="live-engine-synthetic" id="route">
      <p className="bl-lead">{route.learnerLine}</p>
      <ol className="bl-steps">
        {route.steps.map((step) => (
          <li key={step.title} className={`${step.state} ${step.kind}`} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span>{step.title}</span>
            <small>{step.kind === 'foundation' ? 'foundation' : step.kind === 'target' ? 'goal' : 'independent check'}</small>
          </li>
        ))}
      </ol>
      <dl className="bl-dl">
        <Row k="Practice skill">{route.practiceSkillId}{route.practiceLevels ? `, levels ${route.practiceLevels.join(', ')} only` : ''}</Row>
        <Row k="Route type">{route.reason === 'prerequisite' ? 'Strengthening a foundation first' : 'Straight to the goal'}</Row>
        <Row k="Evidence strength">{route.evidenceStrength}</Row>
      </dl>
    </Card>
  );
}

export function BreakCard({ entry }: { entry: TraceBreakView }) {
  return (
    <Card title="Between sessions" source="live-engine-synthetic" id="break" wide>
      <p className="bl-lead">{entry.label}</p>
      <p className="bl-note">
        {entry.episodeOpen
          ? 'A help episode was open. The engine keeps it, and when the learner comes back it resumes with the same kind of help.'
          : 'No help episode was open, so nothing needs resuming.'}
      </p>
      {entry.resumed && (
        <div className="bl-resumed">
          <h4>What the engine plans on return</h4>
          <p>{entry.resumed.reasonLabel}: {entry.resumed.skillName}, level {entry.resumed.level}, {entry.resumed.strategyLabel}</p>
          <blockquote className="bl-quote">{entry.resumed.learnerMessage}</blockquote>
        </div>
      )}
    </Card>
  );
}
