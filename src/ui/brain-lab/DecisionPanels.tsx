import type { DecisionView, TraceStepView } from '../../brain-view/views';
import { Card, Meter, pct, Row } from './parts';

export function DecisionCard({ decision }: { decision: DecisionView }) {
  return (
    <Card title="What the Brain decided" source="live-engine-synthetic" id="decision">
      <p className="bl-lead">{decision.reasonLabel}: <strong>{decision.skillName}</strong>, level {decision.level}</p>
      <blockquote className="bl-quote" aria-label="What the learner is told">{decision.learnerMessage || 'No message. The planner chose quietly.'}</blockquote>
      <dl className="bl-dl">
        {decision.strategyLabel && <Row k="Way of helping">{decision.strategyLabel}</Row>}
        <Row k="Predicted success">{pct(decision.predictedSuccess)}{decision.targetSuccess !== null && ` (aim ${pct(decision.targetSuccess)})`}</Row>
        <Row k="Flags">
          {[decision.flags.diagnostic && 'early placement probe', decision.flags.workedExample && 'worked example first', decision.flags.showHint && 'hint on', decision.flags.resumed && 'resumed after a break']
            .filter(Boolean).join(', ') || 'none'}
        </Row>
      </dl>
      <h4>Every level, as the engine sees it</h4>
      <ul className="bl-levels">
        {decision.levelOptions.map((option) => (
          <li key={option.level} className={`${option.chosen ? 'chosen' : ''}${option.allowed ? '' : ' blocked'}`}>
            <span className="bl-level-name">Level {option.level}</span>
            <Meter
              value={option.predicted}
              label={`Level ${option.level}: predicted success ${pct(option.predicted)}`}
              tone={option.chosen ? 'blue' : 'grey'}
              marker={decision.targetSuccess}
            />
            <span className="bl-level-val">{pct(option.predicted)}</span>
            <span className="bl-level-tags">
              {option.chosen && <em>served</em>}
              {option.closestToTarget && <em>closest to aim</em>}
              {!option.allowed && <em>not allowed by route</em>}
            </span>
          </li>
        ))}
      </ul>
      <h4>Why</h4>
      <ul className="bl-why">{decision.why.map((line) => <li key={line}>{line}</li>)}</ul>
    </Card>
  );
}

export function AnswerCard({ step }: { step: TraceStepView }) {
  const { question, input, attempt } = step;
  return (
    <Card title="The question and the attempt" source="live-engine-synthetic" id="answer">
      <p className="bl-prompt">{question.prompt}</p>
      <dl className="bl-dl">
        <Row k="Synthetic learner answered"><code>{input.given}</code> <span className={`bl-result ${input.correct ? 'ok' : 'no'}`}>{input.correct ? 'correct' : 'not correct'}</span></Row>
        <Row k="Time taken">{(input.timeMs / 1000).toFixed(1)} s{step.result.rapid ? ' (counted as a rapid guess)' : ''}</Row>
        <Row k="Help in use">{input.helped || (step.decision.strategy && step.decision.strategy !== 'climb') ? 'Yes' : 'No'}</Row>
        <Row k="Kind of attempt"><strong>{attempt.label}</strong></Row>
        <Row k="Counts as independent?">{attempt.independent ? 'Yes' : 'No'}</Row>
      </dl>
      <p className="bl-note">{attempt.explanation}</p>
    </Card>
  );
}

export function ChangeCard({ step }: { step: TraceStepView }) {
  const { before, after } = step;
  const delta = (a: number, b: number, digits = 2) => {
    const d = b - a;
    return `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`;
  };
  return (
    <Card title="What changed in the learner model" source="live-engine-synthetic" id="change">
      <table className="bl-table">
        <thead><tr><th scope="col">Estimate</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>
        <tbody>
          <tr><th scope="row">Ability (logit)</th><td>{before.ability.toFixed(2)}</td><td>{after.ability.toFixed(2)}</td><td>{delta(before.ability, after.ability)}</td></tr>
          <tr><th scope="row">Probably learned</th><td>{pct(before.pKnown)}</td><td>{pct(after.pKnown)}</td><td>{delta(before.pKnown * 100, after.pKnown * 100, 0)} pts</td></tr>
          <tr><th scope="row">Attempts</th><td>{before.attempts}</td><td>{after.attempts}</td><td>+{after.attempts - before.attempts}</td></tr>
          <tr><th scope="row">Engine mastery</th><td>{before.engineMastered ? 'yes' : 'no'}</td><td>{after.engineMastered ? 'yes' : 'no'}</td><td></td></tr>
        </tbody>
      </table>
      <p className="bl-note">These are model estimates that steer practice. They are not curriculum evidence, and no AI output ever changes them.</p>
      <h4>Why they moved</h4>
      <dl className="bl-dl">
        {step.explain.map((row) => (
          <Row k={`${row.field}: ${row.raw}`} key={row.field}>{row.meaning}</Row>
        ))}
      </dl>
    </Card>
  );
}
