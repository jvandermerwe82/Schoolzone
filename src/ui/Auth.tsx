import { useState } from 'react';
import { api } from '../api';

type Mode = 'signin' | 'create' | 'forgot';

/** Parent sign-in, account creation and "forgot password". Children don't have accounts. */
export function Auth({ onDone, notice }: { onDone: () => void; notice?: string }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchTo = (m: Mode) => { setMode(m); setError(''); setSent(false); };
  const title = mode === 'create' ? 'Create a parent account' : mode === 'forgot' ? 'Reset your password' : 'Parent sign in';

  return (
    <main className="page narrow">
      <header className="hero">
        <div className="logo">SCHOOL<span>ZONE</span></div>
        <p className="tagline">Year 6 maths, English and science that levels up with you.</p>
      </header>
      {notice && <p className="banner new" role="status">{notice}</p>}
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            if (mode === 'forgot') {
              await api.forgot(email);
              setSent(true);
            } else {
              await (mode === 'create' ? api.signup(email, password) : api.login(email, password));
              onDone();
            }
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{title}</h2>
        {mode !== 'forgot' && (
          <p className="muted">A parent or carer signs in on this device. Children then pick their player, no passwords needed.</p>
        )}
        {mode === 'forgot' && !sent && <p className="muted">Enter your email and we'll send you a link to choose a new password.</p>}
        {sent ? (
          <p role="status">If there's an account for <strong>{email}</strong>, we've sent a link. It works once and expires in 1 hour. Check your spam folder too.</p>
        ) : (
          <>
            <label>
              Email
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {mode !== 'forgot' && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                  minLength={mode === 'create' ? 10 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {mode === 'create' && <small>At least 10 characters.</small>}
              </label>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="primary wide" disabled={busy}>
              {mode === 'create' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          </>
        )}
        {mode === 'signin' && <button type="button" className="link wide" onClick={() => switchTo('forgot')}>Forgot password?</button>}
        <button type="button" className="link wide" onClick={() => switchTo(mode === 'create' ? 'signin' : mode === 'forgot' ? 'signin' : 'create')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Back to sign in'}
        </button>
      </form>
    </main>
  );
}

/** Opened from the emailed reset link. */
export function ResetPassword({ token, onDone, onCancel }: { token: string; onDone: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="page narrow">
      <header className="hero"><div className="logo">SCHOOL<span>ZONE</span></div></header>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== again) return setError('The two passwords don\'t match.');
          setBusy(true);
          try {
            await api.resetPassword(token, password);
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Choose a new password</h2>
        <p className="muted">This signs you out on every other device.</p>
        <label>
          New password
          <input type="password" autoComplete="new-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <small>At least 10 characters.</small>
        </label>
        <label>
          Type it again
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>Save new password</button>
        <button type="button" className="link wide" onClick={onCancel}>Back to sign in</button>
      </form>
    </main>
  );
}
