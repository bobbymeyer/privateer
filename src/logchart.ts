/**
 * The logbook as a chart: every voyage you've sailed, from the logbook's
 * tracks, how each ended, and what you left behind on the way — the graves,
 * the Queen's arms, and the coasts that remember you. Data only; the
 * logbook dialog draws it (LogbookChart.svelte). Older entries without a
 * track are left off the chart, not guessed at.
 */

import type { Entry } from './logbook.ts';
import type { Grave } from './world/hands.ts';
import { PEOPLES, PEOPLE_KEYS, type Memory, type People } from './world/peoples.ts';
import { LANDMARKS } from './world/landmarks.ts';

/** How a voyage is drawn: home in ink, lost dashed, named a pirate in red, given up faint. */
export type Ended = 'home' | 'lost' | 'pirate' | 'abandoned';

export interface Track {
  /** The voyage's place in the logbook, newest first: what the table selects by. */
  index: number;
  ended: Ended;
  /** Each leg sailed: from one landmark raised to the next. */
  legs: [string, string][];
}

export interface Mark {
  /** The landmark it stands at. */
  at: string;
  word: string;
  people?: People;
}

export interface LogChart {
  tracks: Track[];
  graves: Grave[];
  /** The Queen's arms, wherever any voyage set them up, each place once. */
  arms: string[];
  /** The coasts that remember an English ship, friendly or hostile, at the first landmark of their coast. */
  coasts: Mark[];
}

const KNOWN = new Set(LANDMARKS.map((l) => l.key));

export const endedOf = (e: Entry): Ended => (e.pirate ? 'pirate' : e.ending === 'home' || e.ending === 'retired' ? 'home' : e.ending === 'sunk' ? 'lost' : 'abandoned');

/** The chart's data from the logbook, the graves and the coasts' memory. */
export function logChart(log: Entry[], graves: Grave[], memory: Memory): LogChart {
  const tracks: Track[] = [];
  log.forEach((e, index) => {
    const t = (e.track ?? []).filter((k) => KNOWN.has(k));
    if (t.length < 2) return;
    const legs: [string, string][] = [];
    for (let i = 1; i < t.length; i++) legs.push([t[i - 1], t[i]]);
    tracks.push({ index, ended: endedOf(e), legs });
  });
  const arms = [...new Set(log.flatMap((e) => e.claims ?? []).filter((k) => KNOWN.has(k)))];
  const coasts = PEOPLE_KEYS.filter((p) => memory[p]).map((p) => ({ at: PEOPLES[p].at[0], word: memory[p]!, people: p }));
  return { tracks, graves, arms, coasts };
}
