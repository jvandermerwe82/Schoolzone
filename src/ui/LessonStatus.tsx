import { afterAnswerLine, type LessonStatusView } from '../brain-view/lesson-status';
import './lesson-status.css';

interface Props {
  status: LessonStatusView;
  /** Set once the answer is in, to show the calm after-answer line. */
  result?: { correct: boolean } | null;
}

/**
 * Tells the child, in plain words, what kind of attempt this is and how
 * SchoolZone is helping. Presentational: every value comes from the engine's
 * own plan and help episode through lessonStatusFor().
 */
export function LessonStatus({ status, result = null }: Props) {
  const { mode, helpLine, ribbon } = status;
  return (
    <section className="lesson-status" aria-label="How SchoolZone is helping">
      <div className="ls-top">
        <span className={`ls-chip ${mode.mode}`}>{mode.childLabel}</span>
        {helpLine && <span className="ls-help">{helpLine}</span>}
      </div>
      {ribbon && (
        <ol className="ls-ribbon" aria-label="Where you are">
          {ribbon.map((step) => (
            <li key={step.label} className={step.state} aria-current={step.state === 'now' ? 'step' : undefined}>
              <span className="ls-dot" aria-hidden="true" />
              {step.label}
            </li>
          ))}
        </ol>
      )}
      {result && <p className="ls-after" role="status">{afterAnswerLine(mode, result.correct)}</p>}
    </section>
  );
}
