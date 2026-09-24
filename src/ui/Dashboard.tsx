import { calibration, subjectReport, summarySentences, type SkillStatus } from '../brain/insights';
import type { Profile } from '../brain/types';
import { SUBJECTS } from '../content/skills';

const STATUS_LABEL: Record<SkillStatus, string> = {
  mastered: '🏆 Mastered',
  learning: '📈 Learning',
  struggling: '🧗 Finding it hard',
  ready: '🔓 Ready to start',
  locked: '🔒 Locked',
};

export function Dashboard({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const cal = calibration(profile);
  return (
    <main className="page wide-page">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who"><span className="avatar small">{profile.avatar}</span> {profile.name}'s learning map</span>
      </header>

      <p className="muted">
        {profile.history.length} questions answered so far.{' '}
        {cal
          ? `Over the last ${cal.answers} answers the brain expected ${cal.predictedPct}% correct and ${profile.name} got ${cal.actualPct}%.`
          : 'After 10 answers the brain will show how accurate its predictions are.'}
      </p>

      {SUBJECTS.map((subject) => (
        <section key={subject.id} className="card">
          <h2>{subject.emoji} {subject.name}</h2>
          <ul className="summary">
            {summarySentences(profile, subject.id).map((s) => <li key={s}>{s}</li>)}
          </ul>
          <div className="skill-table">
            {subjectReport(profile, subject.id).map((r) => (
              <div key={r.skill.id} className={`skill-row ${r.status}`}>
                <div className="skill-name">
                  <span>{r.skill.emoji} {r.skill.name}</span>
                  <small>{STATUS_LABEL[r.status]}</small>
                </div>
                <div className="meter" title={r.attempts ? `Mastery ${r.masteryPct}%` : 'Not tried yet'}>
                  <div style={{ width: `${r.attempts ? r.masteryPct : 0}%` }} />
                </div>
                {r.attempts === 0 ? (
                  <div className="skill-stats"><span>Not tried yet</span></div>
                ) : (
                  <div className="skill-stats">
                    <span>Mastery {r.masteryPct}%</span>
                    <span>Comfortable level {r.comfortableLevel ? `${r.comfortableLevel}/5` : 'below 1'}</span>
                    <span>{r.attempts} tries, {r.accuracyPct}% right</span>
                    <span>{r.avgSeconds}s avg</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <details className="card">
        <summary>How does the brain work?</summary>
        <p>
          For every skill the app keeps two numbers. <strong>Ability</strong> (an Elo-style rating, the approach
          used by the Math Garden system) goes up after correct answers and down after mistakes, weighted by how
          surprising the result was. The app uses it to pick questions {profile.name} should get right about 80% of
          the time: hard enough to learn from, easy enough to stay motivated.
        </p>
        <p>
          <strong>Mastery</strong> (Bayesian Knowledge Tracing) is the chance the skill is truly learned, allowing
          for lucky guesses and careless slips. When it reaches 95% and the ability is solid, the skill counts as
          mastered, the next skills unlock, and it comes back for short reviews at growing gaps (1, 2, 4, 8… days).
        </p>
        <p>
          After two misses in a row the questions get easier. After three, the app looks back through the skill
          map for a weaker earlier skill (like addition before subtraction) and practises that first.
        </p>
      </details>
    </main>
  );
}
