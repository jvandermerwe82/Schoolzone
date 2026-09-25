/**
 * Talking to the Schoolzone server. Every call sends the session cookie.
 * If no server is reachable the app runs in on-device mode instead.
 */
import type { ItemStats } from './brain/items';
import type { Profile, Question } from './brain/types';
import type { TeacherHomework, TeacherIntentPriority } from './curriculum/australia-teacher-objectives';
import { CONSENT_VERSION } from './consent-version';
export { CONSENT_VERSION } from './consent-version';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, data);
  return data as T;
}

export interface Consent { version: string; dataProcessing: boolean; aiTutor: boolean; research: boolean; at: number }
export interface Me { email: string; emailVerified: boolean; hasPin: boolean; consent: Consent | null; tutorAvailable: boolean; /** AI tutor messages flagged for a parent to check, last 30 days. */ safetyFlags: number }
export interface ServerChild { id: string; version: number; profile: Profile }
export interface AnswerEvent {
  at: number;
  skillId: string;
  level: number;
  itemKey: string;
  correct: boolean;
  hinted: boolean;
  rapid: boolean;
  timeMs: number;
  predicted: number;
  misconception: string | null;
  strategy: string | null;

  /** Pilot Evidence v1 structured learning-process telemetry. */
  eventVersion?: number;
  sessionId?: string | null;
  sessionPosition?: number | null;
  missionLength?: number | null;
  planReason?: 'new' | 'continue' | 'review' | 'help' | 'climb' | null;
  helpEvent?: 'stuck' | 'helped' | 'switched' | 'resolved' | null;
  diagnostic?: boolean | null;
  dueReview?: boolean | null;
  curriculumId?: string | null;
  canonicalNodeId?: string | null;
  evidenceStrength?: 'direct' | 'supporting' | null;
  teacherTargetNodeId?: string | null;
  teacherRouteReason?: 'target' | 'prerequisite' | null;
  pKnownBefore?: number | null;
  pKnownAfter?: number | null;
  abilityBefore?: number | null;
  abilityAfter?: number | null;
  masteredAfter?: boolean | null;
}
export type Homework = TeacherHomework;
export interface SchoolMembership { school: { name: string } | null; codeName?: string; onBoard?: boolean; shareProgress?: boolean; homework?: Homework | null }
export type SkillStatus = 'mastered' | 'learning' | 'struggling' | 'ready' | 'locked';
export type CanonicalProgressStatus = 'not-started' | 'developing' | 'needs-support' | 'strong-evidence' | 'requires-broader-evidence' | 'mastered';
export interface ObjectiveProgress {
  status: CanonicalProgressStatus; directEvidenceCount: number; supportingEvidenceCount: number;
  weightedSuccess: number | null; confidence: number; autoMasterable: boolean; lastEvidenceAt: number | null;
}
export interface ClassPupil {
  name: string; avatar: string; lastActive: number | null; answeredThisWeek: number;
  stuck: { skill: string; level: number; since: number } | null; mistakes: string[]; skills: Record<string, SkillStatus>;
  objectiveProgress: ObjectiveProgress | null;
}
export interface ClassView {
  school: { name: string }; homework: Homework | null; joined: number; notSharing: number; pupils: ClassPupil[];
  summary: {
    skills: { skillId: string; name: string; subject: string; mastered: number; learning: number; struggling: number; notStarted: number }[];
    mistakes: { name: string; pupils: number }[];
    objective: { notStarted: number; developing: number; needsSupport: number; broaderEvidence: number; mastered: number } | null;
  };
}
export interface BoardSchool { name: string; pupils: number; score: number; rank: number; mine: boolean }
export interface BoardPupil { rank: number; codeName: string; avatar: string; score: number; me: boolean }
export interface Leaderboard {
  period: 'week' | 'all';
  weekStart: string;
  school: { name: string; pupils: number; rank: number | null; score: number | null; minPupils: number } | null;
  schools: BoardSchool[];
  pupils?: BoardPupil[];
  me?: { codeName: string; onBoard: boolean; score: number; rank: number | null };
  dailyCap?: number;
}
export interface TeacherSchool { id: string; name: string; status: 'pending' | 'approved'; pupils: number; joinCode: string | null }
export interface TutorTurn { role: 'user' | 'assistant'; content: string }

/** True if a Schoolzone server answers. */
export async function serverAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timer);
    return res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  signup: (email: string, password: string) => call<{ email: string }>('POST', '/api/auth/signup', { email, password }),
  login: (email: string, password: string) => call<{ email: string }>('POST', '/api/auth/login', { email, password }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout', {}),
  verifyEmail: (token: string) => call<{ ok: true }>('POST', '/api/auth/verify', { token }),
  resendVerification: () => call<{ ok: true }>('POST', '/api/auth/verify/resend', {}),
  forgot: (email: string) => call<{ ok: true }>('POST', '/api/auth/forgot', { email }),
  resetPassword: (token: string, password: string) => call<{ email: string }>('POST', '/api/auth/reset', { token, password }),
  changePassword: (current: string, password: string) => call<{ ok: true }>('POST', '/api/auth/password', { current, password }),
  consent: (c: Omit<Consent, 'at' | 'version'>) => call<{ ok: true }>('POST', '/api/consent', { version: CONSENT_VERSION, ...c }),
  setPin: (pin: string) => call<{ ok: true }>('POST', '/api/pin', { pin }),
  checkPin: (pin: string) => call<{ ok: boolean }>('POST', '/api/pin/check', { pin }),
  children: () => call<ServerChild[]>('GET', '/api/children'),
  createChild: (profile: Profile) => call<ServerChild>('POST', '/api/children', { profile }),
  saveChild: (id: string, profile: Profile, version: number) => call<{ version: number }>('PUT', `/api/children/${id}`, { profile, version }),
  deleteChild: (id: string) => call<{ ok: true }>('DELETE', `/api/children/${id}`),
  postEvents: (id: string, events: AnswerEvent[]) => call<{ ok: true }>('POST', `/api/children/${id}/events`, { events }),
  items: () => call<ItemStats>('GET', '/api/items'),
  tutor: (id: string, body: { question: Question; given?: string; misconception?: string; history: TutorTurn[]; message: string }) =>
    call<{ reply: string; flagged: string | null }>('POST', `/api/children/${id}/tutor`, body),
  tutorLog: (id: string) => call<{ at: number; role: string; text: string; flagged: string | null }[]>('GET', `/api/children/${id}/tutor`),
  school: (id: string) => call<SchoolMembership>('GET', `/api/children/${id}/school`),
  joinSchool: (id: string, code: string) => call<SchoolMembership>('POST', `/api/children/${id}/school`, { code }),
  updateSchool: (id: string, patch: { onBoard?: boolean; newCodeName?: boolean; shareProgress?: boolean }) => call<SchoolMembership>('PATCH', `/api/children/${id}/school`, patch),
  leaveSchool: (id: string) => call<{ ok: true }>('DELETE', `/api/children/${id}/school`),
  leaderboard: (id: string, period: 'week' | 'all') => call<Leaderboard>('GET', `/api/children/${id}/leaderboard?period=${period}`),
  mySchools: () => call<TeacherSchool[]>('GET', '/api/schools'),
  registerSchool: (name: string) => call<{ id: string }>('POST', '/api/schools', { name }),
  classView: (schoolId: string) => call<ClassView>('GET', `/api/schools/${schoolId}/class`),
  setHomework: (
    schoolId: string,
    objectiveId: string,
    note: string,
    priority: TeacherIntentPriority,
    dueAt: number | null,
  ) => call<{ homework: Homework }>('PUT', `/api/schools/${schoolId}/homework`, { objectiveId, note, priority, dueAt }),
  clearHomework: (schoolId: string) => call<{ ok: true }>('DELETE', `/api/schools/${schoolId}/homework`),
  newJoinCode: (schoolId: string) => call<{ joinCode: string }>('POST', `/api/schools/${schoolId}/code`, {}),
  deleteAccount: () => call<{ ok: true }>('DELETE', '/api/account'),
};
