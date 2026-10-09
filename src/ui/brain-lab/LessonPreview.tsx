import { useMemo, useState } from 'react';
import { DELAYED_CHECK_MIN_GAP_MS } from '../../brain-view/evidence-mode';
import { lessonStatusFor } from '../../brain-view/lesson-status';
import type { Question } from '../../brain/types';
import { fractionBarsFor } from '../../content/fraction-bars';
import type { TraceStepView } from '../../brain-view/views';
import { FractionBars } from '../FractionBars';
import { LessonStatus } from '../LessonStatus';
import { Card } from './parts';

/** What the child saw for this step: the same components the real lesson uses. */
export function LessonPreview({ step }: { step: TraceStepView }) {
  const [mode, setMode] = useState<'hint' | 'worked'>('hint');
  // Only what the visuals need. The real answer is deliberately not carried here.
  const question: Question = useMemo(() => ({
    id: step.question.id,
    skillId: step.question.skillId,
    level: step.question.level,
    prompt: step.question.prompt,
    answer: '',
    explanation: '',
  }), [step.question]);
  const status = lessonStatusFor({
    plan: { reason: step.decision.reason, strategy: step.decision.strategy ?? undefined },
    helped: step.input.helped,
    msSincePreviousAttempt: step.attempt.mode === 'independent-delayed-check' ? DELAYED_CHECK_MIN_GAP_MS : 1_000,
  });
  const drawable = fractionBarsFor(question) !== null;

  return (
    <Card title="Lesson preview: what the child sees" source="illustrative-demo" id="lesson" wide>
      <p className="bl-note">
        These are the real lesson components, shown here for the selected step. The frame is dark because the child app is dark.
        Interactions here do nothing to any learner.
      </p>
      <div className="bl-child-frame">
        <p className="bl-child-message">{step.decision.learnerMessage || 'No message for this question.'}</p>
        <LessonStatus status={status} result={{ correct: step.input.correct }} />
        <div className="bl-child-question">
          <p className="bl-child-prompt">{step.question.prompt}</p>
        </div>
        {drawable ? (
          <>
            <div className="bl-child-toggle" role="group" aria-label="Preview style">
              <button type="button" aria-pressed={mode === 'hint'} onClick={() => setMode('hint')}>Visual hint</button>
              <button type="button" aria-pressed={mode === 'worked'} onClick={() => setMode('worked')}>Worked example</button>
            </div>
            <FractionBars key={`${step.question.id}-${mode}`} question={question} mode={mode} />
            {mode === 'hint' && <p className="bl-child-note">In hint mode the bars never show the total, so the answer is still the child’s to find.</p>}
          </>
        ) : (
          <p className="bl-child-note">This question has no exact bar picture, so the child sees the existing static guide instead.</p>
        )}
      </div>
    </Card>
  );
}
