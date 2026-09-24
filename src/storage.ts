/**
 * Profiles are saved in the browser (localStorage) for now, so the app works
 * offline with no account. A backend can replace this module later.
 */
import type { ItemStats } from './brain/items';
import { emptyHelp } from './brain/help';
import type { Profile } from './brain/types';

const KEY = 'schoolzone:v1';
const ITEMS_KEY = 'schoolzone:items:v1';

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    const profiles = raw ? (JSON.parse(raw) as (Profile & { grade?: number })[]) : [];
    // Early profiles stored `grade`; it is now `year`.
    return profiles.map(({ grade, ...p }) => ({ ...p, year: p.year ?? grade ?? 6, misconceptions: p.misconceptions ?? {}, help: p.help ?? emptyHelp(), badges: p.badges ?? {}, rewards: p.rewards ?? {}, rewardsSetUp: p.rewardsSetUp ?? false, currency: p.currency ?? '£' }));
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
    misconceptions: {},
    help: emptyHelp(),
    badges: {},
    rewards: {},
    rewardsSetUp: false,
    currency: '£',
  };
}

/** Learned question difficulties, shared by every learner on this device. */
export function loadItems(): ItemStats {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    return raw ? (JSON.parse(raw) as ItemStats) : {};
  } catch {
    return {};
  }
}

export function saveItems(items: ItemStats): void {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  } catch {
    // Keep working in memory.
  }
}

const PARENT_KEY = 'schoolzone:parent:v1';

/**
 * The parent PIN keeps children out of the rewards settings. It is stored on
 * this device only and is a light barrier, not real security.
 */
export function loadParentPin(): string | null {
  try {
    return (JSON.parse(localStorage.getItem(PARENT_KEY) ?? 'null') as { pin: string } | null)?.pin ?? null;
  } catch {
    return null;
  }
}

export function saveParentPin(pin: string): void {
  try {
    localStorage.setItem(PARENT_KEY, JSON.stringify({ pin }));
  } catch {
    // Keep working without saving.
  }
}
