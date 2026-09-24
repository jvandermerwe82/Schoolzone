/**
 * Profiles are saved in the browser (localStorage) for now, so the app works
 * offline with no account. A backend can replace this module later.
 */
import type { Profile } from './brain/types';

const KEY = 'schoolzone:v1';

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    const profiles = raw ? (JSON.parse(raw) as (Profile & { grade?: number })[]) : [];
    // Early profiles stored `grade`; it is now `year`.
    return profiles.map(({ grade, ...p }) => ({ ...p, year: p.year ?? grade ?? 6 }));
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: Profile[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profiles));
  } catch {
    // Storage full or blocked (e.g. private mode): keep working in memory.
  }
}

export function newProfile(name: string, avatar: string, year: number): Profile {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    avatar,
    year,
    createdAt: Date.now(),
    skills: {},
    history: [],
    recentQuestionIds: [],
  };
}
