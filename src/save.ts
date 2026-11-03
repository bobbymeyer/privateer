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

import type { WorldState } from './world/world.ts';

export const SAVE_VERSION = 3;

/** From each version to the next. A run from before a feature simply goes without it. */
const MIGRATIONS: Record<number, (world: Record<string, unknown>) => Record<string, unknown>> = {
  // 2: renown, and the home stretch. The corsairs aren't in an older run's fleet.
  1: (w) => ({ ...w, fame: 0, homewardNoised: false }),
  // 3: prize cards, struck cards, a prize's stores waiting on a choice.
  2: (w) => ({ ...w, spoil: null, outfit: { prizes: [], struck: [], ...(w.outfit as object) } }),
};
export const SAVE_KEY = 'privateer:run';

export interface Saved {
  version: number;
  seed: number;
  world: WorldState;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function encode(seed: number, world: WorldState): string {
  return JSON.stringify({ version: SAVE_VERSION, seed, world }, (_, v) => (v instanceof Uint8Array ? { $bytes: toBase64(v) } : v));
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
    return saved.version <= SAVE_VERSION ? { version: SAVE_VERSION, seed: saved.seed, world: world as unknown as WorldState } : null;
  } catch {
    return null;
  }
}

/** Browser storage can be missing or refuse: a private window, a full disk. Saving is a convenience; it never breaks the game. */
export function store(seed: number, world: WorldState): void {
  try {
    localStorage.setItem(SAVE_KEY, encode(seed, world));
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
