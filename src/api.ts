/**
 * Talking to the Schoolzone server. Every call sends the session cookie.
 * If no server is reachable the app runs in on-device mode instead.
 */
import type { ItemStats } from './brain/items';
import type { Profile, Question } from './brain/types';

export const CONSENT_VERSION = '2026-09-v1';

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
  at: number; skillId: string; level: number; itemKey: string; correct: boolean; hinted: boolean; rapid: boolean;
  timeMs: number; predicted: number; misconception: string | null; strategy: string | null;
}
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
  deleteAccount: () => call<{ ok: true }>('DELETE', '/api/account'),
};
