/**
 * Storm landfalls: a storm in the right waters may drive you onto an island
 * you'd never have made for — Bermuda, St Helena, Mauritius, the Galápagos,
 * Juan Fernández. It happened: Henry May wrecked on Bermuda in 1593, the Sea
 * Venture in 1609; Berlanga drifted to the Galápagos in 1535.
 *
 * However you meet the storm there's a chance of it, more if you run before
 * it. You're put ashore on the island with the days of drifting gone, and
 * lie there as at a landmark: its shore work to do, its dangers. Then you
 * continue on to wherever you were bound. Each island comes once a run.
 */

import { LANDMARKS, type Landmark, landmark } from './landmarks.ts';
import { type Roller, roll } from './random.ts';
import { capacity, provisionDay, topUp } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** A storm met in a landfall's waters drives you to it this often; running before it, more often. */
export const LANDFALL_CHANCE = 1 / 8;
export const LANDFALL_RUNNING = 1 / 5;
/** Days of drifting before you raise it. */
export const DRIFT_DAYS = [2, 5] as const;

/** The waters each island's storms come from: west, south, east, north. */
export const LANDFALL_WATERS: Record<string, [number, number, number, number]> = {
  bermuda: [-80, 25, -50, 40],
  'st-helena': [-25, -30, 10, -2],
  mauritius: [45, -30, 80, -10],
  galapagos: [-100, -10, -82, 5],
  'juan-fernandez': [-85, -40, -75, -28],
};

/** Coming in through the reefs of Bermuda: even odds, and what it costs. */
export const REEF_CHANCE = 0.5;
export const REEF_HULL = [1, 3] as const;

/** The island whose storms you're in, if you haven't been driven to it already this run. */
export function landfallFor(sea: Sea, s: WorldState): Landmark | null {
  const { lon, lat } = sea.map.nodes[s.player];
  const key = Object.keys(LANDFALL_WATERS).find((k) => {
    const [w, so, e, n] = LANDFALL_WATERS[k];
    return lon >= w && lon <= e && lat >= so && lat <= n && !s.seen.includes(k);
  });
  return key ? landmark(key) : null;
}

/** After a storm, however met: driven ashore, maybe. Called by `choose` for a storm. */
export function driven(sea: Sea, s: WorldState, ran: boolean, r: Roller): WorldState {
  const island = landfallFor(sea, s);
  if (!island || roll(r) >= (ran ? LANDFALL_RUNNING : LANDFALL_CHANCE)) return s;
  const days = DRIFT_DAYS[0] + Math.floor(roll(r) * (DRIFT_DAYS[1] - DRIFT_DAYS[0] + 1));
  let w: WorldState = s;
  // The days of drifting: eaten and drunk, if nothing else.
  for (let d = 0; d < days && !w.sunk; d++) w = provisionDay(sea, { ...w, turn: w.turn + 1 }, r);
  if (w.sunk) return w;
  w = { ...w, player: sea.map.landmarks[island.key], landfall: island.key, seen: [...w.seen, island.key], calm: Math.min(w.calm, w.turn) };
  w = { ...w, log: [...w.log, { turn: w.turn, text: `the storm drove you ${days} days before it, onto ${island.name}`, stop: true }] };
  return arrive(w, island.key, r);
}

/** What each island does to you, coming in. */
function arrive(s: WorldState, key: string, r: Roller): WorldState {
  const cap = capacity(s);
  const say = (w: WorldState, text: string): WorldState => ({ ...w, log: [...w.log, { turn: w.turn, text }] });
  if (key === 'bermuda' && roll(r) < REEF_CHANCE) {
    const lost = Math.min(s.hull - 1, REEF_HULL[0] + Math.floor(roll(r) * (REEF_HULL[1] - REEF_HULL[0] + 1)));
    return say({ ...s, hull: s.hull - lost }, `in through the reefs, touching twice: ${lost} hull`);
  }
  if (key === 'galapagos') {
    return say({ ...s, fresh: 0, stores: { ...s.stores, food: topUp(s.stores.food, s.crew * 30, cap.food) } }, 'tortoises carried aboard by the dozen, that will live for weeks in the hold: a month of fresh meat');
  }
  return s;
}

/** The island you're lying at, if a storm put you there and you haven't sailed on. */
export const landfallHere = (sea: Sea, s: WorldState): Landmark | null => (s.landfall && sea.map.landmarks[s.landfall] === s.player ? landmark(s.landfall) : null);

/** Every landfall, for drawing. */
export const LANDFALLS = LANDMARKS.filter((l) => l.landfall);
