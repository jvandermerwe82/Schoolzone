import { useState } from 'react';
import { BADGES, formatMoney, moneyTotals, parseMoney, rewardsOwed } from '../brain/badges';
import type { BadgeReward, Profile } from '../brain/types';
import { loadParentPin, saveParentPin } from '../storage';

interface Props {
  profile: Profile;
  onSave: (p: Profile) => void;
  onDone: () => void;
  /** Leave without saving (back to choosing a learner). */
  onCancel: () => void;
  /** Shown before the child's first session: rewards must be set up first. */
  firstTime: boolean;
}

/** PIN gate: create a PIN the first time, then ask for it. */
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const existing = loadParentPin();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const creating = existing === null;
  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        if (creating) {
          if (!/^\d{4}$/.test(pin)) return setError('Please use 4 digits.');
          if (pin !== confirm) return setError('The two PINs don\'t match.');
          saveParentPin(pin);
          onUnlock();
        } else if (pin === existing) onUnlock();
        else setError('That PIN isn\'t right.');
      }}
    >
      <h2>👪 Parents only</h2>
      <p className="muted">
        {creating
          ? 'Create a 4-digit parent PIN. It keeps the rewards settings for grown-ups. (It only keeps children out casually; it isn\'t strong security.)'
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
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary">{creating ? 'Create PIN' : 'Unlock'}</button>
    </form>
  );
}

export function ParentArea({ profile, onSave, onDone, onCancel, firstTime }: Props) {
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
          ? <button className="link" onClick={onCancel}>← Switch learner</button>
          : <button className="link" onClick={onDone}>← Back</button>}
        <span className="who"><span className="avatar small">{profile.avatar}</span> {profile.name}'s badges &amp; rewards</span>
      </header>

      {firstTime && (
        <p className="banner help">
          Before {profile.name} starts, a grown-up needs to decide what each badge is worth.
        </p>
      )}

      {!unlocked ? (
        <PinGate onUnlock={() => setUnlocked(true)} />
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
            <h2>🏅 What is each badge worth?</h2>
            <p className="muted">
              Write any reward you like, add an amount of money, or both. Leave both blank for "just the badge".
              Untick a badge to switch it off. Easter eggs are secret: {profile.name} only sees "???" until earning them.
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
        </>
      )}
    </main>
  );
}
