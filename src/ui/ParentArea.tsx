import { useState } from 'react';
import type { Consent } from '../api';
import { BADGES, formatMoney, moneyTotals, parseMoney, rewardsOwed } from '../brain/badges';
import type { BadgeReward, Profile } from '../brain/types';
import { checkpointsFor, score } from '../content/checkpoint';
import { SUBJECTS } from '../content/skills';

/** What the parent area can do. Server mode adds account and privacy controls. */
export interface ParentTools {
  hasPin: boolean;
  checkPin: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  /** On-device mode: remove this player from the device. */
  deleteLocal?: (childId: string) => Promise<void>;
  cloud?: {
    email: string;
    consent: Consent;
    safetyFlags: number;
    changePassword: (current: string, password: string) => Promise<void>;
    tutorAvailable: boolean;
    updateConsent: (c: { dataProcessing: boolean; aiTutor: boolean; research: boolean }) => Promise<void>;
    tutorLog: (childId: string) => Promise<{ at: number; role: string; text: string; flagged: string | null }[]>;
    deleteChild: (childId: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
    signOut: () => Promise<void>;
  };
}

interface Props {
  tools: ParentTools;
  profile: Profile;
  onSave: (p: Profile) => void;
  onDone: () => void;
  /** Leave without saving (back to choosing a learner). */
  onCancel: () => void;
  /** Shown before the child's first session: rewards must be set up first. */
  firstTime: boolean;
}

/** PIN gate: create a PIN the first time, then ask for it. */
function PinGate({ tools, onUnlock }: { tools: ParentTools; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const creating = !tools.hasPin;
  return (
    <form
      className="card form narrow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (creating) {
            if (!/^\d{4}$/.test(pin)) return setError('Please use 4 digits.');
            if (pin !== confirm) return setError('The two PINs don\'t match.');
            await tools.setPin(pin);
            onUnlock();
          } else if (await tools.checkPin(pin)) onUnlock();
          else setError('That PIN isn\'t right.');
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <h2>Parents only</h2>
      <p className="muted">
        {creating
          ? 'Create a 4-digit parent PIN to keep rewards and settings for grown-ups. It keeps children out casually; it isn\'t strong security.'
          : 'Enter the parent PIN.'}
      </p>
      <label>
        {creating ? 'New PIN' : 'PIN'}
        <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => { setPin(e.target.value); setError(''); }} autoFocus required />
      </label>
      {creating && (
        <label>
          Type it again
          <input type="password" inputMode="numeric" maxLength={4} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} required />
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary">{creating ? 'Create PIN' : 'Unlock'}</button>
    </form>
  );
}

/** Before/after checkpoint results per subject. */
function CheckpointResults({ profile }: { profile: Profile }) {
  const rows = SUBJECTS.map((s) => ({ s, done: checkpointsFor(profile, s.id) })).filter((r) => r.done.length > 0);
  return (
    <section className="card">
      <h2>Checkpoint results</h2>
      <p className="muted">
        Short fixed tests with no hints: one before {profile.name} starts a subject and another about four weeks later,
        to see how much practice is helping.
      </p>
      {rows.length === 0 && <p className="muted">No checkpoints taken yet.</p>}
      {rows.map(({ s, done }) => {
        const [first, second] = done.map(score);
        return (
          <div key={s.id} className="strategy-row">
            <span><strong>{s.name}</strong>: start {first.correct}/{first.total} ({new Date(done[0].at).toLocaleDateString()})
              {second && <> → later {second.correct}/{second.total} ({new Date(done[1].at).toLocaleDateString()})</>}</span>
            <span className="muted">{second ? `${second.pct - first.pct >= 0 ? '+' : ''}${second.pct - first.pct} points` : 'second one due later'}</span>
          </div>
        );
      })}
    </section>
  );
}

/** Account, privacy and data controls. */
function Privacy({ tools, profile }: { tools: ParentTools; profile: Profile }) {
  const cloud = tools.cloud;
  const [log, setLog] = useState<Awaited<ReturnType<NonNullable<ParentTools['cloud']>['tutorLog']>> | null>(null);
  const [msg, setMsg] = useState('');
  const [pw, setPw] = useState({ open: false, current: '', next: '', error: '', done: false });
  const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This can't be undone.`);

  if (!cloud) {
    return (
      <section className="card">
        <h2>Data on this device</h2>
        <p className="muted">Offline mode: {profile.name}'s progress is saved only in this browser. Nothing is sent anywhere.</p>
        <button className="danger" onClick={() => confirmDelete(`${profile.name}'s player and progress`) && tools.deleteLocal?.(profile.id)}>
          Delete {profile.name}'s player
        </button>
      </section>
    );
  }
  const c = cloud.consent;
  return (
    <section className="card">
      <h2>Account &amp; privacy</h2>
      {cloud.safetyFlags > 0 && (
        <p className="banner help" role="alert">
          ⚠ {cloud.safetyFlags} AI tutor {cloud.safetyFlags === 1 ? 'message was' : 'messages were'} flagged in the last 30 days.
          Please read the chats below. Flagged messages are never sent to the AI; your child was shown a message pointing them to a trusted adult and Childline (0800 1111).
        </p>
      )}
      <p className="muted">Signed in as {cloud.email}.</p>
      <label className="check">
        <input
          type="checkbox"
          checked={c.aiTutor}
          disabled={!cloud.tutorAvailable}
          onChange={async (e) => { await cloud.updateConsent({ dataProcessing: true, aiTutor: e.target.checked, research: c.research }); setMsg('Saved.'); }}
        />
        <span><strong>AI tutor</strong>: {profile.name} can ask Claude AI about a question. {!cloud.tutorAvailable && <em>(Not switched on for this server.)</em>}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.research}
          onChange={async (e) => { await cloud.updateConsent({ dataProcessing: true, aiTutor: c.aiTutor, research: e.target.checked }); setMsg(e.target.checked ? 'Saved.' : 'Saved. Stored answers have been deleted.'); }}
        />
        <span><strong>Help improve Schoolzone</strong>: keep answers without names, for up to a year. Unticking deletes them.</span>
      </label>
      {msg && <p className="muted" role="status">{msg}</p>}
      <div className="row">
        <button onClick={async () => setLog(await cloud.tutorLog(profile.id))}>Read {profile.name}'s AI tutor chats</button>
        <button onClick={() => cloud.signOut()}>Sign out</button>
      </div>
      {log && (
        <div className="chat-log">
          {log.length === 0 && <p className="muted">No tutor chats yet.</p>}
          {log.map((m, i) => (
            <p key={i} className={`chat-line ${m.role}`}>
              <small className="muted">{new Date(m.at).toLocaleString()}</small><br />
              <strong>{m.role === 'user' ? profile.name : 'AI tutor'}:</strong> {m.text}
              {m.flagged?.startsWith('safety:') && <strong className="error"> ⚠ Flagged for you to check ({m.flagged.slice(7)}). This message was not sent to the AI.</strong>}
              {m.flagged && !m.flagged.startsWith('safety:') && <em className="muted"> (the AI's reply was replaced with a safe hint: {m.flagged})</em>}
            </p>
          ))}
        </div>
      )}
      {!pw.open ? (
        <button className="link" onClick={() => setPw({ ...pw, open: true, done: false })}>Change my password</button>
      ) : (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await cloud.changePassword(pw.current, pw.next);
              setPw({ open: false, current: '', next: '', error: '', done: true });
            } catch (err) {
              setPw({ ...pw, error: (err as Error).message });
            }
          }}
        >
          <label>Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /><small>At least 10 characters. Other devices will be signed out.</small></label>
          {pw.error && <p className="error" role="alert">{pw.error}</p>}
          <div className="row"><button type="submit" className="primary">Change password</button><button type="button" onClick={() => setPw({ ...pw, open: false })}>Cancel</button></div>
        </form>
      )}
      {pw.done && <p className="muted" role="status">Password changed. Other devices have been signed out.</p>}
      <div className="row danger-zone">
        <button className="danger" onClick={() => confirmDelete(`all of ${profile.name}'s data`) && cloud.deleteChild(profile.id)}>
          Delete {profile.name}'s data
        </button>
        <button className="danger" onClick={() => confirmDelete('your account and all your children\'s data') && cloud.deleteAccount()}>
          Delete my account
        </button>
      </div>
    </section>
  );
}

export function ParentArea({ tools, profile, onSave, onDone, onCancel, firstTime }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [rewards, setRewards] = useState<Record<string, BadgeReward>>(() =>
    Object.fromEntries(BADGES.map((b) => {
      const r = profile.rewards?.[b.id]; // may be from before money rewards existed
      return [b.id, { reward: r?.reward ?? '', enabled: r?.enabled ?? true, moneyCents: r?.moneyCents ?? 0 }];
    })));
  // Money is edited as text, then checked and stored in whole cents.
  const [money, setMoney] = useState<Record<string, string>>(() =>
    Object.fromEntries(BADGES.map((b) => [b.id, profile.rewards?.[b.id]?.moneyCents ? (profile.rewards[b.id].moneyCents / 100).toFixed(2) : ''])));
  const [currency, setCurrency] = useState(profile.currency ?? '£');
  const owed = rewardsOwed(profile);
  const totals = moneyTotals(profile);
  const badMoney = BADGES.filter((b) => parseMoney(money[b.id]) === null).map((b) => b.id);

  const set = (id: string, patch: Partial<BadgeReward>) => setRewards((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  return (
    <main className="page wide-page">
      <header className="topbar">
        {firstTime
          ? <button className="link" onClick={onCancel}>← Switch player</button>
          : <button className="link" onClick={onDone}>← Back</button>}
        <span className="who"><span className="avatar small">{profile.avatar}</span> Parent area: {profile.name}</span>
      </header>

      {firstTime && (
        <p className="banner help">
          Before {profile.name} starts, a grown-up needs to decide what each achievement is worth.
        </p>
      )}

      {!unlocked ? (
        <PinGate tools={tools} onUnlock={() => setUnlocked(true)} />
      ) : (
        <>
          {owed.length > 0 && (
            <section className="card">
              <h2>🎁 Rewards to give</h2>
              {totals.earned > 0 && (
                <p className="muted">
                  Money earned {formatMoney(totals.earned, profile.currency)} · paid {formatMoney(totals.paid, profile.currency)} ·{' '}
                  <strong>still to pay {formatMoney(totals.owed, profile.currency)}</strong>
                </p>
              )}
              {owed.map(({ badge, reward }) => (
                <div key={badge.id} className="strategy-row">
                  <span>{badge.emoji} <strong>{badge.name}</strong>: {reward}</span>
                  <button onClick={() => onSave({ ...profile, badges: { ...profile.badges, [badge.id]: { ...profile.badges[badge.id], rewardGiven: true } } })}>
                    Mark as given
                  </button>
                </div>
              ))}
            </section>
          )}

          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              if (badMoney.length) return;
              const withMoney = Object.fromEntries(Object.entries(rewards).map(([id, r]) => [id, { ...r, moneyCents: parseMoney(money[id]) ?? 0 }]));
              onSave({ ...profile, rewards: withMoney, currency, rewardsSetUp: true });
              onDone();
            }}
          >
            <h2>What is each achievement worth?</h2>
            <p className="muted">
              Write any reward you like, add an amount of money, or both. Leave both blank for "just the badge".
              Untick one to switch it off. Easter eggs are secret: {profile.name} only sees "Secret" until earning them.
            </p>
            <label className="currency">
              Currency for money rewards
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['£', 'R', '$', '€'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {BADGES.map((b) => (
              <div key={b.id} className={`reward-row ${rewards[b.id].enabled ? '' : 'off'}`}>
                <label className="reward-toggle">
                  <input type="checkbox" checked={rewards[b.id].enabled} onChange={(e) => set(b.id, { enabled: e.target.checked })} />
                  <span className="badge-emoji">{b.emoji}</span>
                  <span>
                    <strong>{b.name}</strong>{b.hidden && <em> (Easter egg)</em>}
                    <br /><small className="muted">{b.description}</small>
                  </span>
                </label>
                <div className="reward-inputs">
                  <input
                    aria-label={`Reward for ${b.name}`}
                    placeholder={`e.g. ${b.suggestion}`}
                    value={rewards[b.id].reward}
                    maxLength={80}
                    disabled={!rewards[b.id].enabled}
                    onChange={(e) => set(b.id, { reward: e.target.value })}
                  />
                  <span className="money-input">
                    <span aria-hidden>{currency}</span>
                    <input
                      aria-label={`Money for ${b.name}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={money[b.id]}
                      disabled={!rewards[b.id].enabled}
                      aria-invalid={badMoney.includes(b.id)}
                      onChange={(e) => setMoney((m) => ({ ...m, [b.id]: e.target.value }))}
                    />
                  </span>
                </div>
                {badMoney.includes(b.id) && <p className="error">Please enter an amount like 2 or 2.50.</p>}
              </div>
            ))}
            <button type="submit" className="primary wide">{firstTime ? `Save and let ${profile.name} start` : 'Save rewards'}</button>
          </form>

          {!firstTime && <CheckpointResults profile={profile} />}
          {!firstTime && <Privacy tools={tools} profile={profile} />}
        </>
      )}
    </main>
  );
}
