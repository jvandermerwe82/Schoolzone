import { BADGES } from '../brain/badges';
import { subjectReport } from '../brain/insights';
import type { Profile, SubjectId } from '../brain/types';
import { SUBJECTS } from '../content/skills';

interface Props {
  profile: Profile;
  onPractice: (subject: SubjectId) => void;
  onDashboard: () => void;
  onParents: () => void;
  onSwitch: () => void;
}

function BadgeShelf({ profile }: { profile: Profile }) {
  const shown = BADGES.filter((b) => profile.rewards?.[b.id]?.enabled ?? true);
  const earned = shown.filter((b) => profile.badges?.[b.id]).length;
  return (
    <section className="card">
      <h2>🏅 My badges <small className="muted">({earned} of {shown.length})</small></h2>
      <div className="badge-grid">
        {shown.map((b) => {
          const got = profile.badges?.[b.id];
          const reward = profile.rewards?.[b.id]?.reward?.trim();
          const secret = b.hidden && !got;
          return (
            <div key={b.id} className={`badge ${got ? 'earned' : 'locked'}`} title={secret ? 'A secret badge!' : b.description}>
              <span className="badge-emoji">{secret ? '❓' : b.emoji}</span>
              <span className="badge-name">{secret ? '???' : b.name}</span>
              <small>{secret ? 'Secret badge' : got ? (reward ? `🎁 ${reward}` : 'Earned!') : b.description}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Home({ profile, onPractice, onDashboard, onParents, onSwitch }: Props) {
  return (
    <main className="page">
      <header className="topbar">
        <span className="who"><span className="avatar small">{profile.avatar}</span> Hi, {profile.name}!</span>
        <button className="link" onClick={onSwitch}>Switch learner</button>
      </header>

      <h2>What do you want to practise?</h2>
      <div className="subject-grid">
        {SUBJECTS.map((s) => {
          const reports = subjectReport(profile, s.id);
          const mastered = reports.filter((r) => r.status === 'mastered').length;
          return (
            <button key={s.id} className="subject-card" onClick={() => onPractice(s.id)}>
              <span className="subject-emoji">{s.emoji}</span>
              <span className="subject-name">{s.name}</span>
              <span className="subject-progress">{mastered} of {reports.length} skills mastered</span>
              <span className="skill-dots" aria-hidden>
                {reports.map((r) => <span key={r.skill.id} className={`dot ${r.status}`} title={r.skill.name} />)}
              </span>
            </button>
          );
        })}
      </div>

      <BadgeShelf profile={profile} />

      <button className="secondary wide" onClick={onDashboard}>📊 See what the brain has learned</button>
      <button className="link wide" onClick={onParents}>👪 Parents: badges &amp; rewards</button>
    </main>
  );
}
