import { useEffect, useState } from 'react';
import type { Profile, SubjectId } from './brain/types';
import { loadProfiles, saveProfiles } from './storage';
import { Dashboard } from './ui/Dashboard';
import { Home } from './ui/Home';
import { Practice } from './ui/Practice';
import { ProfilePicker } from './ui/ProfilePicker';

type Screen =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'practice'; subject: SubjectId }
  | { name: 'dashboard' };

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' });

  useEffect(() => saveProfiles(profiles), [profiles]);

  const current = profiles.find((p) => p.id === currentId) ?? null;
  const updateProfile = (p: Profile) => setProfiles((all) => all.map((x) => (x.id === p.id ? p : x)));

  if (!current || screen.name === 'profiles') {
    return (
      <ProfilePicker
        profiles={profiles}
        onPick={(id) => { setCurrentId(id); setScreen({ name: 'home' }); }}
        onCreate={(p) => { setProfiles((all) => [...all, p]); setCurrentId(p.id); setScreen({ name: 'home' }); }}
        onDelete={(id) => setProfiles((all) => all.filter((p) => p.id !== id))}
      />
    );
  }

  switch (screen.name) {
    case 'home':
      return (
        <Home
          profile={current}
          onPractice={(subject) => setScreen({ name: 'practice', subject })}
          onDashboard={() => setScreen({ name: 'dashboard' })}
          onSwitch={() => setScreen({ name: 'profiles' })}
        />
      );
    case 'practice':
      return (
        <Practice
          key={`${current.id}-${screen.subject}`}
          profile={current}
          subject={screen.subject}
          onUpdate={updateProfile}
          onExit={() => setScreen({ name: 'home' })}
        />
      );
    case 'dashboard':
      return <Dashboard profile={current} onBack={() => setScreen({ name: 'home' })} />;
  }
}
