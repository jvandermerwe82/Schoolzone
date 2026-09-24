import { useEffect, useState } from 'react';
import type { TeacherSchool } from '../api';

export interface TeacherTools {
  list: () => Promise<TeacherSchool[]>;
  register: (name: string) => Promise<unknown>;
  newCode: (schoolId: string) => Promise<unknown>;
}

/** For teachers: register a school for the leaderboard and get its join code. */
export function Teacher({ tools, onBack }: { tools: TeacherTools; onBack: () => void }) {
  const [schools, setSchools] = useState<TeacherSchool[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const refresh = () => tools.list().then(setSchools).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  const act = async (f: () => Promise<unknown>) => {
    setError('');
    try { await f(); await refresh(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <main className="page narrow">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who">Teachers</span>
      </header>

      <section className="card">
        <h2>🏫 Your school on the leaderboard</h2>
        <p className="muted">
          Register your school, and we'll check you work there before it goes live (usually by email to the school office).
          You then get a join code to give to parents. Pupils only appear on the pupil board if their parent switches it on,
          and then only under a code name. You won't see pupils' names or answers.
        </p>
        <form className="form" onSubmit={(e) => { e.preventDefault(); void act(async () => { await tools.register(name); setName(''); }); }}>
          <label>School's full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Oakfield Primary School, Leeds" required /></label>
          <button type="submit" className="primary">Register school</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {schools?.map((s) => (
        <section key={s.id} className="card">
          <h2>{s.name}</h2>
          {s.status === 'pending' ? (
            <p className="banner help">Waiting for us to check. We'll email you when it's approved.</p>
          ) : (
            <>
              <p>Join code for parents: <span className="join-code">{s.joinCode}</span></p>
              <p className="muted">{s.pupils} {s.pupils === 1 ? 'pupil has' : 'pupils have'} joined. Your school appears on the school board from 5 pupils.</p>
              <button onClick={() => window.confirm('Make a new code? The old one will stop working (pupils who already joined stay in).') && void act(() => tools.newCode(s.id))}>
                New join code
              </button>
            </>
          )}
        </section>
      ))}
    </main>
  );
}
