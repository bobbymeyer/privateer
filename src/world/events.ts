/**
 * A day of the voyage: the weather, and what the stores and the crew go
 * through. Storms come at any time, oftener in their seasons: hurricanes in
 * the Antilles in the autumn, the monsoon's gales in the Indian seas in the
 * summer, always in the roaring forties, and worst of all at the bottom of
 * the world. How to meet one is your choice: see dilemmas.ts.
 */

import { SEASON_LENGTH } from './ocean.ts';
import { type Roller, roll } from './random.ts';
import { provisionDay } from './stores.ts';
import { weatherDay } from './weather.ts';
import { happeningsDay } from './happenings.ts';
import type { Sea, WorldState } from './world.ts';

/** A storm, on any day at sea, outside its seasons and its latitudes. */
export const STORM_CHANCE = 1 / 120;

const inBox = (lon: number, lat: number, [w, s, e, n]: [number, number, number, number]) => lon >= w && lon <= e && lat >= s && lat <= n;
const ANTILLES: [number, number, number, number] = [-100, 8, -55, 32];
const INDIAN_SEAS: [number, number, number, number] = [45, -5, 120, 25];
const HURRICANE_SEASON = 3;
const MONSOON_SEASON = 2;

/** The season of a day: winter, spring, summer, autumn, from the day you set out in December. */
export const seasonOf = (turn: number) => Math.floor(turn / SEASON_LENGTH) % 4;

/** How likely a storm is, here and now. */
export function stormChance(sea: Sea, node: number, turn: number): number {
  const { lon, lat } = sea.map.nodes[node];
  const season = seasonOf(turn);
  let k = 1;
  if (season === HURRICANE_SEASON && inBox(lon, lat, ANTILLES)) k = 3;
  if (season === MONSOON_SEASON && inBox(lon, lat, INDIAN_SEAS)) k = 3;
  if (Math.abs(lat) >= 40) k = Math.max(k, 2);
  // The bottom of the world, where the two oceans meet: the Horn.
  if (lat <= -55) k = Math.max(k, 10);
  return STORM_CHANCE * k;
}

/** A day: at sea, the weather and its ills; anywhere, the eating and drinking. Called by `advance`. */
export function aDay(sea: Sea, s: WorldState): WorldState {
  const r: Roller = { rng: s.rng };
  let w = s;
  const atSea = !sea.map.nodes[s.player].port;
  if (atSea) {
    if (!w.dilemma && roll(r) < stormChance(sea, s.player, s.turn)) {
      w = { ...w, dilemma: { kind: 'storm' }, log: [...w.log, { turn: w.turn, text: 'a storm coming on', stop: true }] };
    }
    w = weatherDay(sea, w, r);
    w = happeningsDay(sea, w, r);
  }
  w = provisionDay(sea, w, r);
  return { ...w, rng: r.rng };
}
