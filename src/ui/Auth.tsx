import { useState } from 'react';
import { api } from '../api';

/** Parent sign-in / account creation. Children don't have accounts. */
export function Auth({ onDone }: { onDone: () => void }) {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <main className="page narrow">
      <header className="hero">
        <div className="logo">SCHOOL<span>ZONE</span></div>
        <p className="tagline">Year 6 maths, English and science that levels up with you.</p>
      </header>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await (creating ? api.signup(email, password) : api.login(email, password));
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{creating ? 'Create a parent account' : 'Parent sign in'}</h2>
        <p className="muted">A parent or carer signs in on this device. Children then pick their player, no passwords needed.</p>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={creating ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {creating && <small>At least 10 characters.</small>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>{creating ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="link wide" onClick={() => { setCreating((c) => !c); setError(''); }}>
          {creating ? 'I already have an account' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}
