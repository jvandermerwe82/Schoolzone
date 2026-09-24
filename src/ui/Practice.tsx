import { useMemo, useRef, useState } from 'react';
import type { HelpEvent } from '../brain/help';
import type { ItemStats } from '../brain/items';
import { describeReward, getBadge } from '../brain/badges';
import { getMisconception } from '../brain/misconceptions';
import { isMastered } from '../brain/model';
import { planNext, recordAnswer, skillState, type Plan } from '../brain/tutor';
import type { Profile, Question, SubjectId } from '../brain/types';
import { checkAnswer, makeQuestion } from '../content';
import { hintLadder, topicNotes, wordsIn } from '../content/solver';
import { getSkill, skillsFor } from '../content/skills';

const SESSION_LENGTH = 10;

/**
 * On-screen keyboard per skill. Chosen by skill, not by the answer, so the
 * keyboard never hints at the answer (e.g. whether it is negative).
 */
const KEYBOARD: Record<string, 'text' | 'decimal'> = {
  'negative-numbers': 'text',
  fractions: 'text',
  'fractions-y6': 'text',
  'decimals-percentages': 'decimal',
};

const EVENT_MESSAGE: Record<Exclude<HelpEvent, null>, string> = {
  stuck: 'This one is tricky. We\'ll work on it together before moving on.',
  switched: 'Let\'s try a different way of looking at it.',
  helped: 'That helped! Now let\'s build back up.',
  resolved: '🎉 You cracked it on your own!',
};

const minus = (s: string) => s.replace(/^-/, '−');

interface Props {
  profile: Profile;
  subject: SubjectId;
  onUpdate: (p: Profile) => void;
  items: ItemStats;
  onItems: (items: ItemStats) => void;
  onExit: () => void;
}

interface Turn {
  plan: Plan;
  question: Question;
  /** A solved example shown first, when the tutor is teaching with one. */
  example: Question | null;
  shownAt: number;
}

interface Feedback {
  correct: boolean;
  given: string;
  misconception: string | null;
  rapid: boolean;
  event: HelpEvent;
  badges: string[];
}

function nextTurn(profile: Profile, subject: SubjectId, focus: string | null, answered: number, items: ItemStats): Turn {
  const plan = planNext(profile, subject, { focus, answered }, Date.now(), Math.random, items);
  const question = makeQuestion(plan.skillId, plan.level, profile.recentQuestionIds, Math.random, plan.target);
  let example: Question | null = null;
  if (plan.workedExample) {
    // A different question of the same kind, shown fully solved.
    const avoid = [...profile.recentQuestionIds, question.id];
    example = makeQuestion(plan.skillId, plan.level, avoid, Math.random, plan.target);
    if (example.id === question.id) example = null;
  }
  return { plan, question, example, shownAt: Date.now() };
}

export function Practice({ profile, subject, onUpdate, items, onItems, onExit }: Props) {
  const masteredAtStart = useRef(
    new Set(skillsFor(subject).filter((s) => isMastered(skillState(profile, s.id))).map((s) => s.id)),
  );
  const [turn, setTurn] = useState<Turn>(() => nextTurn(profile, subject, null, 0, items));
  const [studying, setStudying] = useState(!!turn.example);
  // Problem Solver state for the current question.
  const [solverOpen, setSolverOpen] = useState(!!turn.plan.showHint);
  const [hintsShown, setHintsShown] = useState(turn.plan.showHint ? 1 : 0);
  const [showNotes, setShowNotes] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [solverExample, setSolverExample] = useState<Question | null>(null);
  const [answered, setAnswered] = useState(0);
  const [score, setScore] = useState(0);
  const [cracked, setCracked] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const { plan, question, example } = turn;
  const skill = getSkill(question.skillId);
  const ladder = useMemo(() => hintLadder(question, Math.random), [question]);
  const words = useMemo(() => wordsIn(question), [question]);
  // Any use of the Problem Solver means the answer counts as practice, not proof.
  const usedSolver = hintsShown > 0 || showNotes || showWords || solverExample !== null;
  const removed = ladder.slice(0, hintsShown).find((h) => h.kind === 'remove');

  function start(t: Turn) {
    setTurn(t);
    setStudying(!!t.example);
    setSolverOpen(!!t.plan.showHint);
    setHintsShown(t.plan.showHint ? 1 : 0);
    setShowNotes(false);
    setShowWords(false);
    setSolverExample(null);
    setFeedback(null);
    setInput('');
  }

  function submit(given: string) {
    if (feedback || !given.trim()) return;
    const correct = checkAnswer(question, given);
    const result = recordAnswer(profile, question, correct, Date.now() - turn.shownAt, Date.now(), {
      given, hinted: usedSolver, items, strategy: plan.strategy,
    });
    onUpdate(result.profile);
    onItems(result.items);
    setFeedback({ correct, given, misconception: result.misconception, rapid: result.rapid, event: result.event, badges: result.badges });
    setAnswered((n) => n + 1);
    if (correct) setScore((n) => n + 1);
    if (result.event === 'resolved') setCracked((n) => n + 1);
  }

  function next() {
    start(nextTurn(profile, subject, question.skillId, answered, items));
  }

  if (answered >= SESSION_LENGTH && !feedback) {
    const newlyMastered = skillsFor(subject).filter(
      (s) => isMastered(skillState(profile, s.id)) && !masteredAtStart.current.has(s.id),
    );
    const open = profile.help.episode && getSkill(profile.help.episode.skillId).subject === subject ? profile.help.episode : null;
    return (
      <main className="page">
        <div className="card center">
          <h2>Session complete! 🎉</h2>
          <p className="big">{score} / {SESSION_LENGTH} correct</p>
          {cracked > 0 && <p>💪 You worked through {cracked} tricky {cracked === 1 ? 'problem' : 'problems'}.</p>}
          {newlyMastered.length > 0 && (
            <p>🏆 You mastered: <strong>{newlyMastered.map((s) => s.name).join(', ')}</strong></p>
          )}
          {open && <p>We'll keep working on <strong>{getSkill(open.skillId).name}</strong> together next time, until you've got it.</p>}
          <p>The brain has updated what it knows about you, so the next session starts in the right place.</p>
          <div className="row center">
            <button className="primary" onClick={() => { setAnswered(0); setScore(0); setCracked(0); start(nextTurn(profile, subject, null, 0, items)); }}>
              Keep going
            </button>
            <button onClick={onExit}>Done</button>
          </div>
        </div>
      </main>
    );
  }

  const header = (
    <>
      <header className="topbar">
        <button className="link" onClick={onExit}>← Back</button>
        <span className="progress-text">Question {Math.min(answered + (feedback ? 0 : 1), SESSION_LENGTH)} of {SESSION_LENGTH}</span>
      </header>
      <div className="progress"><div style={{ width: `${(answered / SESSION_LENGTH) * 100}%` }} /></div>
    </>
  );

  // Worked example first: study a solved one, then it's the child's turn.
  if (studying && example) {
    const m = plan.target ? getMisconception(plan.target) : null;
    return (
      <main className="page">
        {header}
        <p className="banner help">{plan.message}</p>
        <div className="card question-card worked">
          <div className="question-meta"><span>{skill.emoji} {skill.name}</span><span>📖 Worked example</span></div>
          <p className="prompt">{example.prompt}</p>
          {example.choices && <p className="muted">Choices: {example.choices.join(' · ')}</p>}
          <div className="steps">
            <p><strong>How to solve it:</strong> {example.explanation}</p>
            <p><strong>Answer:</strong> {minus(example.answer)}</p>
            {m && <p><strong>Watch out:</strong> {m.fix}</p>}
          </div>
          <button className="primary" onClick={() => { setStudying(false); setTurn((t) => ({ ...t, shownAt: Date.now() })); }} autoFocus>
            Got it. My turn →
          </button>
        </div>
      </main>
    );
  }

  const shownChoices = question.choices?.filter((c) => !(removed?.kind === 'remove' && c === removed.choice));
  const m = feedback?.misconception ? getMisconception(feedback.misconception) : null;

  return (
    <main className="page">
      {header}

      {plan.message && !feedback && <p className={`banner ${plan.reason}`}>{plan.message}</p>}

      <div className="card question-card">
        <div className="question-meta">
          <span>{skill.emoji} {skill.name}</span>
          <span className="stars" aria-label={`Level ${question.level} of 5`}>
            {'★'.repeat(question.level)}{'☆'.repeat(5 - question.level)}
          </span>
        </div>
        <p className="prompt">{question.prompt}</p>

        {shownChoices ? (
          <div className="choices">
            {shownChoices.map((c) => {
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
              inputMode={KEYBOARD[question.skillId] ?? 'numeric'}
              autoFocus
              disabled={!!feedback}
              aria-label="Your answer"
            />
            <button type="submit" className="primary" disabled={!!feedback || !input.trim()}>Check</button>
          </form>
        )}

        {!feedback && (
          <section className="solver" aria-label="Problem Solver">
            <button className="solver-toggle" onClick={() => setSolverOpen((o) => !o)} aria-expanded={solverOpen}>
              🧩 Problem Solver {solverOpen ? '▲' : '▼'}
            </button>
            {solverOpen && (
              <div className="solver-body">
                <div className="solver-tools">
                  <button onClick={() => setHintsShown((n) => Math.min(ladder.length, n + 1))} disabled={hintsShown >= ladder.length}>
                    💡 {hintsShown === 0 ? 'Give me a hint' : hintsShown < ladder.length ? 'Another hint' : 'No more hints'}
                  </button>
                  <button onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes}>📘 About this topic</button>
                  {words.length > 0 && <button onClick={() => setShowWords((v) => !v)} aria-pressed={showWords}>🔤 What do the words mean?</button>}
                  <button
                    onClick={() => setSolverExample((e) => e ?? makeQuestion(question.skillId, question.level, [...profile.recentQuestionIds, question.id], Math.random))}
                    disabled={solverExample !== null}
                  >
                    👀 Show me an example
                  </button>
                </div>
                {ladder.slice(0, hintsShown).map((h, i) => (
                  <p key={i} className="hint">
                    💡 <strong>Hint {i + 1}:</strong>{' '}
                    {h.kind === 'remove' ? 'One wrong answer has been taken away.' : h.kind === 'step' ? `Start like this: ${h.text}` : h.text}
                  </p>
                ))}
                {showNotes && (
                  <div className="solver-panel">
                    <strong>📘 {skill.name}</strong>
                    <ul>{topicNotes(skill.id).map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                )}
                {showWords && (
                  <div className="solver-panel">
                    <strong>🔤 Words in this question</strong>
                    <dl>{words.map((w) => <div key={w.term}><dt>{w.term}</dt><dd>{w.meaning}</dd></div>)}</dl>
                  </div>
                )}
                {solverExample && solverExample.id !== question.id && (
                  <div className="solver-panel">
                    <strong>👀 A similar example, solved</strong>
                    <p>{solverExample.prompt}</p>
                    <p>{solverExample.explanation}</p>
                    <p><strong>Answer:</strong> {minus(solverExample.answer)}</p>
                  </div>
                )}
                <p className="muted"><small>Using the Problem Solver is a great way to learn. This answer will count as practice.</small></p>
              </div>
            )}
          </section>
        )}

        {feedback && (
          <div className={`feedback ${feedback.correct ? 'good' : 'bad'}`}>
            <p className="feedback-title">
              {feedback.correct ? '✅ Correct!' : `❌ Not quite. The answer is ${minus(question.answer)}.`}
            </p>
            {feedback.rapid && <p>⏱️ That was very quick! Take your time and read the question carefully.</p>}
            {m && (
              <div className="diagnosis">
                <p><strong>🔍 I think I know what happened:</strong> {m.noticed}</p>
                <p><strong>Remember:</strong> {m.fix}</p>
              </div>
            )}
            <p>{question.explanation}</p>
            {feedback.event && <p className="event">{EVENT_MESSAGE[feedback.event]}</p>}
            {feedback.badges.map((id) => {
              const b = getBadge(id);
              const reward = describeReward(profile, id);
              return (
                <div key={id} className="badge-unlock" role="status">
                  <span className="badge-emoji">{b.emoji}</span>
                  <div>
                    <strong>{b.hidden ? '🥚 Secret badge found: ' : '🏅 New badge: '}{b.name}!</strong>
                    <br />{b.description}
                    {reward && <><br />🎁 Your reward: {reward}</>}
                  </div>
                </div>
              );
            })}
            <button className="primary" onClick={next} autoFocus>
              {answered >= SESSION_LENGTH ? 'See results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
