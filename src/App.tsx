import { useEffect, useState } from 'react';
import type { ItemStats } from './brain/items';
import type { Profile, SubjectId } from './brain/types';
import { loadItems, loadProfiles, saveItems, saveProfiles } from './storage';
import { Dashboard } from './ui/Dashboard';
import { Home } from './ui/Home';
import { ParentArea } from './ui/ParentArea';
import { Practice } from './ui/Practice';
import { ProfilePicker } from './ui/ProfilePicker';

type Screen =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'practice'; subject: SubjectId }
  | { name: 'dashboard' }
  | { name: 'parents' };

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' });

  const [items, setItems] = useState<ItemStats>(loadItems);

  useEffect(() => saveProfiles(profiles), [profiles]);
  useEffect(() => saveItems(items), [items]);

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

  // Rewards must be set up by a parent before the child's first session.
  if (!current.rewardsSetUp || screen.name === 'parents') {
    return (
      <ParentArea
        key={current.id}
        profile={current}
        firstTime={!current.rewardsSetUp}
        onSave={updateProfile}
        onDone={() => setScreen({ name: 'home' })}
        onCancel={() => setScreen({ name: 'profiles' })}
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
          onParents={() => setScreen({ name: 'parents' })}
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
          items={items}
          onItems={setItems}
          onExit={() => setScreen({ name: 'home' })}
        />
      );
    case 'dashboard':
      return <Dashboard profile={current} items={items} onBack={() => setScreen({ name: 'home' })} />;
  }
}
