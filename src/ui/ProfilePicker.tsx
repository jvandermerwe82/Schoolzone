import { useState } from 'react';
import type { Profile } from '../brain/types';
import { playerLevel } from '../brain/xp';
import { newProfile } from '../storage';

export const AVATARS = ['🐉', '🦊', '🐺', '🦈', '🦅', '🐯', '🤖', '👾', '🥷', '🧙', '⚡', '🔥', '🎧', '🎮', '⚽', '🛹', '🏀', '🚀'];

interface Props {
  profiles: Profile[];
  error?: string;
  notice?: string;
  offline: boolean;
  /** Shown when a parent hasn't confirmed their email yet. */
  verify?: { email: string; resend: () => Promise<void>; recheck: () => Promise<void> };
  onPick: (id: string) => void;
  onCreate: (p: Profile) => void;
}

export function ProfilePicker({ profiles, error, notice, offline, verify, onPick, onCreate }: Props) {
  // null = not chosen yet: show the form only when there are no players (players may arrive from the server after mounting).
  const [addingChoice, setAdding] = useState<boolean | null>(null);
  const adding = addingChoice ?? profiles.length === 0;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [year, setYear] = useState(6);
  const [resent, setResent] = useState('');

  return (
    <main className="page">
      <header className="hero">
        <div className="logo">SCHOOL<span>ZONE</span></div>
        <p className="tagline">Level up your maths, English and science.</p>
        {offline && <p className="pill muted">Offline mode: progress is saved on this device only</p>}
      </header>

      {notice && <p className="banner new" role="status">{notice}</p>}
      {verify && (
        <div className="banner help" role="alert">
          <p style={{ margin: 0 }}>
            <strong>Parents: please confirm your email.</strong> We sent a link to {verify.email}. You'll need it before adding a player.
          </p>
          <div className="row">
            <button onClick={async () => { try { await verify.resend(); setResent('Sent again. Check your inbox and spam folder.'); } catch (e) { setResent((e as Error).message); } }}>
              Send the link again
            </button>
            <button className="link" onClick={() => void verify.recheck()}>I've confirmed it</button>
          </div>
          {resent && <p className="muted" role="status">{resent}</p>}
        </div>
      )}

      {!adding && (
        <section>
          <h2 className="section-title">Who's playing?</h2>
          <div className="player-grid">
            {profiles.map((p) => (
              <button key={p.id} className="player-tile" onClick={() => onPick(p.id)}>
                <span className="avatar">{p.avatar}</span>
                <span className="player-name">{p.name}</span>
                <span className="pill">LVL {playerLevel(p.xp ?? 0).level}</span>
              </button>
            ))}
            <button className="player-tile add" onClick={() => setAdding(true)}>
              <span className="avatar">＋</span>
              <span className="player-name">New player</span>
            </button>
          </div>
        </section>
      )}

      {adding && (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onCreate(newProfile(name.trim(), avatar, year));
          }}
        >
          <h2>New player</h2>
          <label>
            First name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus required />
            <small>First name or a nickname only.</small>
          </label>
          <fieldset>
            <legend>Choose your avatar</legend>
            <div className="avatar-row">
              {AVATARS.map((a) => (
                <button type="button" key={a} className={a === avatar ? 'avatar-opt selected' : 'avatar-opt'}
                  onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`} aria-pressed={a === avatar}>
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            School year
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
            <small>Just a starting point. Schoolzone works out your level as you play.</small>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="primary">Create player</button>
            {profiles.length > 0 && <button type="button" onClick={() => setAdding(false)}>Cancel</button>}
          </div>
        </form>
      )}
    </main>
  );
}
