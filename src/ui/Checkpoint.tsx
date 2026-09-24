import { useMemo, useState } from 'react';
import type { CheckpointResult, Profile, SubjectId } from '../brain/types';
import { checkAnswer } from '../content';
import { checkpointQuestions, score, type Form } from '../content/checkpoint';
import { getSkill, SUBJECTS } from '../content/skills';

export const CHECKPOINT_XP = 50;

const KEYBOARD: Record<string, 'text' | 'decimal'> = {
  'negative-numbers': 'text', 'fractions-y6': 'text', 'decimals-percentages': 'decimal',
};

interface Props {
  profile: Profile;
  subject: SubjectId;
  form: Form;
  which: 'first' | 'second';
  onFinish: (p: Profile) => void;
  onLater: () => void;
}

/**
 * A fixed checkpoint test: no hints and no marking until the end, so it
 * measures what the child can do on their own. It doesn't change the
 * adaptive brain; the result is stored separately.
 */
export function Checkpoint({ profile, subject, form, which, onFinish, onLater }: Props) {
  const questions = useMemo(() => checkpointQuestions(subject, form), [subject, form]);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const [shownAt, setShownAt] = useState(Date.now());
  const [answers, setAnswers] = useState<CheckpointResult['answers']>([]);
  const [result, setResult] = useState<CheckpointResult | null>(null);
  const name = SUBJECTS.find((s) => s.id === subject)!.name;

  if (!started) {
    return (
      <main className="page narrow">
        <div className="card center">
          <p className="eyebrow">{which === 'first' ? 'Starting checkpoint' : 'Progress checkpoint'}</p>
          <h2>{name}: {questions.length} questions</h2>
          <p>
            {which === 'first'
              ? 'Before your first mission, a quick checkpoint shows where you\'re starting from.'
              : 'You\'ve been practising for a while. Let\'s see how much you\'ve levelled up!'}
          </p>
          <p className="muted">No hints and no marking until the end. Just do your best: it's fine to not know some. +{CHECKPOINT_XP} XP for finishing.</p>
          <div className="row center">
            <button className="primary" onClick={() => { setStarted(true); setShownAt(Date.now()); }}>Start checkpoint</button>
            <button onClick={onLater}>Later</button>
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    const s = score(result);
    return (
      <main className="page narrow">
        <div className="card center results">
          <p className="eyebrow">Checkpoint complete</p>
          <p className="big">{s.correct}/{s.total}</p>
          <p className="xp-total">+{CHECKPOINT_XP} XP</p>
          <p className="muted">Thanks! This helps show how much Schoolzone is helping you.</p>
          <button className="primary" onClick={() => onFinish({
            ...profile,
            checkpoints: [...(profile.checkpoints ?? []), result],
            xp: (profile.xp ?? 0) + CHECKPOINT_XP,
          })}>
            Continue
          </button>
        </div>
      </main>
    );
  }

  const q = questions[i];
  const submit = (given: string) => {
    if (!given.trim()) return;
    const next = [...answers, { skillId: q.skillId, level: q.level, questionId: q.id, correct: checkAnswer(q, given), timeMs: Date.now() - shownAt }];
    setAnswers(next);
    setInput('');
    setShownAt(Date.now());
    if (i + 1 < questions.length) setI(i + 1);
    else setResult({ subject, form, at: Date.now(), answers: next });
  };

  return (
    <main className="page">
      <header className="topbar hud">
        <span className="pill">Checkpoint</span>
        <div className="segments" style={{ gridTemplateColumns: `repeat(${questions.length}, 1fr)` }} aria-label={`Question ${i + 1} of ${questions.length}`}>
          {questions.map((_, k) => <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />)}
        </div>
        <span className="hud-stats">{i + 1}/{questions.length}</span>
      </header>
      <div className="card question-card">
        <div className="question-meta"><span>{getSkill(q.skillId).name}</span></div>
        <p className="prompt">{q.prompt}</p>
        {q.choices ? (
          <div className="choices">
            {q.choices.map((c) => <button key={c} onClick={() => submit(c)}>{c}</button>)}
          </div>
        ) : (
          <form className="answer-row" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} inputMode={KEYBOARD[q.skillId] ?? 'numeric'} autoFocus aria-label="Your answer" />
            <button type="submit" className="primary" disabled={!input.trim()}>Next</button>
          </form>
        )}
        <button className="link wide" onClick={() => submit('(skipped)')}>I don't know this one</button>
      </div>
    </main>
  );
}
