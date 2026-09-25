import { useEffect, useMemo, useRef, useState } from 'react';
import type { HelpEvent } from '../brain/help';
import type { ItemStats } from '../brain/items';
import { describeReward, getBadge } from '../brain/badges';
import { getMisconception } from '../brain/misconceptions';
import { isMastered } from '../brain/model';
import type { AnswerEvent, TutorTurn } from '../api';
import { itemKey } from '../brain/items';
import { planNext, recordAnswer, skillState, type Plan } from '../brain/tutor';
import { emptyLearningIntelligence, recordEngagementSignal } from '../brain/learning-intelligence';
import { sessionPolicy } from '../brain/session-policy';
import type { Profile, Question, SubjectId } from '../brain/types';
import { checkAnswer, makeQuestion } from '../content';
import { curriculumEvidenceForQuestion, type CurriculumPracticeFocus } from '../curriculum/evidence';
import type { AustralianPracticeRoute } from '../curriculum/australia-intent-routing';
import { hintLadder, topicNotes, wordsIn } from '../content/solver';
import { getSkill, skillsFor } from '../content/skills';
import { useSpeech } from '../speech';
import { questionSpeech, SpeakButton } from './SpeakButton';
import { newMissionEvidenceId, pilotAnswerEvent } from '../pilot-evidence';
import { PassageCard } from './PassageCard';
import { AnimatedMathSupport } from './AnimatedMathSupport';
import { animatedSupportFor } from '../content/animated-support';


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
  stuck: 'Tricky one. We\'ll crack it together before moving on.',
  switched: 'Let\'s come at it from a different angle.',
  helped: 'That clicked. Now let\'s level back up.',
  resolved: 'You cracked it on your own! +40 XP bonus',
};

const RIGHT = ['Nailed it', 'Correct', 'Spot on', 'Yes!', 'Sorted'];

/** Asks the AI tutor about the current question (only when a parent has switched it on). */
export type TutorFn = (body: {
  question: Question; given?: string; misconception?: string;
  history: TutorTurn[]; message: string;
}) => Promise<{ reply: string; flagged: string | null }>;

const minus = (s: string) => s.replace(/^-/, '−');

interface Props {
  profile: Profile;
  /** Start on this skill (e.g. homework from the teacher). The brain still teaches what it needs first. */
  focusSkill?: string;
  /** Structured curriculum route selected from the canonical graph. */
  teacherRoute?: AustralianPracticeRoute;
  /** Recalculate the structured route before beginning another mission. */
  onNextTeacherMission?: (profile: Profile) => void;
  subject: SubjectId;
  onUpdate: (p: Profile) => void;
  items: ItemStats;
  onItems: (items: ItemStats) => void;
  /** Called with each answer, so it can be sent to the server. */
  onAnswer: (childId: string, e: AnswerEvent) => void;
  tutor?: TutorFn;
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
  xp: number;
}

function nextTurn(
  profile: Profile,
  subject: SubjectId,
  focus: string | null,
  answered: number,
  items: ItemStats,
  teacherRoute?: AustralianPracticeRoute,
): Turn {
  const plan = planNext(
    profile,
    subject,
    {
      focus,
      answered,
      allowedLevels: teacherRoute?.practiceLevels,
      strictFocus: !!teacherRoute,
    },
    Date.now(),
    Math.random,
    items,
  );
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

export function Practice({
  profile,
  subject,
  focusSkill,
  teacherRoute,
  onNextTeacherMission,
  onUpdate,
  items,
  onItems,
  onAnswer,
  tutor,
  onExit,
}: Props) {
  const masteredAtStart = useRef(
    new Set(skillsFor(subject).filter((s) => isMastered(skillState(profile, s.id))).map((s) => s.id)),
  );
  const missionEvidenceId = useRef(newMissionEvidenceId());
  const [turn, setTurn] = useState<Turn>(
    () => nextTurn(profile, subject, focusSkill ?? null, 0, items, teacherRoute),
  );
  const [studying, setStudying] = useState(!!turn.example);
  // Problem Solver state for the current question.
  const [solverOpen, setSolverOpen] = useState(!!turn.plan.showHint);
  const [hintsShown, setHintsShown] = useState(turn.plan.showHint ? 1 : 0);
  const [showNotes, setShowNotes] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [showVisualHint, setShowVisualHint] = useState(!!turn.plan.showHint);
  const [solverExample, setSolverExample] = useState<Question | null>(null);
  const [answered, setAnswered] = useState(0);
  const [missionLength, setMissionLength] = useState(() => sessionPolicy(profile, subject).missionLength);
  const [score, setScore] = useState(0);
  const [cracked, setCracked] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
  const [streak, setStreak] = useState(0);
  // AI tutor chat for the current question.
  const [chat, setChat] = useState<TutorTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');

  const { plan, question, example } = turn;
  const skill = getSkill(question.skillId);
  const curriculumFocus: CurriculumPracticeFocus | undefined = teacherRoute
    ? {
        curriculumId: 'au-ac-v9',
        canonicalNodeId: teacherRoute.activeCanonicalNodeId,
        practiceSkillId: teacherRoute.practiceSkillId,
        practiceLevels: teacherRoute.practiceLevels,
        strength: teacherRoute.evidenceStrength,
      }
    : undefined;
  const ladder = useMemo(() => hintLadder(question, Math.random), [question]);
  const words = useMemo(() => wordsIn(question), [question]);
  const animatedSupportAvailable = useMemo(() => animatedSupportFor(question) !== null, [question]);
  // Any use of the Problem Solver means the answer counts as practice, not proof.
  const usedSolver = !!plan.workedExample
    || hintsShown > 0
    || showNotes
    || showWords
    || showVisualHint
    || solverExample !== null
    || chat.length > 0;
  const removed = ladder.slice(0, hintsShown).find((h) => h.kind === 'remove');

  // Read each new question aloud if the child switched that on.
  const speech = useSpeech();
  const autoRead = profile.settings.autoRead && speech.available;
  useEffect(() => {
    if (!autoRead) return;
    speech.speak(studying && example ? `Worked example. ${example.prompt}` : questionSpeech(question.prompt, question.choices));
  }, [question.id, studying, autoRead]); // only when the question changes

  function start(t: Turn) {
    setTurn(t);
    setStudying(!!t.example);
    setSolverOpen(!!t.plan.showHint);
    setHintsShown(t.plan.showHint ? 1 : 0);
    setShowNotes(false);
    setShowWords(false);
    setShowVisualHint(!!t.plan.showHint);
    setSolverExample(null);
    setFeedback(null);
    setInput('');
    setChat([]);
    setChatInput('');
    setChatError('');
  }

  async function askTutor() {
    if (!tutor || !chatInput.trim() || chatBusy) return;
    const message = chatInput.trim();
    setChatBusy(true);
    setChatError('');
    setChatInput('');
    try {
      const res = await tutor({ question, history: chat, message, given: feedback?.given });
      setChat((c) => [...c, { role: 'user', content: message }, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setChatError((err as Error).message);
      setChatInput(message);
    } finally {
      setChatBusy(false);
    }
  }

  function submit(given: string) {
    if (feedback || !given.trim()) return;
    const at = Date.now();
    const timeMs = at - turn.shownAt;
    const correct = checkAnswer(question, given);
    const before = skillState(profile, question.skillId);
    const curriculumEvidence = curriculumEvidenceForQuestion(profile, question, curriculumFocus);
    const result = recordAnswer(profile, question, correct, timeMs, at, {
      given, hinted: usedSolver, items, strategy: plan.strategy, curriculumEvidence,
      sessionPosition: answered + 1,
    });
    const after = skillState(result.profile, question.skillId);
    onUpdate(result.profile);
    onItems(result.items);
    onAnswer(profile.id, pilotAnswerEvent({
      at,
      timeMs,
      sessionId: missionEvidenceId.current,
      sessionPosition: answered + 1,
      missionLength,
      question,
      itemKey: itemKey(question),
      correct,
      hinted: usedSolver,
      plan,
      result,
      before,
      after,
      curriculumEvidence,
      teacherRoute,
    }));
    setFeedback({ correct, given, misconception: result.misconception, rapid: result.rapid, event: result.event, badges: result.badges, xp: result.xp });
    setAnswered((n) => n + 1);
    setSessionXp((x) => x + result.xp);
    setStreak((st) => (correct && !usedSolver ? st + 1 : 0));
    if (correct) setScore((n) => n + 1);
    if (result.event === 'resolved') setCracked((n) => n + 1);
  }

  function next() {
    start(nextTurn(profile, subject, question.skillId, answered, items, teacherRoute));
  }

  function withSessionSignal(kind: 'stopped-session' | 'continued-voluntarily', value: number): Profile {
    const learningIntelligence = recordEngagementSignal(
      profile.learningIntelligence ?? emptyLearningIntelligence(),
      { kind, at: Date.now(), subject, value },
    );
    const nextProfile = { ...profile, learningIntelligence };
    onUpdate(nextProfile);
    return nextProfile;
  }

  function exitSession() {
    if (answered > 0 && answered < missionLength) withSessionSignal('stopped-session', answered);
    onExit();
  }

  function continueMission() {
    const nextProfile = withSessionSignal('continued-voluntarily', missionLength);
    missionEvidenceId.current = newMissionEvidenceId();
    if (teacherRoute && onNextTeacherMission) {
      onNextTeacherMission(nextProfile);
      return;
    }
    const nextLength = sessionPolicy(nextProfile, subject).missionLength;
    setMissionLength(nextLength);
    setAnswered(0);
    setScore(0);
    setCracked(0);
    setSessionXp(0);
    setStreak(0);
    start(nextTurn(nextProfile, subject, focusSkill ?? null, 0, items, teacherRoute));
  }

  if (answered >= missionLength && !feedback) {
    const newlyMastered = skillsFor(subject).filter(
      (s) => isMastered(skillState(profile, s.id)) && !masteredAtStart.current.has(s.id),
    );
    const open = profile.help.episode && getSkill(profile.help.episode.skillId).subject === subject ? profile.help.episode : null;
    return (
      <main className="page">
        <div className="card center results">
          <p className="eyebrow">Mission complete</p>
          <p className="big">{score}/{missionLength}</p>
          <p className="xp-total">+{sessionXp} XP</p>
          {cracked > 0 && <p>💪 You worked through {cracked} tricky {cracked === 1 ? 'problem' : 'problems'}.</p>}
          {newlyMastered.length > 0 && (
            <p>🏆 You mastered: <strong>{newlyMastered.map((s) => s.name).join(', ')}</strong></p>
          )}
          {open && <p>We'll keep working on <strong>{getSkill(open.skillId).name}</strong> together next time, until you've got it.</p>}
          <p className="muted">Schoolzone has updated what it knows about you, so next time starts at the right level.</p>
          <div className="row center">
            <button className="primary" onClick={continueMission}>
              Next mission
            </button>
            <button onClick={exitSession}>Back to base</button>
          </div>
        </div>
      </main>
    );
  }

  const header = (
    <>
      <header className="topbar hud">
        <button className="link" onClick={exitSession} aria-label="Leave mission">✕</button>
        <div className="segments" aria-label={`Question ${Math.min(answered + (feedback ? 0 : 1), missionLength)} of ${missionLength}`}>
          {Array.from({ length: missionLength }, (_, i) => <span key={i} className={i < answered ? 'done' : i === answered ? 'now' : ''} />)}
        </div>
        <span className="hud-stats"><span title="Correct in a row">🔥{streak}</span> <span className="xp-chip">{sessionXp} XP</span></span>
      </header>
    </>
  );

  // Worked example first: study a solved one, then it's the child's turn.
  if (studying && example) {
    const m = plan.target ? getMisconception(plan.target) : null;
    return (
      <main className="page">
        {header}
        <p className="banner help">{plan.message}</p>
        {example.passageId && <PassageCard key={example.passageId} passageId={example.passageId} />}
        <div className="card question-card worked">
          <div className="question-meta"><span>{skill.emoji} {skill.name}</span><span>📖 Worked example</span></div>
          <div className="prompt-row"><p className="prompt">{example.prompt}</p><SpeakButton text={`${example.prompt}. ${example.explanation}`} /></div>
          <AnimatedMathSupport question={example} mode="worked" />
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

  const tutorPanel = tutor ? (
    <div className="solver-panel tutor-chat">
                    <strong>🤖 Ask the AI tutor</strong>
                    {chat.length === 0 && (
                      <p className="muted"><small>
                        This tutor is an AI (a computer program), not a person. It helps you think but won't give you the answer.
                        Never share your full name, address, school or passwords. A parent can read these chats.
                      </small></p>
                    )}
                    {chat.map((t, i) => <p key={i} className={`chat-line ${t.role}`}>{t.role === 'user' ? 'You' : 'AI tutor'}: {t.content}</p>)}
                    <form className="answer-row" onSubmit={(e) => { e.preventDefault(); void askTutor(); }}>
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Explain your thinking or ask a question"
                        maxLength={300}
                        aria-label="Message to the tutor"
                      />
                      <button type="submit" disabled={chatBusy || !chatInput.trim()}>{chatBusy ? '…' : 'Send'}</button>
                    </form>
                    {chatError && <p className="error" role="alert">{chatError}</p>}
                  </div>
  ) : null;

  const shownChoices = question.choices?.filter((c) => !(removed?.kind === 'remove' && c === removed.choice));
  const m = feedback?.misconception ? getMisconception(feedback.misconception) : null;

  return (
    <main className="page">
      {header}

      {plan.message && !feedback && <p className={`banner ${plan.reason}`}>{plan.message}</p>}
      {question.passageId && <PassageCard key={question.passageId} passageId={question.passageId} />}

      <div className="card question-card">
        <div className="question-meta">
          <span>{skill.emoji} {skill.name}</span>
          <span className="stars" aria-label={`Level ${question.level} of 5`}>
            {'★'.repeat(question.level)}{'☆'.repeat(5 - question.level)}
          </span>
        </div>
        <div className="prompt-row"><p className="prompt">{question.prompt}</p><SpeakButton text={questionSpeech(question.prompt, shownChoices)} /></div>

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
              🧩 Problem Solver{animatedSupportAvailable ? ' · ✨ Visual guide available' : ''} {solverOpen ? '▲' : '▼'}
            </button>
            {solverOpen && (
              <div className="solver-body">
                <div className="solver-tools">
                  <button onClick={() => setHintsShown((n) => Math.min(ladder.length, n + 1))} disabled={hintsShown >= ladder.length}>
                    💡 {hintsShown === 0 ? 'Give me a hint' : hintsShown < ladder.length ? 'Another hint' : 'No more hints'}
                  </button>
                  {animatedSupportAvailable && (
                    <button onClick={() => setShowVisualHint((v) => !v)} aria-pressed={showVisualHint}>
                      ✨ {showVisualHint ? 'Hide visual guide' : 'Show visual guide'}
                    </button>
                  )}
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
                {(showVisualHint || hintsShown > 0) && <AnimatedMathSupport question={question} mode="hint" />}
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
                    <AnimatedMathSupport question={solverExample} mode="worked" />
                    <p>{solverExample.explanation}</p>
                    <p><strong>Answer:</strong> {minus(solverExample.answer)}</p>
                  </div>
                )}
                {tutorPanel}
                <p className="muted"><small>Using the Problem Solver is a smart move. This answer counts as practice (half XP).</small></p>
              </div>
            )}
          </section>
        )}

        {feedback && (
          <div className={`feedback ${feedback.correct ? 'good' : 'bad'}`}>
            <p className="feedback-title">
              {feedback.correct ? `✓ ${RIGHT[answered % RIGHT.length]}` : `✗ Not quite. The answer is ${minus(question.answer)}.`}
              {feedback.xp > 0 && <span className="xp-pop">+{feedback.xp} XP</span>}
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
            {!feedback.correct && tutorPanel}
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
              {answered >= missionLength ? 'See results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
