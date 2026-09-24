import { useEffect, useState } from 'react';
import type { Leaderboard as Board } from '../api';
import type { Profile } from '../brain/types';

interface Props {
  profile: Profile;
  load: (period: 'week' | 'all') => Promise<Board>;
  onBack: () => void;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const place = (rank: number) => MEDAL[rank - 1] ?? `#${rank}`;

/**
 * School and pupil leaderboards. Pupils are shown only by code name, and
 * only if a parent switched it on. Wording stays neutral: no pressure to
 * keep playing (ICO Children's Code, standards 5 and 13).
 */
export function Leaderboard({ profile, load, onBack }: Props) {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    setBoard(null); // never show one period's numbers under the other's label
    load(period).then((b) => live && setBoard(b)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [load, period]);

  const unit = board?.period === 'all' ? 'XP' : 'pts';
  return (
    <main className="page narrow">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who"><span className="avatar small">{profile.avatar}</span> Leaderboard</span>
      </header>

      <div className="tabs" role="tablist" aria-label="Leaderboard period">
        <button role="tab" aria-selected={period === 'week'} className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>This week</button>
        <button role="tab" aria-selected={period === 'all'} className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>All time</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!board && !error && <p className="loading">Loading…</p>}

      {board && (
        <>
          {!board.school && (
            <section className="card center">
              <h2>🏫 Join your school</h2>
              <p>Ask a grown-up to enter your school's join code in the Parents area. Then you can help your school climb the board!</p>
            </section>
          )}

          {board.school && board.me && (
            <section className="card board-me">
              <p className="eyebrow">{board.school.name}</p>
              <p className="big">{board.me.score} {unit}</p>
              <p className="muted">
                {period === 'week' ? 'Your points this week. ' : 'Your XP. '}
                {board.me.onBoard
                  ? <>You're on the board as <strong>{board.me.codeName}</strong>{board.me.rank ? `, ${place(board.me.rank)}` : ''}.</>
                  : 'You\'re not shown on the pupil board. A grown-up can switch that on.'}
              </p>
            </section>
          )}

          <section className="card">
            <h2>🏆 Schools</h2>
            <p className="muted small">{period === 'week' ? 'Average points per pupil this week.' : 'Average XP per pupil.'}</p>
            {board.schools.length === 0 && <p className="muted">No schools on the board yet.</p>}
            <ol className="board">
              {board.schools.map((s) => (
                <li key={`${s.rank}-${s.name}`} className={s.mine ? 'mine' : ''}>
                  <span className="board-rank">{place(s.rank)}</span>
                  <span className="board-name">{s.name}<small>{s.pupils} pupils</small></span>
                  <span className="board-score">{s.score} {unit}</span>
                </li>
              ))}
            </ol>
            {board.school && board.school.rank === null && (
              <p className="muted small">{board.school.name} will appear once {board.school.minPupils} pupils have joined ({board.school.pupils} so far).</p>
            )}
          </section>

          {board.school && board.pupils && (
            <section className="card">
              <h2>⚡ Top players at {board.school.name}</h2>
              {board.pupils.length === 0 && <p className="muted">No one on the board yet{period === 'week' ? ' this week' : ''}.</p>}
              <ol className="board">
                {board.pupils.map((p) => (
                  <li key={`${p.rank}-${p.codeName}`} className={p.me ? 'mine' : ''}>
                    <span className="board-rank">{place(p.rank)}</span>
                    <span className="board-name"><span aria-hidden>{p.avatar}</span> {p.codeName}{p.me && <small>You</small>}</span>
                    <span className="board-score">{p.score} {unit}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {period === 'week' && (
            <p className="muted small center">
              Points: 10 for a right answer, 5 with a hint, 2 for a good try. Up to {board.dailyCap ?? 300} a day, so short sessions are just as good. New week every Monday.
            </p>
          )}
        </>
      )}
    </main>
  );
}
