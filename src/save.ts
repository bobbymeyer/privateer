/**
 * Saving a run, so a reload doesn't lose it. The world state is plain data
 * but for the chart, a byte per node, which goes into the JSON as base64.
 *
 * A save carries a version. When the shape of the state changes, the version
 * goes up, and a step in `MIGRATIONS` brings an older save up to date —
 * people have runs in progress, and an update shouldn't sink them. A save
 * from a version with no way forward, or from a newer one, is dropped
 * rather than loaded half-understood.
 */

import { SHIP_CLASSES } from './outfit.ts';
import type { WorldState } from './world/world.ts';

export const SAVE_VERSION = 11;

/** From each version to the next. A run from before a feature simply goes without it. */
const MIGRATIONS: Record<number, (world: Record<string, unknown>) => Record<string, unknown>> = {
  // 2: renown, and the home stretch. The corsairs aren't in an older run's fleet.
  1: (w) => ({ ...w, fame: 0, homewardNoised: false }),
  // 3: prize cards, struck cards, a prize's stores waiting on a choice.
  2: (w) => ({ ...w, spoil: null, outfit: { prizes: [], struck: [], ...(w.outfit as object) } }),
  // 4: events that ask you something; shares promised to the crew.
  3: (w) => ({ ...w, dilemma: null, promised: false }),
  // 5: towns on their guard after a raid.
  4: (w) => ({ ...w, guarded: {} }),
  // 6: letters of marque. A run from before them is won the old way.
  5: (w) => ({ ...w, letter: null, acts: 0, commission: w.pirate ? 'revoked' : 'legacy' }),
  // 7: the run's tally and its last fight, for the end of the run and the logbook.
  6: (w) => ({ ...w, tally: { fights: 0, taken: 0, sacks: 0, fled: 0, escaped: 0, best: null }, lastFight: null }),
  // 8: the fight reworked, two decks and the range. A fight left half-fought under the old rules is broken off.
  7: (w) => ({ ...w, encounter: null }),
  // 9: the chain of cards in order. A fight in progress starts with none.
  // 10: the voyage. A run from before it starts at Plymouth, whatever it has done.
  9: (w) => ({ ...w, voyage: { at: 'plymouth', bound: null, visited: ['plymouth'] } }),
  // 10 → 11: stores and survival, and the sandbox cut. An old run is given a full ship and full holds,
  // and loses its letters, its renown, the word of its homeward fortune, and its corsairs' captives.
  10: (w) => {
    const c = SHIP_CLASSES[(w.outfit as { ship?: string })?.ship ?? 'pinnace']?.complement ?? 30;
    const { letter: _l, acts: _a, commission: _c, fame: _f, homewardNoised: _h, ...rest } = w;
    const ships = (w.ships as Record<string, unknown>[]).map(({ raid: _r, captives: _k, ...ship }) => ship);
    return { ...rest, ships, crew: c, stores: { food: c * 180, water: c * 90, spares: 4 + Math.round(c / 10), powder: Math.round(c / 4) }, fresh: 0, rations: 'full', pace: 'steady', calm: 0 };
  },
  8: (w) => {
    const m = w.encounter as { fight: Record<string, unknown> } | null;
    return m ? { ...w, encounter: { ...m, fight: { chain: { last: null, links: 0 }, ...m.fight } } } : w;
  },
};
export const SAVE_KEY = 'privateer:run';

export interface Saved {
  version: number;
  seed: number;
  world: WorldState;
  /** The date, if this is that day's voyage. */
  daily?: string | null;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function encode(seed: number, world: WorldState, daily: string | null = null): string {
  return JSON.stringify({ version: SAVE_VERSION, seed, world, ...(daily ? { daily } : {}) }, (_, v) => (v instanceof Uint8Array ? { $bytes: toBase64(v) } : v));
}

/** The run in `text`, or null if there's none, it's from another version, or it doesn't parse. */
export function decode(text: string | null): Saved | null {
  if (!text) return null;
  try {
    const saved = JSON.parse(text, (_, v) => (v && typeof v === 'object' && typeof v.$bytes === 'string' ? fromBase64(v.$bytes) : v)) as Saved;
    if (!Number.isInteger(saved.seed) || !saved.world || !Number.isInteger(saved.version)) return null;
    let world = saved.world as unknown as Record<string, unknown>;
    for (let v = saved.version; v < SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return null;
      world = step(world);
    }
    return saved.version <= SAVE_VERSION ? { version: SAVE_VERSION, seed: saved.seed, world: world as unknown as WorldState, daily: saved.daily ?? null } : null;
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
