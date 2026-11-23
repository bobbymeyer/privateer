/**
 * Saving a run, so a reload doesn't lose it. The world state is plain data.
 *
 * A save carries a version. When the shape of the state changes, the version
 * goes up, and a save from another version is dropped rather than loaded
 * half-understood: the voyage was rebuilt at 12, and a run from the old
 * sandbox can't be sailed in it. The logbook is kept apart, and survives.
 */

import type { WorldState } from './world/world.ts';
import { muster } from './world/hands.ts';
import { startingStanding } from './world/peoples.ts';

export const SAVE_VERSION = 18;

/** From each version to the next, since the voyage was simplified (12): a run in progress shouldn't be lost to an update. */
const MIGRATIONS: Record<number, (w: Record<string, unknown>) => Record<string, unknown>> = {
  // 12 → 13: spice, and the once-a-voyage happenings.
  12: (w) => ({ ...w, spice: 0, seen: [] }),
  // 13 → 14: rumors, and the island a storm put you on.
  13: (w) => ({ ...w, rumors: [], landfall: null }),
  // 14 → 15: whose money, how lawful, and the reckoning at home. An old voyage sailed on its own stake.
  14: (w) => ({ ...w, backer: 'own', stake: 0, infamy: 0, grievance: 0, fame: 0, verdict: null, settled: { queen: 0, gentlemen: 0, gift: 0, restitution: 0, seized: 0 }, lastPrize: 0 }),
  // 15 → 16: the hands of note, mustered from the voyage's own dice, and the count of the dead.
  15: (w) => ({ ...w, hands: muster(w.rng as number), losses: {} }),
  // 16 → 17: jewels and brazilwood in the hold; no chronicler aboard an old voyage.
  16: (w) => ({ ...w, jewels: [], wood: 0 }),
  // 17 → 18: the peoples of the coasts as they stood, no truck, no company, no French commission.
  17: (w) => ({ ...w, peoples: startingStanding(), memory: {}, truck: 0, company: 0, french: false }),
};

export const SAVE_KEY = 'privateer:run';

export interface Saved {
  version: number;
  seed: number;
  world: WorldState;
  /** The date, if this is that day's voyage. */
  daily?: string | null;
}

export function encode(seed: number, world: WorldState, daily: string | null = null): string {
  return JSON.stringify({ version: SAVE_VERSION, seed, world, ...(daily ? { daily } : {}) });
}

/** The run in `text`, or null if there's none, it's from another version, or it doesn't parse. */
export function decode(text: string | null): Saved | null {
  if (!text) return null;
  try {
    const saved = JSON.parse(text) as Saved;
    if (!Number.isInteger(saved.seed) || !saved.world || !(saved.version <= SAVE_VERSION)) return null;
    let world = saved.world as unknown as Record<string, unknown>;
    for (let v = saved.version; v < SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return null;
      world = step(world);
    }
    return { version: SAVE_VERSION, seed: saved.seed, world: world as unknown as WorldState, daily: saved.daily ?? null };
  } catch {
    return null;
  }
}

/** Browser storage can be missing or refuse: a private window, a full disk. Saving is a convenience; it never breaks the game. */
export function store(seed: number, world: WorldState, daily: string | null = null): void {
  try {
    localStorage.setItem(SAVE_KEY, encode(seed, world, daily));
  } catch {
    // Nothing to do: the run goes on, unsaved.
  }
}

export function load(): Saved | null {
  try {
    return decode(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // As above.
  }
}
