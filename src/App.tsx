import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, serverAvailable, type AnswerEvent, type Homework, type Me } from './api';
import type { ItemStats } from './brain/items';
import type { Profile, SubjectId } from './brain/types';
import { loadItems, loadParentPin, loadProfiles, normalizeProfile, saveItems, saveParentPin, saveProfiles } from './storage';
import { flushEvents, ProfileSaver, queueEvent } from './sync';
import { Auth, ResetPassword } from './ui/Auth';
import { checkpointDue, type Form } from './content/checkpoint';
import { Checkpoint } from './ui/Checkpoint';
import { Consent } from './ui/Consent';
import { YourInfo } from './ui/YourInfo';
import { Leaderboard } from './ui/Leaderboard';
import { Settings } from './ui/Settings';
import { Sats } from './ui/Sats';
import { Teacher, type TeacherTools } from './ui/Teacher';
import { Dashboard } from './ui/Dashboard';
import { Home } from './ui/Home';
import { ParentArea, type ParentTools } from './ui/ParentArea';
import { Practice, type TutorFn } from './ui/Practice';
import { ProfilePicker } from './ui/ProfilePicker';
import { isStructuredHomework, syncTeacherHomeworkIntent } from './curriculum/australia-teacher-objectives';
import { structuredHomeworkRoute, type AustralianPracticeRoute } from './curriculum/australia-intent-routing';

type Screen =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'practice'; subject: SubjectId; focus?: string; teacherRoute?: AustralianPracticeRoute }
  | { name: 'checkpoint'; subject: SubjectId; form: Form; which: 'first' | 'second'; focus?: string; teacherRoute?: AustralianPracticeRoute }
  | { name: 'dashboard' }
  | { name: 'info' }
  | { name: 'leaderboard' }
  | { name: 'teacher' }
  | { name: 'settings' }
  | { name: 'sats' }
  | { name: 'parents' };

/** 'cloud' when a Schoolzone server is reachable; otherwise everything stays on this device. */
type Mode = 'checking' | 'local' | 'cloud';

// Stable objects, so screens that load data on mount don't reload on every render.
const SCHOOL_TOOLS = {
  get: (childId: string) => api.school(childId),
  join: (childId: string, code: string) => api.joinSchool(childId, code),
  update: (childId: string, patch: { onBoard?: boolean; newCodeName?: boolean; shareProgress?: boolean }) => api.updateSchool(childId, patch),
  leave: async (childId: string) => { await api.leaveSchool(childId); },
};
const TEACHER_TOOLS: TeacherTools = {
  list: () => api.mySchools(),
  classView: (schoolId) => api.classView(schoolId),
  setHomework: (schoolId, objectiveId, note, priority, dueAt) => api.setHomework(schoolId, objectiveId, note, priority, dueAt),
  clearHomework: (schoolId) => api.clearHomework(schoolId),
  register: (name) => api.registerSchool(name),
  newCode: (schoolId) => api.newJoinCode(schoolId),
};

export function App() {
  const [mode, setMode] = useState<Mode>('checking');
  const [me, setMe] = useState<Me | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [items, setItems] = useState<ItemStats>(loadItems);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /** Checkpoints put off with "Later" this session (asked again next time). */
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  // Links from emails: ?verify=… confirms the email, ?reset=… opens the new-password form.
  const [links] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return { verify: q.get('verify'), reset: q.get('reset') };
  });
  const [resetToken, setResetToken] = useState(links.reset);
  const clearLink = () => window.history.replaceState(null, '', window.location.pathname);

  const saver = useRef<ProfileSaver | null>(null);
  if (!saver.current && typeof window !== 'undefined') {
    saver.current = new ProfileSaver((serverProfile) => {
      const p = normalizeProfile(serverProfile);
      setProfiles((all) => all.map((x) => (x.id === p.id ? p : x)));
    });
  }

  const loadCloud = useCallback(async () => {
    try {
      const who = await api.me();
      setMe(who);
      if (!who.consent) return;
      const children = await api.children();
      children.forEach((c) => saver.current!.setVersion(c.id, c.version));
      setProfiles(children.map((c) => normalizeProfile({ ...c.profile, id: c.id })));
      const shared = await api.items().catch(() => null);
      if (shared) setItems((local) => ({ ...local, ...shared }));
      void flushEvents();
    } catch {
      setMe(null); // not signed in
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (await serverAvailable()) {
        setMode('cloud');
        if (links.verify) {
          try {
            await api.verifyEmail(links.verify);
            setNotice('Email confirmed. Thank you!');
          } catch (e) {
            setNotice((e as Error).message);
          }
          clearLink();
        }
        await loadCloud();
      } else {
        setMode('local');
        setProfiles(loadProfiles());
      }
    })();
  }, [loadCloud, links.verify]);

  // Mirror both local and cloud profiles into browser storage on the permanent app origin.
  // The server remains authoritative in cloud mode; this copy prevents a temporary
  // backend outage or deploy from presenting an empty learner profile.
  useEffect(() => {
    if (mode !== 'checking') saveProfiles(profiles);
  }, [mode, profiles]);
  useEffect(() => saveItems(items), [items]);

  const current = profiles.find((p) => p.id === currentId) ?? null;

  const updateProfile = useCallback((p: Profile) => {
    setProfiles((all) => all.map((x) => (x.id === p.id ? p : x)));
    if (mode === 'cloud') saver.current!.save(p);
  }, [mode]);

  const createProfile = async (p: Profile) => {
    setError('');
    if (mode === 'cloud') {
      try {
        const created = await api.createChild(p);
        saver.current!.setVersion(created.id, created.version);
        const np = normalizeProfile({ ...created.profile, id: created.id });
        setProfiles((all) => [...all, np]);
        setCurrentId(np.id);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    } else {
      setProfiles((all) => [...all, p]);
      setCurrentId(p.id);
    }
    setScreen({ name: 'home' });
  };

  const deleteProfile = async (id: string) => {
    if (mode === 'cloud') await api.deleteChild(id);
    setProfiles((all) => all.filter((p) => p.id !== id));
    setCurrentId(null);
    setScreen({ name: 'profiles' });
  };

  const onAnswer = useCallback((childId: string, e: AnswerEvent) => {
    if (mode === 'cloud') queueEvent(childId, e);
  }, [mode]);

  // The current child's display settings apply to the whole page.
  const look = current?.settings;
  useEffect(() => {
    const root = document.documentElement.classList;
    root.toggle('easy-read', !!look?.easyRead);
    root.toggle('big-text', !!look?.bigText);
    root.toggle('calm', !!look?.calm);
  }, [look?.easyRead, look?.bigText, look?.calm]);

  const currentKey = current?.id;

  // Homework set by the child's teacher (server mode, if they've joined a school).
  const [homework, setHomework] = useState<Homework | null>(null);
  const onHome = screen.name === 'home';
  useEffect(() => {
    setHomework(null);
    if (mode !== 'cloud' || !currentKey || !onHome) return;
    let live = true;
    api.school(currentKey).then((m) => {
      if (!live) return;
      const nextHomework = m.homework ?? null;
      setHomework(nextHomework);
      if (current) {
        const intelligence = syncTeacherHomeworkIntent(current.learningIntelligence!, nextHomework, current.year);
        if (intelligence !== current.learningIntelligence) updateProfile({ ...current, learningIntelligence: intelligence });
      }
    }).catch(() => {});
    return () => { live = false; };
  }, [mode, currentKey, onHome]);

  /** Start practising a subject (optionally a particular skill), with the checkpoint first if it's due. */
  const startPractice = (subject: SubjectId, focus?: string, teacherRoute?: AustralianPracticeRoute) => {
    if (!current) return;
    const due = checkpointDue(current, subject, Date.now());
    setScreen(due && !deferred.has(`${current.id}:${subject}`)
      ? { name: 'checkpoint', subject, form: due.form, which: due.which, focus, teacherRoute }
      : { name: 'practice', subject, focus, teacherRoute });
  };
  const loadBoard = useCallback((period: 'week' | 'all') => api.leaderboard(currentKey!, period), [currentKey]);

  const tutor: TutorFn | undefined = useMemo(() => {
    if (mode !== 'cloud' || !me?.tutorAvailable || !me.consent?.aiTutor || !current) return undefined;
    const id = current.id;
    return (body) => api.tutor(id, body);
  }, [mode, me, current]);

  const parentTools: ParentTools = mode === 'cloud' && me
    ? {
        hasPin: me.hasPin,
        checkPin: async (pin) => (await api.checkPin(pin)).ok,
        setPin: async (pin) => { await api.setPin(pin); setMe({ ...me, hasPin: true }); },
        cloud: {
          email: me.email,
          consent: me.consent!,
          safetyFlags: me.safetyFlags,
          changePassword: async (current, password) => { await api.changePassword(current, password); },
          tutorAvailable: me.tutorAvailable,
          updateConsent: async (c) => { await api.consent(c); await loadCloud(); },
          tutorLog: (childId) => api.tutorLog(childId),
          deleteChild: deleteProfile,
          school: SCHOOL_TOOLS,
          deleteAccount: async () => { await api.deleteAccount(); setMe(null); setProfiles([]); setScreen({ name: 'profiles' }); },
          signOut: async () => { await api.logout(); setMe(null); setProfiles([]); setScreen({ name: 'profiles' }); },
        },
      }
    : {
        hasPin: loadParentPin() !== null,
        checkPin: async (pin) => pin === loadParentPin(),
        setPin: async (pin) => saveParentPin(pin),
        deleteLocal: deleteProfile,
      };

  if (mode === 'checking') {
    return <main className="page center-screen"><p className="loading">Loading Schoolzone…</p></main>;
  }
  if (mode === 'cloud' && resetToken) {
    const leave = () => { clearLink(); setResetToken(null); };
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => { leave(); setNotice('Password changed. You are signed in.'); void loadCloud(); }}
        onCancel={leave}
      />
    );
  }
  if (mode === 'cloud' && !me) return <Auth onDone={loadCloud} notice={notice} />;
  if (mode === 'cloud' && me && !me.consent) return <Consent tutorAvailable={me.tutorAvailable} onDone={loadCloud} />;

  if (screen.name === 'teacher' && mode === 'cloud') {
    return <Teacher tools={TEACHER_TOOLS} onBack={() => setScreen({ name: 'profiles' })} />;
  }

  if (!current || screen.name === 'profiles' || screen.name === 'teacher') {
    return (
      <ProfilePicker
        profiles={profiles}
        error={error}
        notice={notice}
        offline={mode === 'local'}
        verify={mode === 'cloud' && me && !me.emailVerified
          ? { email: me.email, resend: async () => { await api.resendVerification(); }, recheck: loadCloud }
          : undefined}
        onPick={(id) => { setCurrentId(id); setScreen({ name: 'home' }); }}
        onCreate={createProfile}
        onTeacher={mode === 'cloud' && me?.emailVerified ? () => setScreen({ name: 'teacher' }) : undefined}
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
        tools={parentTools}
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
          offline={mode === 'local'}
          onPractice={startPractice}
          homework={homework}
          onDashboard={() => setScreen({ name: 'dashboard' })}
          onParents={() => setScreen({ name: 'parents' })}
          onInfo={() => setScreen({ name: 'info' })}
          onSettings={() => setScreen({ name: 'settings' })}
          onSats={() => setScreen({ name: 'sats' })}
          onLeaderboard={mode === 'cloud' ? () => setScreen({ name: 'leaderboard' }) : undefined}
          onSwitch={() => setScreen({ name: 'profiles' })}
        />
      );
    case 'practice':
      return (
        <Practice
          key={`${current.id}-${screen.subject}-${screen.teacherRoute?.activeCanonicalNodeId ?? 'general'}`}
          profile={current}
          subject={screen.subject}
          focusSkill={screen.focus}
          teacherRoute={screen.teacherRoute}
          onNextTeacherMission={screen.teacherRoute ? (profile) => {
            if (homework && isStructuredHomework(homework)) {
              const route = structuredHomeworkRoute(profile, homework);
              setScreen({
                name: 'practice',
                subject: route.subject,
                focus: route.practiceSkillId,
                teacherRoute: route,
              });
            } else {
              setScreen({ name: 'home' });
            }
          } : undefined}
          onUpdate={updateProfile}
          items={items}
          onItems={setItems}
          onAnswer={onAnswer}
          tutor={tutor}
          onExit={() => setScreen({ name: 'home' })}
        />
      );
    case 'checkpoint':
      return (
        <Checkpoint
          key={`${current.id}-${screen.subject}-${screen.form}`}
          profile={current}
          subject={screen.subject}
          form={screen.form}
          which={screen.which}
          onFinish={(p) => {
            updateProfile(p);
            setScreen({
              name: 'practice',
              subject: screen.subject,
              focus: screen.focus,
              teacherRoute: screen.teacherRoute,
            });
          }}
          onLater={() => {
            setDeferred((d) => new Set(d).add(`${current.id}:${screen.subject}`));
            setScreen({
              name: 'practice',
              subject: screen.subject,
              focus: screen.focus,
              teacherRoute: screen.teacherRoute,
            });
          }}
        />
      );
    case 'dashboard':
      return <Dashboard profile={current} items={items} onBack={() => setScreen({ name: 'home' })} />;
    case 'sats':
      return <Sats key={current.id} profile={current} onSave={updateProfile} onBack={() => setScreen({ name: 'home' })} />;
    case 'settings':
      return <Settings profile={current} onSave={updateProfile} onBack={() => setScreen({ name: 'home' })} />;
    case 'leaderboard':
      return <Leaderboard profile={current} load={loadBoard} onBack={() => setScreen({ name: 'home' })} />;
    case 'info':
      return <YourInfo profile={current} offline={mode === 'local'} tutorOn={!!tutor} onBack={() => setScreen({ name: 'home' })} />;
  }
}
