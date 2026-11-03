/**
 * The logbook: every run that ends, kept in the browser across runs — the
 * day, the score, how far the letters went, how it ended, and what sank you.
 * Your best is the one with the most gold of the runs that were won.
 *
 * And today's voyage: a seed fixed for the date, so everyone who sails it
 * sails the same world.
 */

import type { WorldState } from './world/world.ts';

export const LOG_KEY = 'privateer:logbook';
/** Runs kept, newest first. */
export const LOG_KEPT = 100;

export type Ending = 'home' | 'retired' | 'sunk' | 'abandoned';

export interface Entry {
  /** When the run ended, as an ISO date. */
  when: string;
  seed: number;
  /** The date of today's voyage, if it was one. */
  daily: string | null;
  /** Days sailed. */
  day: number;
  gold: number;
  acts: number;
  ending: Ending;
  ship: string;
  /** What sank you, if something did. */
  sunkBy: string | null;
  taken: number;
  sacks: number;
}

export function entryFor(w: WorldState, seed: number, daily: string | null, when: Date): Entry {
  const ending: Ending = w.sunk ? 'sunk' : w.ending === 'retired' ? 'retired' : w.won ? 'home' : 'abandoned';
  return {
    when: when.toISOString().slice(0, 10),
    seed,
    daily,
    day: w.turn + 1,
    gold: w.gold,
    acts: w.acts,
    ending,
    ship: w.outfit.ship,
    sunkBy: w.sunk ? (w.lastFight?.what ?? null) : null,
    taken: w.tally.taken,
    sacks: w.tally.sacks,
  };
}

/** The log with a run added, newest first, no more than LOG_KEPT. */
export const withEntry = (log: Entry[], e: Entry): Entry[] => [e, ...log].slice(0, LOG_KEPT);

/** A won run: home with the letters, or retired. */
export const isWin = (e: Entry) => e.ending === 'home' || e.ending === 'retired';

/** The best run: the richest win; failing any win, the furthest the letters went, then the most gold. */
export function best(log: Entry[]): Entry | null {
  if (!log.length) return null;
  const wins = log.filter(isWin);
  const pool = wins.length ? wins : log;
  return pool.reduce((a, b) => (wins.length ? (b.gold > a.gold ? b : a) : b.acts > a.acts || (b.acts === a.acts && b.gold > a.gold) ? b : a));
}

/** Today's date, as the logbook writes it. */
export const today = (now = new Date()) => now.toISOString().slice(0, 10);

/** The seed for a day's voyage: the same for everyone, the date hashed. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (const c of `privateer ${date}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 2 ** 31;
}

/** Browser storage can refuse or be missing: the log is a convenience, never a reason to fail. */
export function loadLog(): Entry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveLog(log: Entry[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // The run is still over; it just isn't written down.
  }
}
