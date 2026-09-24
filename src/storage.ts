/**
 * Profiles are saved in the browser (localStorage) for now, so the app works
 * offline with no account. A backend can replace this module later.
 */
import type { Profile } from './brain/types';

const KEY = 'schoolzone:v1';

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
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

export function newProfile(name: string, avatar: string, grade: number): Profile {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    avatar,
    grade,
    createdAt: Date.now(),
    skills: {},
    history: [],
    recentQuestionIds: [],
  };
}
