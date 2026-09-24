import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import type { Profile } from './brain/types';
import { newProfile } from './storage';
import { ProfileSaver } from './sync';

const profile = (xp: number, answers = 0): Profile => ({
  ...newProfile('Ava', '🦊', 6), id: 'kid',
  xp, history: Array.from({ length: answers }, () => ({ at: 1, skillId: 'addition', level: 1, correct: true, timeMs: 1, predicted: 0.5 })),
});
const tick = () => new Promise((r) => setImmediate(r));

describe('profile saving', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('sends a single change straight away (no waiting for a timer)', async () => {
    const sent: number[] = [];
    const saver = new ProfileSaver(() => {}, 1500, async (_id, p, v) => { sent.push(p.xp); return { version: v + 1 }; });
    saver.setVersion('kid', 1);
    saver.save(profile(10));
    await tick();
    expect(sent).toEqual([10]);
    expect(saver.hasPending()).toBe(false);
  });

  it('combines quick changes: the first goes now, the latest goes once things settle', async () => {
    const sent: [number, number][] = [];
    const saver = new ProfileSaver(() => {}, 1500, async (_id, p, v) => { sent.push([p.xp, v]); return { version: v + 1 }; });
    saver.setVersion('kid', 1);
    saver.save(profile(1));
    saver.save(profile(2));
    saver.save(profile(3));
    await tick();
    expect(sent).toEqual([[1, 1]]);
    vi.advanceTimersByTime(1500);
    await tick();
    expect(sent).toEqual([[1, 1], [3, 2]]); // latest copy, with the version from the first save
  });

  it('never sends two saves for one child at the same time', async () => {
    let release!: () => void;
    const calls: number[] = [];
    const saver = new ProfileSaver(() => {}, 10, (_id, p, v) => {
      calls.push(p.xp);
      return calls.length === 1 ? new Promise((r) => { release = () => r({ version: v + 1 }); }) : Promise.resolve({ version: v + 1 });
    });
    saver.save(profile(1));
    saver.save(profile(2));
    vi.advanceTimersByTime(10); // the trailing save is due, but the first is still on its way
    await tick();
    expect(calls).toEqual([1]);
    release();
    await tick(); await tick();
    expect(calls).toEqual([1, 2]);
  });

  it('keeps changes when offline and tries again', async () => {
    let online = false;
    const sent: number[] = [];
    const saver = new ProfileSaver(() => {}, 1500, async (_id, p, v) => {
      if (!online) throw new Error('offline');
      sent.push(p.xp);
      return { version: v + 1 };
    });
    saver.save(profile(5));
    await tick();
    expect(saver.hasPending()).toBe(true);
    online = true;
    vi.advanceTimersByTime(10_000);
    await tick();
    expect(sent).toEqual([5]);
  });

  it('on a conflict, keeps whichever copy has more practice', async () => {
    const conflicts: Profile[] = [];
    let first = true;
    const sent: [number, number][] = [];
    const server = (answers: number) => new ApiError(409, 'conflict', { profile: profile(99, answers), version: 7 });
    // The server copy has less practice: ours is sent again on top of version 7.
    const saver = new ProfileSaver((p) => conflicts.push(p), 1500, async (_id, p, v) => {
      if (first) { first = false; throw server(0); }
      sent.push([p.xp, v]);
      return { version: v + 1 };
    });
    saver.save(profile(5, 3));
    await tick(); await tick();
    expect(sent).toEqual([[5, 7]]);
    expect(conflicts).toEqual([]);

    // The server copy has more practice: take the server's.
    const saver2 = new ProfileSaver((p) => conflicts.push(p), 1500, async () => { throw server(10); });
    saver2.save(profile(5, 3));
    await tick();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].xp).toBe(99);
  });
});
