import { useState } from 'react';
import type { Profile } from '../brain/types';
import { newProfile } from '../storage';

const AVATARS = ['🦁', '🐼', '🦊', '🐸', '🐙', '🦄', '🐯', '🐧', '🚀', '⭐'];

interface Props {
  profiles: Profile[];
  onPick: (id: string) => void;
  onCreate: (p: Profile) => void;
  onDelete: (id: string) => void;
}

export function ProfilePicker({ profiles, onPick, onCreate, onDelete }: Props) {
  const [adding, setAdding] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [year, setYear] = useState(6);

  return (
    <main className="page">
      <header className="hero">
        <h1>Schoolzone</h1>
        <p>Practice that learns with you.</p>
      </header>

      {!adding && (
        <section>
          <h2>Who's learning today?</h2>
          <div className="profile-grid">
            {profiles.map((p) => (
              <div key={p.id} className="profile-card">
                <button className="profile-pick" onClick={() => onPick(p.id)}>
                  <span className="avatar">{p.avatar}</span>
                  <span>{p.name}</span>
                </button>
                <button
                  className="link danger"
                  onClick={() => { if (confirm(`Delete ${p.name}'s profile and progress?`)) onDelete(p.id); }}
                >
                  Delete
                </button>
              </div>
            ))}
            <button className="profile-card add" onClick={() => setAdding(true)}>
              <span className="avatar">➕</span>
              <span>Add a learner</span>
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
          <h2>New learner</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus required />
          </label>
          <fieldset>
            <legend>Pick an avatar</legend>
            <div className="avatar-row">
              {AVATARS.map((a) => (
                <button type="button" key={a} className={a === avatar ? 'avatar-opt selected' : 'avatar-opt'}
                  onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`}>
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
            <small>Only a starting point. The app works out the right level from the answers.</small>
          </label>
          <div className="row">
            <button type="submit" className="primary">Start learning</button>
            {profiles.length > 0 && <button type="button" onClick={() => setAdding(false)}>Cancel</button>}
          </div>
        </form>
      )}
    </main>
  );
}
