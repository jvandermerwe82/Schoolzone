import { useState } from 'react';
import { BADGES, describeReward, type Rarity } from '../brain/badges';
import { subjectReport } from '../brain/insights';
import type { Homework } from '../api';
import { skillState } from '../brain/tutor';
import { isMastered } from '../brain/model';
import type { Profile, SubjectId } from '../brain/types';
import { dayStreak, playerLevel } from '../brain/xp';
import { checkpointDue } from '../content/checkpoint';
import { getSkill, SUBJECTS } from '../content/skills';
import { isStructuredHomework } from '../curriculum/australia-teacher-objectives';
import { structuredHomeworkRoute, type AustralianPracticeRoute } from '../curriculum/australia-intent-routing';

interface Props {
  profile: Profile;
  offline: boolean;
  onPractice: (subject: SubjectId, focus?: string, teacherRoute?: AustralianPracticeRoute) => void;
  /** Topic set by the child's teacher, if any. */
  homework?: Homework | null;
  onDashboard: () => void;
  onParents: () => void;
  onInfo: () => void;
  onSettings: () => void;
  onSats: () => void;
  /** Server mode only. */
  onLeaderboard?: () => void;
  onSwitch: () => void;
}

const ZONE_ICON: Record<SubjectId, string> = { maths: '∑', english: 'Aa', science: '⚗' };
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

function PlayerCard({ profile }: { profile: Profile }) {
  const { level, into, needed } = playerLevel(profile.xp ?? 0);
  const streak = dayStreak(profile, Date.now());
  const earned = Object.keys(profile.badges ?? {}).length;
  return (
    <section className="player-card">
      <span className="avatar big">{profile.avatar}</span>
      <div className="player-info">
        <div className="player-row">
          <span className="player-name">{profile.name}</span>
          <span className="level-chip">LVL {level}</span>
        </div>
        <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={needed} aria-valuenow={into} aria-label="XP to next level">
          <div style={{ width: `${(into / needed) * 100}%` }} />
        </div>
        <div className="stat-row">
          <span>{into} / {needed} XP</span>
          <span title="Days in a row">🔥 {streak} day{streak === 1 ? '' : 's'}</span>
          <span title="Achievements">🏆 {earned}</span>
        </div>
      </div>
    </section>
  );
}

const PREVIEW = 6;

function Achievements({ profile }: { profile: Profile }) {
  const [all, setAll] = useState(false);
  // Earned first (newest first), then the rest in their usual order.
  const enabled = BADGES.filter((b) => profile.rewards?.[b.id]?.enabled ?? true);
  const got = enabled.filter((b) => profile.badges?.[b.id]).sort((a, b) => profile.badges[b.id].earnedAt - profile.badges[a.id].earnedAt);
  const ordered = [...got, ...enabled.filter((b) => !profile.badges?.[b.id])];
  const shown = all ? ordered : ordered.slice(0, PREVIEW);
  const earned = got.length;
  return (
    <section>
      <h2 className="section-title">Achievements <span className="muted">{earned}/{enabled.length}</span></h2>
      <div className="badge-grid">
        {shown.map((b) => {
          const got = profile.badges?.[b.id];
          const reward = describeReward(profile, b.id);
          const secret = b.hidden && !got;
          return (
            <div key={b.id} className={`badge ${b.rarity} ${got ? 'earned' : 'locked'}`} title={secret ? 'Secret achievement' : b.description}>
              <span className="badge-emoji">{secret ? '?' : b.emoji}</span>
              <span className="badge-name">{secret ? 'Secret' : b.name}</span>
              <span className="rarity">{RARITY_LABEL[b.rarity]}</span>
              <small>{secret ? 'Keep playing to find it' : got ? (reward ? `🎁 ${reward}` : 'Unlocked') : b.description}</small>
            </div>
          );
        })}
      </div>
      {ordered.length > PREVIEW && (
        <button className="link wide" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${ordered.length} achievements`}</button>
      )}
    </section>
  );
}

export function Home({ profile, offline, homework, onPractice, onDashboard, onParents, onInfo, onSettings, onSats, onLeaderboard, onSwitch }: Props) {
  return (
    <main className="page">
      <header className="topbar">
        <div className="logo small">SCHOOL<span>ZONE</span></div>
        <button className="link" onClick={onSwitch}>Switch player</button>
      </header>
      {offline && <p className="pill muted">Offline mode: progress is saved on this device only</p>}

      <PlayerCard profile={profile} />

      <h2 className="section-title">Choose a zone</h2>
      {homework && (() => {
        if (isStructuredHomework(homework)) {
          const route = structuredHomeworkRoute(profile, homework);
          const targetDone = route.targetProgress?.status === 'mastered';
          return (
            <button
              className="homework-banner"
              onClick={() => onPractice(route.subject, route.practiceSkillId, route)}
            >
              <span aria-hidden>📌</span>
              <span>
                <strong>From your teacher: Year {homework.yearLevel} · {homework.objective}</strong>
                <small>
                  {route.reason === 'prerequisite'
                    ? `SchoolZone is strengthening ${route.activeTitle} first, then will bring you back to the teacher's goal. `
                    : (homework.note || 'SchoolZone has chosen your personal route to this objective. ')}
                  {homework.dueAt ? `Due ${new Date(homework.dueAt).toLocaleDateString()}. ` : ''}
                  {targetDone ? 'You already have strong evidence of mastery.' : ''}
                </small>
              </span>
              <span className="zone-play">{route.reason === 'prerequisite' ? 'Build ▶' : 'Go ▶'}</span>
            </button>
          );
        }
        const skill = getSkill(homework.skillId);
        const done = isMastered(skillState(profile, skill.id));
        return (
          <button className="homework-banner" onClick={() => onPractice(skill.subject, skill.id)}>
            <span aria-hidden>📌</span>
            <span>
              <strong>From your teacher: {skill.emoji} {skill.name}</strong>
              <small>{homework.note || 'Practise this topic.'}{done ? ' You\'ve already mastered it!' : ''}</small>
            </span>
            <span className="zone-play">Go ▶</span>
          </button>
        );
      })()}

      <div className="zone-grid">
        {SUBJECTS.map((s) => {
          const reports = subjectReport(profile, s.id);
          const mastered = reports.filter((r) => r.status === 'mastered').length;
          const pct = Math.round((mastered / reports.length) * 100);
          return (
            <button key={s.id} className={`zone-card zone-${s.id}`} onClick={() => onPractice(s.id)}>
              <span className="zone-icon" aria-hidden>{ZONE_ICON[s.id]}</span>
              <span className="zone-name">{s.name}</span>
              <span className="zone-progress">{mastered}/{reports.length} skills mastered</span>
              <span className="zone-meter"><span style={{ width: `${pct}%` }} /></span>
              <span className="zone-play">Play ▶</span>
              {checkpointDue(profile, s.id, Date.now()) && <span className="zone-tag">📋 Checkpoint due</span>}
            </button>
          );
        })}
      </div>

      <button className="sats-banner" onClick={onSats}>
        <span aria-hidden>🎯</span>
        <span><strong>SATs practice</strong><small>Spelling test, arithmetic and reading papers</small></span>
        <span className="zone-play">Go ▶</span>
      </button>

      <Achievements profile={profile} />

      <div className="row footer-links">
        <button className="secondary" onClick={onDashboard}>📊 My skills</button>
        {onLeaderboard && <button className="secondary" onClick={onLeaderboard}>🏆 Leaderboard</button>}
        <button className="link" onClick={onSettings}>⚙️ Settings</button>
        <button className="link" onClick={onInfo}>🔒 Your information</button>
        <button className="link" onClick={onParents}>Parents</button>
      </div>
    </main>
  );
}
