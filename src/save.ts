/**
 * Saving a run, so a reload doesn't lose it. The world state is plain data
 * but for the chart, a byte per node, which goes into the JSON as base64.
 *
 * A save carries a version. When the shape of the state changes, the version
 * goes up and an older save is dropped rather than loaded half-understood.
 */

import type { WorldState } from './world/world.ts';

export const SAVE_VERSION = 1;
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
    return saved.version === SAVE_VERSION && Number.isInteger(saved.seed) && saved.world ? saved : null;
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
