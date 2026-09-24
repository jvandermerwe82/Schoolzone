import type { Profile } from '../brain/types';

interface Props {
  profile: Profile;
  offline: boolean;
  tutorOn: boolean;
  onBack: () => void;
}

/**
 * A short, child-friendly explanation of what Schoolzone keeps and why
 * (ICO Children's Code, standard 4: transparency). The full notice for
 * parents is in docs/privacy-notice.md.
 */
export function YourInfo({ profile, offline, tutorOn, onBack }: Props) {
  return (
    <main className="page narrow">
      <header className="topbar">
        <button className="link" onClick={onBack}>← Back</button>
        <span className="who"><span className="avatar small">{profile.avatar}</span> Your information</span>
      </header>

      <section className="card info-page">
        <h2>🔒 What Schoolzone knows about you</h2>
        <ul>
          <li>Your <strong>player name</strong>, your <strong>school year</strong> and your <strong>avatar</strong>.</li>
          <li>Your <strong>answers</strong>: which ones you got right, how long you took and whether you used hints.</li>
          <li>Your <strong>XP, badges and checkpoint scores</strong>.</li>
        </ul>
        <p>We never ask for your surname, your address, your school, your birthday or a photo of you. Please don't type them in.</p>

        <h2>🧠 Why</h2>
        <p>So Schoolzone can pick questions that are just right for you, spot mistakes that keep happening, and find a different way to help when you're stuck.</p>

        <h2>👀 Who can see it</h2>
        <ul>
          <li><strong>Your grown-up</strong> can see your progress{tutorOn ? ' and everything you write to the AI tutor' : ''}.</li>
          <li>{offline
            ? 'On this device, your progress is saved only in this web browser.'
            : 'It is saved safely on Schoolzone\'s computer so it\'s there next time. The people who run Schoolzone can only look at it to keep the app working.'}</li>
          <li>We don't show adverts, and we don't sell your information.</li>
        </ul>

        {tutorOn && (
          <>
            <h2>🤖 The AI tutor</h2>
            <p>The tutor is a computer program, not a person. What you type to it is sent to the company that makes it (Anthropic) so it can reply. Your grown-up can read your chats.</p>
            <p>If something is worrying you, the tutor isn't the right place. Talk to a grown-up you trust, or call <strong>Childline on 0800 1111</strong> (free, and it won't show on the phone bill).</p>
          </>
        )}

        <h2>🗑️ Deleting</h2>
        <p>Your grown-up can delete your information at any time in the Parents area.{offline ? '' : ' Some things, like old tutor chats, are also deleted automatically after a while.'}</p>

        <p className="muted">Questions? Ask your grown-up. They can read the full privacy notice.</p>
      </section>
    </main>
  );
}
