import { subjectReport } from '../brain/insights';
import type { Profile, SubjectId } from '../brain/types';
import { SUBJECTS } from '../content/skills';

interface Props {
  profile: Profile;
  onPractice: (subject: SubjectId) => void;
  onDashboard: () => void;
  onSwitch: () => void;
}

export function Home({ profile, onPractice, onDashboard, onSwitch }: Props) {
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

      <button className="secondary wide" onClick={onDashboard}>📊 See what the brain has learned</button>
    </main>
  );
}
