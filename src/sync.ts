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

/**
 * Version-checked profile saving that never makes the child wait:
 * - a save after a quiet spell goes to the server straight away;
 * - saves in quick succession are combined, and the latest is sent once the
 *   quiet period ends;
 * - anything still waiting is sent when the page is hidden or closed.
 */
export class ProfileSaver {
  private versions = new Map<string, number>();
  private pending = new Map<string, Profile>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();

  constructor(
    private onConflict: (serverProfile: Profile, version: number) => void,
    private delayMs = 1500,
    private send: (id: string, profile: Profile, version: number) => Promise<{ version: number }> = (id, p, v) => api.saveChild(id, p, v),
  ) {
    if (typeof window !== 'undefined') {
      const flushAll = () => { for (const id of [...this.pending.keys()]) void this.flush(id); };
      window.addEventListener('pagehide', flushAll);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
    }
  }

  setVersion(id: string, version: number): void {
    this.versions.set(id, version);
  }

  /** True while there are changes not yet confirmed by the server. */
  hasPending(): boolean {
    return this.pending.size > 0 || this.inFlight.size > 0;
  }

  save(profile: Profile): void {
    const id = profile.id;
    this.pending.set(id, profile);
    if (this.timers.has(id)) return; // a save is already scheduled; it will send the latest copy
    void this.flush(id);
    this.schedule(id, this.delayMs);
  }

  private schedule(id: string, ms: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => { this.timers.delete(id); void this.flush(id); }, ms));
  }

  async flush(id: string): Promise<void> {
    if (this.inFlight.has(id)) return; // the running save sends anything newer when it finishes
    const profile = this.pending.get(id);
    if (!profile) return;
    this.pending.delete(id);
    this.inFlight.add(id);
    let retryLater = false;
    let resendNow = false;
    try {
      const { version } = await this.send(id, profile, this.versions.get(id) ?? 1);
      this.versions.set(id, version);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { profile: Profile; version: number };
        this.versions.set(id, body.version);
        // Keep whichever copy has more practice in it, so no progress is lost.
        if ((body.profile.history?.length ?? 0) > profile.history.length) this.onConflict(body.profile, body.version);
        else {
          // Resend ours (or anything newer) on top of the server's version, straight away.
          if (!this.pending.has(id)) this.pending.set(id, profile);
          resendNow = true;
        }
      } else {
        // Offline or a server problem: keep it and try again shortly.
        if (!this.pending.has(id)) this.pending.set(id, profile);
        retryLater = true;
      }
    } finally {
      this.inFlight.delete(id);
    }
    if (retryLater) this.schedule(id, 10_000);
    else if (this.pending.has(id) && (resendNow || !this.timers.has(id))) await this.flush(id);
  }
}
