import { useRef, useState } from 'react';
import { isMastered } from '../brain/model';
import { planNext, recordAnswer, skillState, type Plan } from '../brain/tutor';
import type { Profile, Question, SubjectId } from '../brain/types';
import { checkAnswer, makeQuestion } from '../content';
import { getSkill, skillsFor } from '../content/skills';

const SESSION_LENGTH = 10;

interface Props {
  profile: Profile;
  subject: SubjectId;
  onUpdate: (p: Profile) => void;
  onExit: () => void;
}

interface Turn {
  plan: Plan;
  question: Question;
  shownAt: number;
}

function nextTurn(profile: Profile, subject: SubjectId, focus: string | null, answered: number): Turn {
  const plan = planNext(profile, subject, { focus, answered }, Date.now());
  return { plan, question: makeQuestion(plan.skillId, plan.level, profile.recentQuestionIds, Math.random), shownAt: Date.now() };
}

export function Practice({ profile, subject, onUpdate, onExit }: Props) {
  const masteredAtStart = useRef(
    new Set(skillsFor(subject).filter((s) => isMastered(skillState(profile, s.id))).map((s) => s.id)),
  );
  const [turn, setTurn] = useState<Turn>(() => nextTurn(profile, subject, null, 0));
  const [answered, setAnswered] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; given: string } | null>(null);

  const { plan, question } = turn;
  const skill = getSkill(question.skillId);

  function submit(given: string) {
    if (feedback || !given.trim()) return;
    const correct = checkAnswer(question, given);
    const { profile: updated } = recordAnswer(profile, question, correct, Date.now() - turn.shownAt, Date.now());
    onUpdate(updated);
    setFeedback({ correct, given });
    setAnswered((n) => n + 1);
    if (correct) setScore((n) => n + 1);
  }

  function next() {
    setFeedback(null);
    setInput('');
    setTurn(nextTurn(profile, subject, question.skillId, answered));
  }

  if (answered >= SESSION_LENGTH && !feedback) {
    const newlyMastered = skillsFor(subject).filter(
      (s) => isMastered(skillState(profile, s.id)) && !masteredAtStart.current.has(s.id),
    );
    return (
      <main className="page">
        <div className="card center">
          <h2>Session complete! 🎉</h2>
          <p className="big">{score} / {SESSION_LENGTH} correct</p>
          {newlyMastered.length > 0 && (
            <p>🏆 You mastered: <strong>{newlyMastered.map((s) => s.name).join(', ')}</strong></p>
          )}
          <p>The brain has updated what it knows about you, so the next session starts at the right level.</p>
          <div className="row center">
            <button className="primary" onClick={() => { setAnswered(0); setScore(0); setTurn(nextTurn(profile, subject, null, 0)); }}>
              Keep going
            </button>
            <button onClick={onExit}>Done</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <button className="link" onClick={onExit}>← Back</button>
        <span className="progress-text">Question {Math.min(answered + (feedback ? 0 : 1), SESSION_LENGTH)} of {SESSION_LENGTH}</span>
      </header>
      <div className="progress"><div style={{ width: `${(answered / SESSION_LENGTH) * 100}%` }} /></div>

      {plan.message && !feedback && <p className={`banner ${plan.reason}`}>{plan.message}</p>}

      <div className="card question-card">
        <div className="question-meta">
          <span>{skill.emoji} {skill.name}</span>
          <span className="stars" aria-label={`Level ${question.level} of 5`}>
            {'★'.repeat(question.level)}{'☆'.repeat(5 - question.level)}
          </span>
        </div>
        <p className="prompt">{question.prompt}</p>

        {question.choices ? (
          <div className="choices">
            {question.choices.map((c) => {
              let cls = 'choice';
              if (feedback && c === question.answer) cls += ' right';
              else if (feedback && c === feedback.given) cls += ' wrong';
              return (
                <button key={c} className={cls} disabled={!!feedback} onClick={() => submit(c)}>{c}</button>
              );
            })}
          </div>
        ) : (
          <form className="answer-row" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode={question.skillId === 'fractions' && question.level === 5 ? 'text' : 'numeric'}
              autoFocus
              disabled={!!feedback}
              aria-label="Your answer"
            />
            <button type="submit" className="primary" disabled={!!feedback || !input.trim()}>Check</button>
          </form>
        )}

        {feedback && (
          <div className={`feedback ${feedback.correct ? 'good' : 'bad'}`}>
            <p className="feedback-title">{feedback.correct ? '✅ Correct!' : `❌ Not quite. The answer is ${question.answer}.`}</p>
            <p>{question.explanation}</p>
            <button className="primary" onClick={next} autoFocus>
              {answered >= SESSION_LENGTH ? 'See results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
