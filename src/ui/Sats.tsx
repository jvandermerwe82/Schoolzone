import { useEffect, useMemo, useRef, useState } from 'react';
import type { Profile, Question, SatsResult } from '../brain/types';
import { checkAnswer } from '../content';
import { DOMAIN_NAMES, getPassage, type Domain } from '../content/reading';
import {
  ARITHMETIC_LENGTH, ARITHMETIC_PACE_SECONDS, arithmeticPaper, dictationScript, gapped, markSpelling, nextPassage,
  readingPaper, SATS_XP, satsScore, SPELLING_TEST_LENGTH, spellingTest, wordsToLearn, type SatsKind,
} from '../content/sats';
import { getSkill } from '../content/skills';
import { useSpeech } from '../speech';
import { PassageCard } from './PassageCard';
import { questionSpeech, SpeakButton } from './SpeakButton';

interface Props {
  profile: Profile;
  onSave: (p: Profile) => void;
  onBack: () => void;
}

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** SATs-style practice papers. Results are kept apart from the adaptive brain. */
export function Sats({ profile, onSave, onBack }: Props) {
  const [kind, setKindState] = useState<SatsKind | null>(null);
  // Fixed when the paper starts, so it can't change part-way through.
  const [passageId, setPassageId] = useState('');
  const setKind = (k: SatsKind) => { setPassageId(nextPassage(profile)); setKindState(k); };
  const [result, setResult] = useState<SatsResult | null>(null);
  const finish = (r: SatsResult) => {
    setResult(r);
    onSave({ ...profile, sats: [...profile.sats, r], xp: profile.xp + SATS_XP });
  };
  const close = () => { setKindState(null); setResult(null); };

  if (result) return <Review result={result} onDone={close} />;
  if (kind === 'spelling') return <SpellingPaper profile={profile} onFinish={finish} onQuit={close} />;
  if (kind === 'arithmetic') return <QuestionPaper kind="arithmetic" build={() => arithmeticPaper(Math.random)} onFinish={finish} onQuit={close} />;
  if (kind === 'reading') {
    return <QuestionPaper kind="reading" passageId={passageId} build={() => readingPaper(passageId)} onFinish={finish} onQuit={close} />;
  }

  const toLearn = wordsToLearn(profile);
  const recent = [...profile.sats].reverse().slice(0, 6);
  const nextText = getPassage(nextPassage(profile));
  return (
    <main className="page narrow">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who"><span className="avatar small">{profile.avatar}</span> SATs practice</span>
      </header>
      <p className="muted">Practice papers in the style of the Year 6 SATs, written for Schoolzone. They're practice, so the scores aren't real SATs scores. +{SATS_XP} XP for each paper you finish.</p>

      <div className="sats-grid">
        <button className="sats-card" onClick={() => setKind('spelling')}>
          <span className="zone-icon" aria-hidden>✏️</span>
          <strong>Spelling test</strong>
          <small>{SPELLING_TEST_LENGTH} words read aloud in a sentence. Write the missing word.</small>
          {toLearn.length > 0 && <small className="tag">{toLearn.length} {toLearn.length === 1 ? 'word' : 'words'} to learn</small>}
        </button>
        <button className="sats-card" onClick={() => setKind('arithmetic')}>
          <span className="zone-icon" aria-hidden>🧮</span>
          <strong>Arithmetic</strong>
          <small>{ARITHMETIC_LENGTH} questions, timed. SATs pace is about {ARITHMETIC_PACE_SECONDS} seconds a question.</small>
        </button>
        <button className="sats-card" onClick={() => setKind('reading')}>
          <span className="zone-icon" aria-hidden>📚</span>
          <strong>Reading paper</strong>
          <small>Next text: {nextText?.title} ({nextText?.kind.toLowerCase()}). Answers are marked at the end.</small>
        </button>
      </div>

      {toLearn.length > 0 && (
        <section className="card">
          <h2>📝 Words to learn</h2>
          <p className="word-list">{toLearn.join(' · ')}</p>
          <p className="muted small">They'll come up first in your next spelling test.</p>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card">
          <h2>Recent papers</h2>
          <ul className="insight-list">
            {recent.map((r) => {
              const s = satsScore(r);
              const title = r.kind === 'reading' ? `Reading: ${getPassage(r.passageId ?? '')?.title ?? ''}` : r.kind === 'spelling' ? 'Spelling' : 'Arithmetic';
              return <li key={r.at}><strong>{title}</strong>: {s.correct}/{s.total} in {clock(r.timeMs)} <small className="muted">({new Date(r.at).toLocaleDateString()})</small></li>;
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function PaperHeader({ label, i, total, started, onQuit }: { label: string; i: number; total: number; started: number; onQuit: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return (
    <header className="topbar hud">
      <button className="link" onClick={() => window.confirm('Stop this paper? Your answers so far won\'t be saved.') && onQuit()}>✕</button>
      <span className="pill">{label}</span>
      <div className="segments" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-label={`Question ${i + 1} of ${total}`}>
        {Array.from({ length: total }, (_, k) => <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />)}
      </div>
      <span className="hud-stats" aria-label="Time taken">⏱ {clock(now - started)}</span>
    </header>
  );
}

function SpellingPaper({ profile, onFinish, onQuit }: { profile: Profile; onFinish: (r: SatsResult) => void; onQuit: () => void }) {
  const [words] = useState(() => spellingTest(profile, Math.random));
  const speech = useSpeech();
  const [grownUp, setGrownUp] = useState(false);
  // Grown-up reader mode: the word is shown briefly, on request, so the child doesn't see it while writing.
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(false), 6000);
    return () => clearTimeout(t);
  }, [reveal]);
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<SatsResult['items']>([]);
  const started = useRef(Date.now());
  const [word, sentence] = words[i];

  useEffect(() => { if (speech.available) speech.speak(dictationScript(word, sentence), 0.85); }, [i, speech.available]); // only when the word changes

  const submit = () => {
    const next = [...items, { id: word, correct: markSpelling(word, input).correct, given: input.trim() }];
    setInput('');
    setReveal(false);
    if (i + 1 < words.length) { setItems(next); setI(i + 1); }
    else onFinish({ kind: 'spelling', at: Date.now(), timeMs: Date.now() - started.current, items: next });
  };

  return (
    <main className="page narrow">
      <PaperHeader label="Spelling" i={i} total={words.length} started={started.current} onQuit={onQuit} />
      <div className="card question-card">
        {speech.available ? (
          <button type="button" className="speak big-speak" onClick={() => speech.speak(dictationScript(word, sentence), 0.85)}>🔊 Hear it again</button>
        ) : (
          <div className="banner help">
            {!grownUp ? (
              <>This device has no built-in voice. A grown-up can read the words out. <button className="link" onClick={() => setGrownUp(true)}>I'm a grown-up: show me the words</button></>
            ) : reveal ? (
              <>Grown-up, please read out: <strong>"{dictationScript(word, sentence)}"</strong> <small>(hides in a few seconds)</small></>
            ) : (
              <>Grown-up reader: <button className="link" onClick={() => setReveal(true)}>show word {i + 1} to read out</button> (child, look away!)</>
            )}
          </div>
        )}
        <p className="prompt">{gapped(word, sentence)}</p>
        <form className="answer-row" onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Write the missing word" autoFocus
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          <button type="submit" className="primary" disabled={!input.trim()}>Next</button>
        </form>
      </div>
    </main>
  );
}

function QuestionPaper({ kind, passageId, build, onFinish, onQuit }: {
  kind: 'arithmetic' | 'reading'; passageId?: string; build: () => Question[]; onFinish: (r: SatsResult) => void; onQuit: () => void;
}) {
  const [questions] = useState(build);
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<SatsResult['items']>([]);
  const started = useRef(Date.now());
  const q = questions[i];

  const answer = (given: string) => {
    const next = [...items, {
      id: q.id, correct: given !== '(skipped)' && checkAnswer(q, given), given, skillId: q.skillId,
      ...(kind === 'reading' ? { domain: q.domain } : { prompt: q.prompt, answer: q.answer }),
    }];
    setInput('');
    if (i + 1 < questions.length) { setItems(next); setI(i + 1); }
    else onFinish({ kind, at: Date.now(), timeMs: Date.now() - started.current, passageId, items: next });
  };

  return (
    <main className="page">
      <PaperHeader label={kind === 'reading' ? 'Reading' : 'Arithmetic'} i={i} total={questions.length} started={started.current} onQuit={onQuit} />
      {passageId && <PassageCard passageId={passageId} />}
      <div className="card question-card">
        <div className="question-meta"><span>{kind === 'reading' ? DOMAIN_NAMES[q.domain as Domain] : getSkill(q.skillId).name}</span><span>{i + 1}/{questions.length}</span></div>
        <div className="prompt-row"><p className="prompt">{q.prompt}</p><SpeakButton text={questionSpeech(q.prompt, q.choices)} /></div>
        {q.choices ? (
          <div className="choices">{q.choices.map((c) => <button key={c} onClick={() => answer(c)}>{c}</button>)}</div>
        ) : (
          <form className="answer-row" onSubmit={(e) => { e.preventDefault(); if (input.trim()) answer(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Your answer" autoFocus autoComplete="off" />
            <button type="submit" className="primary" disabled={!input.trim()}>Next</button>
          </form>
        )}
        <button className="link wide" onClick={() => answer('(skipped)')}>Skip this one</button>
      </div>
    </main>
  );
}

/** Marks and explanations, shown at the end. */
function Review({ result, onDone }: { result: SatsResult; onDone: () => void }) {
  const s = satsScore(result);
  const questions = useMemo(() => {
    if (result.kind === 'reading') return new Map(readingPaper(result.passageId ?? '').map((q) => [q.id, q]));
    return new Map<string, Question>();
  }, [result]);
  const byDomain = new Map<string, { right: number; total: number }>();
  for (const it of result.items) {
    if (!it.domain) continue;
    const d = byDomain.get(it.domain) ?? { right: 0, total: 0 };
    byDomain.set(it.domain, { right: d.right + (it.correct ? 1 : 0), total: d.total + 1 });
  }
  const perQuestion = result.kind === 'arithmetic' ? result.timeMs / 1000 / result.items.length : null;
  const wrong = result.items.filter((it) => !it.correct);
  return (
    <main className="page narrow">
      <div className="card center results">
        <p className="eyebrow">Paper complete</p>
        <p className="big">{s.correct}/{s.total}</p>
        <p className="muted">Time: {clock(result.timeMs)}{perQuestion !== null && ` (about ${Math.round(perQuestion)} seconds a question; SATs pace is about ${ARITHMETIC_PACE_SECONDS})`}</p>
        <p className="xp-total">+{SATS_XP} XP</p>
      </div>

      {byDomain.size > 0 && (
        <section className="card">
          <h2>How you did on each reading skill</h2>
          <ul className="insight-list">
            {[...byDomain].map(([d, v]) => <li key={d}><strong>{DOMAIN_NAMES[d as Domain]}</strong>: {v.right}/{v.total}</li>)}
          </ul>
        </section>
      )}

      {wrong.length > 0 && (
        <section className="card">
          <h2>{result.kind === 'spelling' ? 'Words to learn' : 'Look again at these'}</h2>
          <ul className="insight-list">
            {wrong.map((it) => {
              if (result.kind === 'spelling') {
                const note = markSpelling(it.id, it.given).note;
                return <li key={it.id}><strong>{it.id}</strong> <span className="muted">(you wrote "{it.given}")</span>{note && <><br /><small>{note}</small></>}</li>;
              }
              const q = questions.get(it.id);
              return (
                <li key={it.id}>
                  {q
                    ? <><strong>{q.prompt}</strong><br />Answer: {q.answer}. <small className="muted">{q.explanation}</small></>
                    : <><strong>{it.prompt}</strong><br />Answer: {it.answer} <small className="muted">(you wrote {it.given})</small></>}
                </li>
              );
            })}
          </ul>
          {result.kind === 'arithmetic' && <p className="muted small">Missions practise the skills behind these questions, with hints and help.</p>}
        </section>
      )}
      <button className="primary wide" onClick={onDone}>Done</button>
    </main>
  );
}
