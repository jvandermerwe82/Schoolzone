/**
 * Keeps the server up to date without making the child wait:
 * - profile saves are batched (debounced) per child, with version checks;
 * - answer events go into an outbox saved on the device, sent in batches,
 *   and retried if the connection drops, so nothing is lost offline.
 */
import { api, ApiError, type AnswerEvent } from './api';
import type { Profile } from './brain/types';

const OUTBOX_KEY = 'schoolzone:outbox:v1';

type Outbox = Record<string, AnswerEvent[]>;

function readOutbox(): Outbox {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '{}') as Outbox;
  } catch {
    return {};
  }
}

function writeOutbox(o: Outbox): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(o));
  } catch {
    // Storage full or blocked: events stay in memory until sent.
  }
}

let memoryOutbox: Outbox = readOutbox();

export function queueEvent(childId: string, event: AnswerEvent): void {
  memoryOutbox = { ...memoryOutbox, [childId]: [...(memoryOutbox[childId] ?? []), event] };
  writeOutbox(memoryOutbox);
  void flushEvents();
}

let flushing = false;
export async function flushEvents(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const [childId, events] of Object.entries(memoryOutbox)) {
      for (let i = 0; i < events.length; i += 200) {
        const batch = events.slice(i, i + 200);
        try {
          await api.postEvents(childId, batch);
        } catch (err) {
          // A deleted child (404) or refused consent (403) will never succeed: drop those events.
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) continue;
          return; // Offline or server error: try again later.
        }
      }
      const { [childId]: _sent, ...rest } = memoryOutbox;
      memoryOutbox = rest;
      writeOutbox(memoryOutbox);
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.setInterval(() => void flushEvents(), 15_000);
  window.addEventListener('online', () => void flushEvents());
}

/** Debounced, version-checked profile saving. */
export class ProfileSaver {
  private versions = new Map<string, number>();
  private pending = new Map<string, Profile>();
  private timers = new Map<string, number>();

  constructor(private onConflict: (serverProfile: Profile, version: number) => void, private delayMs = 1500) {}

  setVersion(id: string, version: number): void {
    this.versions.set(id, version);
  }

  save(profile: Profile): void {
    this.pending.set(profile.id, profile);
    window.clearTimeout(this.timers.get(profile.id));
    this.timers.set(profile.id, window.setTimeout(() => void this.flush(profile.id), this.delayMs));
  }

  async flush(id: string): Promise<void> {
    const profile = this.pending.get(id);
    if (!profile) return;
    this.pending.delete(id);
    try {
      const { version } = await api.saveChild(id, profile, this.versions.get(id) ?? 1);
      this.versions.set(id, version);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { profile: Profile; version: number };
        // Keep whichever copy has more practice in it, so no progress is lost.
        if ((body.profile.history?.length ?? 0) > profile.history.length) {
          this.versions.set(id, body.version);
          this.onConflict(body.profile, body.version);
        } else {
          this.versions.set(id, body.version);
          this.pending.set(id, profile);
          await this.flush(id);
        }
      } else {
        // Offline: keep it and try again shortly.
        this.pending.set(id, profile);
        this.timers.set(id, window.setTimeout(() => void this.flush(id), 10_000));
      }
    }
  }
}
