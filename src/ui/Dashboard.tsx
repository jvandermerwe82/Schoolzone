import { STRATEGIES, STRATEGY_LABEL } from '../brain/help';
import { calibration, subjectReport, summarySentences, type SkillStatus } from '../brain/insights';
import { tunedCount, type ItemStats } from '../brain/items';
import { misconceptionReport } from '../brain/misconceptions';
import type { Profile } from '../brain/types';
import { getSkill, SUBJECTS } from '../content/skills';

const ago = (t: number) => {
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

function Understanding({ profile, items }: { profile: Profile; items: ItemStats }) {
  const { active, fixed } = misconceptionReport(profile);
  const help = profile.help;
  const strategies = STRATEGIES.map((s) => ({ s, st: help.strategies[s] })).filter((x) => x.st && x.st.tried > 0)
    .sort((a, b) => b.st!.helped / b.st!.tried - a.st!.helped / a.st!.tried);
  const recent = profile.history.slice(-50);
  const hints = recent.filter((h) => h.hinted).length;
  const rapid = recent.filter((h) => h.rapid).length;
  const tuned = tunedCount(items);
  const ep = help.episode;
  return (
    <section className="card">
      <h2>🧠 What the brain understands about {profile.name}</h2>
      {profile.history.length === 0 && <p className="muted">Nothing yet. It starts learning from the first answer.</p>}
      {ep && (
        <p>
          <strong>Working through right now:</strong> {getSkill(ep.skillId).name} (level {ep.stuckLevel}).
          The app won't move on until {profile.name} can do it on their own.
        </p>
      )}
      {(help.stuck > 0) && (
        <p>Got stuck {help.stuck} {help.stuck === 1 ? 'time' : 'times'} and worked through it {help.resolved} {help.resolved === 1 ? 'time' : 'times'}.</p>
      )}
      {active.length > 0 && (
        <>
          <h3>Mistake patterns to work on</h3>
          <ul className="insight-list">
            {active.map(({ misconception, state }) => (
              <li key={misconception.id}>
                <strong>{misconception.name}</strong>: seen {state.seen} times, last {ago(state.lastSeen)}.
                <br /><small className="muted">How to help: {misconception.fix}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {fixed.length > 0 && (
        <>
          <h3>Mistakes {profile.name} has stopped making</h3>
          <ul className="insight-list">
            {fixed.map(({ misconception, state }) => (
              <li key={misconception.id}>✔ {misconception.name} (fixed {ago(state.fixedAt!)})</li>
            ))}
          </ul>
        </>
      )}
      {strategies.length > 0 && (
        <>
          <h3>What helps {profile.name} when stuck</h3>
          {strategies.map(({ s, st }) => (
            <div key={s} className="strategy-row">
              <span>{STRATEGY_LABEL[s]}</span>
              <span className="muted">helped {st!.helped} of {st!.tried}</span>
            </div>
          ))}
          <p className="muted"><small>The app tries the most helpful way first next time.</small></p>
        </>
      )}
      {recent.length >= 10 && (
        <p className="muted">
          In the last {recent.length} answers: {hints} with a hint{rapid > 0 ? `, ${rapid} rushed guesses (answered too fast to have read the question)` : ''}.
        </p>
      )}
      {tuned.answers > 0 && (
        <p className="muted"><small>Question difficulty tuned from {tuned.answers} answers on this device, across {tuned.questions} question types.</small></p>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<SkillStatus, string> = {
  mastered: '🏆 Mastered',
  learning: '📈 Learning',
  struggling: '🧗 Finding it hard',
  ready: '🔓 Ready to start',
  locked: '🔒 Locked',
};

export function Dashboard({ profile, items, onBack }: { profile: Profile; items: ItemStats; onBack: () => void }) {
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

      <Understanding profile={profile} items={items} />

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
          <strong>Every answer teaches it something.</strong> For each skill it keeps an <strong>ability</strong> rating
          (the Elo method used by the Math Garden system) and a <strong>mastery</strong> estimate (Bayesian Knowledge
          Tracing). It picks questions {profile.name} should get right about 80% of the time, and tries a harder level
          after a run of correct answers.
        </p>
        <p>
          <strong>It works out why an answer was wrong.</strong> Many mistakes follow a pattern, like forgetting to
          carry, or adding the tops and bottoms of fractions. The app recognises these, explains that exact mistake, and
          keeps checking with questions where that mistake would show up, until {profile.name} stops making it.
        </p>
        <p>
          <strong>It doesn't move on when {profile.name} is stuck.</strong> It stays with the problem and tries different
          ways of helping: explaining the mistake and giving a similar question, a worked example, a hint, starting easier
          and building up, or going back to an earlier skill. Once something helps, {profile.name} works back up to the
          original level without help. It remembers which kinds of help work best for {profile.name} and tries those first.
        </p>
        <p>
          <strong>It notices how {profile.name} answers.</strong> Answers given with a hint count for less, and very fast
          wrong answers are treated as guesses rather than proof of being stuck.
        </p>
        <p>
          <strong>It learns how hard each question really is</strong> from everyone's answers on this device, so its
          predictions improve over time.
        </p>
      </details>
    </main>
  );
}
