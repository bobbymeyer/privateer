/**
 * Graves, kept in the browser across runs, like the logbook: the hands of
 * note who died, and the ships lost, each where it happened, with the
 * epitaph you gave them. A later voyage passing the place finds them (see
 * `visitGraves` in world/hands.ts). Nobody else's: nothing leaves the
 * browser.
 */

import type { Grave } from './world/hands.ts';

export const GRAVES_KEY = 'privateer:graves';
/** Graves kept, newest first. */
export const GRAVES_KEPT = 80;
/** An epitaph cut on a board has room for so much. */
export const EPITAPH_LENGTH = 80;

/** Graves with more added, newest first, each once, no more than GRAVES_KEPT. */
export function withGraves(graves: Grave[], more: Grave[]): Grave[] {
  const ids = new Set(more.map((g) => g.id));
  return [...more, ...graves.filter((g) => !ids.has(g.id))].slice(0, GRAVES_KEPT);
}

/** An epitaph as the player typed it, made plain and short enough for the board. */
export const cleanEpitaph = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, EPITAPH_LENGTH);

/** A grave's epitaph changed. */
export const withEpitaph = (graves: Grave[], id: string, text: string): Grave[] => graves.map((g) => (g.id === id ? { ...g, epitaph: cleanEpitaph(text) || g.epitaph } : g));

/** Browser storage can refuse or be missing: graves are a keepsake, never a reason to fail. */
export function loadGraves(): Grave[] {
  try {
    const raw = JSON.parse(localStorage.getItem(GRAVES_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((g) => g && typeof g.id === 'string' && Number.isInteger(g.node)) : [];
  } catch {
    return [];
  }
}

export function saveGraves(graves: Grave[]): void {
  try {
    localStorage.setItem(GRAVES_KEY, JSON.stringify(graves));
  } catch {
    // They are buried all the same; only not written down.
  }
}
