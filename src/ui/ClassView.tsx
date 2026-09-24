import { useEffect, useState } from 'react';
import type { ClassView as View, SkillStatus } from '../api';
import { SKILLS, SUBJECTS } from '../content/skills';

export interface ClassTools {
  classView: (schoolId: string) => Promise<View>;
  setHomework: (schoolId: string, skillId: string, note: string) => Promise<unknown>;
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
  const [skillId, setSkillId] = useState(Y6[0].id);
  const [note, setNote] = useState('');
  const load = () => tools.classView(schoolId).then(setView).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, [schoolId]); // reload when the school changes

  const act = async (f: () => Promise<unknown>) => {
    setError('');
    try { await f(); await load(); } catch (e) { setError((e as Error).message); }
  };

  if (!view) return <main className="page"><p className="loading">{error || 'Loading…'}</p></main>;
  const hw = view.homework ? SKILLS.find((s) => s.id === view.homework!.skillId) : null;
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
        <h2>📌 Homework topic</h2>
        {hw ? (
          <p>Set: <strong>{hw.emoji} {hw.name}</strong>{view.homework!.note && <> · "{view.homework!.note}"</>} <small className="muted">({ago(view.homework!.setAt)})</small></p>
        ) : <p className="muted">No topic set. Pupils see the topic on their home screen and can practise it in one tap.</p>}
        <form className="form" onSubmit={(e) => { e.preventDefault(); void act(() => tools.setHomework(schoolId, skillId, note)); }}>
          <label>Topic
            <select value={skillId} onChange={(e) => setSkillId(e.target.value)}>
              {SUBJECTS.map((sub) => (
                <optgroup key={sub.id} label={sub.name}>
                  {Y6.filter((s) => s.subject === sub.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>Note for pupils (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Ready for Friday's quiz!" /></label>
          <div className="row">
            <button type="submit" className="primary">Set topic</button>
            {hw && <button type="button" onClick={() => void act(() => tools.clearHomework(schoolId))}>Clear topic</button>}
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
