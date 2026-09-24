import { useEffect, useState } from 'react';
import type { ClassView as View, SkillStatus } from '../api';
import { SKILLS } from '../content/skills';
import { AUSTRALIAN_TEACHER_OBJECTIVES, isStructuredHomework, type TeacherIntentPriority } from '../curriculum/australia-teacher-objectives';

export interface ClassTools {
  classView: (schoolId: string) => Promise<View>;
  setHomework: (schoolId: string, objectiveId: string, note: string, priority: TeacherIntentPriority, dueAt: number | null) => Promise<unknown>;
  clearHomework: (schoolId: string) => Promise<unknown>;
}

const STATUS_ICON: Record<SkillStatus, string> = { mastered: '✅', learning: '🔄', struggling: '⚠️', ready: '·', locked: '·' };
const Y6 = SKILLS.filter((s) => s.typicalYear === 6);

const ago = (t: number | null) => {
  if (!t) return 'not yet';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/** What a teacher sees: only pupils whose parents chose to share their progress. */
export function ClassView({ schoolId, tools, onBack }: { schoolId: string; tools: ClassTools; onBack: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [objectiveId, setObjectiveId] = useState(AUSTRALIAN_TEACHER_OBJECTIVES[0].id);
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<TeacherIntentPriority>(2);
  const [dueDate, setDueDate] = useState('');
  const load = () => tools.classView(schoolId).then(setView).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, [schoolId]); // reload when the school changes

  const act = async (f: () => Promise<unknown>) => {
    setError('');
    try { await f(); await load(); } catch (e) { setError((e as Error).message); }
  };

  if (!view) return <main className="page"><p className="loading">{error || 'Loading…'}</p></main>;
  const structured = view.homework && isStructuredHomework(view.homework) ? view.homework : null;
  const legacyHomework = view.homework && !isStructuredHomework(view.homework) ? view.homework : null;
  const legacy = legacyHomework ? SKILLS.find((s) => s.id === legacyHomework.skillId) : null;
  // Skills with the most pupils struggling or still learning first.
  const needsWork = [...view.summary.skills].sort((a, b) => (b.struggling * 2 + b.learning) - (a.struggling * 2 + a.learning));

  return (
    <main className="page wide-page">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who">🏫 {view.school.name}</span>
      </header>

      <p className="muted">
        {view.joined} {view.joined === 1 ? 'pupil has' : 'pupils have'} joined.{' '}
        {view.notSharing === 0
          ? 'All their parents have chosen to share progress with you.'
          : `You can see ${view.pupils.length}. The parents of ${view.notSharing} haven't chosen to share progress, so they're not listed.`}
      </p>

      <section className="card">
        <h2>📌 Learning objective</h2>
        {structured ? (
          <p>
            Set: <strong>Year {structured.yearLevel} {structured.objective}</strong>
            {structured.note && <> · "{structured.note}"</>}
            <small className="muted"> ({ago(structured.setAt)}{structured.dueAt ? ` · due ${new Date(structured.dueAt).toLocaleDateString()}` : ""})</small>
          </p>
        ) : legacy ? (
          <p>Legacy topic: <strong>{legacy.emoji} {legacy.name}</strong>{view.homework!.note && <> · "{view.homework!.note}"</>}</p>
        ) : (
          <p className="muted">No objective set. SchoolZone will personalise the route to the objective for each pupil.</p>
        )}
        <form className="form" onSubmit={(e) => {
          e.preventDefault();
          const dueAt = dueDate ? new Date(`${dueDate}T23:59:59`).getTime() : null;
          void act(() => tools.setHomework(schoolId, objectiveId, note, priority, dueAt));
        }}>
          <label>Australian Curriculum objective
            <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)}>
              {(["4", "5", "6"] as const).map((year) => (
                <optgroup key={year} label={`Year ${year}`}>
                  {AUSTRALIAN_TEACHER_OBJECTIVES.filter((item) => item.yearLevel === year).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.subject === 'maths' ? 'Maths' : item.subject === 'english' ? 'English' : 'Science'} · {item.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>Priority
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as TeacherIntentPriority)}>
              <option value={1}>High</option>
              <option value={2}>Normal</option>
              <option value={3}>Low</option>
            </select>
          </label>
          <label>Due date (optional)<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <label>Note for pupils (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Focus for Friday" /></label>
          <p className="muted small">The objective is fixed. SchoolZone can teach missing prerequisites first and then return the pupil to the objective.</p>
          <div className="row">
            <button type="submit" className="primary">Assign objective</button>
            {view.homework && <button type="button" onClick={() => void act(() => tools.clearHomework(schoolId))}>Clear objective</button>}
          </div>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {view.pupils.length > 0 && (
        <>
          <section className="card">
            <h2>📊 Year 6 skills across the class</h2>
            <p className="muted small">✅ mastered · 🔄 learning · ⚠️ struggling · not started. Most in need of work first.</p>
            <div className="class-skills">
              {needsWork.map((s) => {
                const total = view.pupils.length;
                const pct = (n: number) => `${(n / total) * 100}%`;
                return (
                  <div key={s.skillId} className="class-skill">
                    <span className="class-skill-name">{s.name}<small>{s.subject}</small></span>
                    <span className="stack" aria-label={`${s.mastered} mastered, ${s.learning} learning, ${s.struggling} struggling, ${s.notStarted} not started`}>
                      <span className="st-mastered" style={{ width: pct(s.mastered) }} />
                      <span className="st-learning" style={{ width: pct(s.learning) }} />
                      <span className="st-struggling" style={{ width: pct(s.struggling) }} />
                    </span>
                    <span className="class-skill-counts">✅{s.mastered} 🔄{s.learning} ⚠️{s.struggling}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {view.summary.mistakes.length > 0 && (
            <section className="card">
              <h2>🔍 Common mistake patterns</h2>
              <ul className="insight-list">
                {view.summary.mistakes.map((m) => <li key={m.name}><strong>{m.name}</strong>: {m.pupils} {m.pupils === 1 ? 'pupil' : 'pupils'}</li>)}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>👩‍🎓 Pupils</h2>
            <ul className="pupil-list">
              {view.pupils.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <div className="pupil-head">
                    <strong><span aria-hidden>{p.avatar}</span> {p.name}</strong>
                    <small className="muted">Active {ago(p.lastActive)} · {p.answeredThisWeek} answers this week</small>
                  </div>
                  {p.stuck && <p className="banner help">Working through: {p.stuck.skill} (level {p.stuck.level}), since {ago(p.stuck.since)}</p>}
                  {p.mistakes.length > 0 && <p className="small">Mistake patterns: {p.mistakes.join(' · ')}</p>}
                  <p className="small muted">
                    {Y6.map((s) => `${STATUS_ICON[p.skills[s.id] ?? 'ready']} ${s.name}`).filter((x) => !x.startsWith('·')).join('  ') || 'No Year 6 skills started yet.'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
