/**
 * What happens at sea when nobody is fighting: the crew's temper, the
 * weather, and the signs the hands read in both.
 *
 * Morale is the crew's patience, out of ten. A prize puts it up, and so do
 * a round ashore, fresh water and a good omen; a long stretch with nothing
 * taken wears it down, and at nothing it's mutiny — a hand of note hanged
 * as a ringleader, or gone over the side at the next landfall, or with
 * nobody of note aboard, the strongroom broken open.
 *
 * Storms come at any time, oftener in their seasons: hurricanes in the
 * Antilles in the autumn, the monsoon's gales in the Indian seas in the
 * summer, and always in the roaring forties. A storm costs you hull, or the
 * cargo you throw over to stay afloat.
 */

import { CREW, WAGE_DAYS, wagesOf } from '../outfit.ts';
import { type Roller, pick, roll } from './random.ts';
import { seasonOf } from './sea.ts';
import type { Sea } from './ships.ts';
import { refit } from './port.ts';
import { type WorldState, atIsland } from './world.ts';

export const MORALE_MAX = 10;
export const MORALE_START = 7;
/** Days without a prize before the crew start to sour. */
export const IDLE_DAYS = 30;
/** After that, a point of morale lost every this many days. */
export const SOUR_EVERY = 10;
/** Where morale is set again after a mutiny, once it's over. */
export const AFTER_MUTINY = 4;
/** What a mutiny takes from the strongroom, when there's nobody of note to blame. */
export const MUTINY_LOOT = 0.3;
/** A good omen, on any day at sea. */
export const OMEN_CHANCE = 1 / 45;
export const OMEN_CHEER = 2;
/** A storm, on any day at sea, outside its seasons and its latitudes. */
export const STORM_CHANCE = 1 / 120;
/** What a storm can make you throw over: a share of the purse, and no more than this. */
export const JETTISON_MAX = 30;
/** Wages unpaid cost this much morale. */
export const UNPAID = 2;
/** What a prize does for the crew: more for a sacked town. */
export const PRIZE_CHEER = 3;
export const SACK_CHEER = 4;

/** Morale up by `n`, to the top and no farther. */
export const cheer = (s: WorldState, n: number): WorldState => ({ ...s, morale: Math.min(MORALE_MAX, s.morale + n) });

/** Spoils taken: the crew have their shares, and the clock on their patience starts again. */
export const spoils = (s: WorldState, n = PRIZE_CHEER): WorldState => ({ ...cheer(s, n), lastSpoils: s.turn });

const inBox = (lon: number, lat: number, [w, s, e, n]: [number, number, number, number]) => lon >= w && lon <= e && lat >= s && lat <= n;
const ANTILLES: [number, number, number, number] = [-100, 8, -55, 32];
const INDIAN_SEAS: [number, number, number, number] = [45, -5, 120, 25];
const HURRICANE_SEASON = 3;
const MONSOON_SEASON = 2;

/** How likely a storm is, here and now. */
export function stormChance(sea: Sea, node: number, turn: number): number {
  const { lon, lat } = sea.map.nodes[node];
  const season = seasonOf(sea.pattern, turn);
  let k = 1;
  if (season === HURRICANE_SEASON && inBox(lon, lat, ANTILLES)) k = 3;
  if (season === MONSOON_SEASON && inBox(lon, lat, INDIAN_SEAS)) k = 3;
  if (Math.abs(lat) >= 40) k = Math.max(k, 2);
  return STORM_CHANCE * k;
}

const OMENS = [
  'birds over the bow, and the hands say land is near',
  'an island with a spring, and the casks filled with fresh water',
  "Saint Elmo's fire in the rigging, which the hands call luck",
  'porpoises under the bow all the forenoon watch',
  'a fair wind three days running, and the hands singing at the capstan',
];

/** A day's events: called by `advance` once everyone has moved. */
export function aDay(sea: Sea, s: WorldState): WorldState {
  const r: Roller = { rng: s.rng };
  let w = s;
  const log = (text: string, stop = false) => (w = { ...w, log: [...w.log, { turn: w.turn, text, ...(stop ? { stop } : {}) }] });
  const atSea = !sea.map.nodes[s.player].port;

  // Fresh water and green stuff at an island you've charted.
  if (atIsland(w)) w = cheer(w, 1);

  if (atSea && !atIsland(w)) {
    if (roll(r) < stormChance(sea, s.player, s.turn)) {
      const throwOver = w.gold > 0 && roll(r) < 0.5;
      if (throwOver) {
        const lost = Math.min(JETTISON_MAX, Math.max(1, Math.round(w.gold * (0.1 + 0.15 * roll(r)))));
        w = { ...w, gold: w.gold - lost };
        log(`a storm: ${lost} in cargo thrown over the side to keep her afloat`, true);
      } else {
        const lost = Math.min(1 + Math.floor(roll(r) * 3), w.hull - 1);
        w = { ...w, hull: w.hull - lost };
        log(lost > 0 ? `a storm: the ship takes ${lost} hull of damage` : 'a storm, ridden out with nothing left to lose', true);
      }
    } else if (roll(r) < OMEN_CHANCE) {
      w = cheer(w, OMEN_CHEER);
      log(`a good omen: ${pick(r, OMENS)}`);
    }
  }

  // Payday for the hands of note. Unpaid, they sour fast.
  const wages = wagesOf(w.outfit);
  if (wages > 0 && w.turn > 0 && w.turn % WAGE_DAYS === 0) {
    if (w.gold >= wages) w = { ...w, gold: w.gold - wages };
    else {
      w = { ...w, morale: w.morale - UNPAID };
      log(`no money for the wages: the hands of note are owed ${wages}, and the crew know it`, true);
    }
  }

  // Too long without a prize, and the crew sour.
  const idle = w.turn - w.lastSpoils;
  if (idle >= IDLE_DAYS && (idle - IDLE_DAYS) % SOUR_EVERY === 0) {
    w = { ...w, morale: w.morale - 1 };
    if (w.morale > 0) log(`${idle} days without a prize, and the crew are grumbling`, w.morale <= 2);
  }
  if (w.morale <= 0) w = mutiny({ ...w, rng: r.rng }, r);
  return { ...w, rng: r.rng };
}

/** The crew rise. Somebody pays for it. */
function mutiny(s: WorldState, r: Roller): WorldState {
  let w: WorldState = { ...s, morale: AFTER_MUTINY, lastSpoils: s.turn };
  let text: string;
  if (w.outfit.crew.length) {
    const role = pick(r, w.outfit.crew);
    const name = CREW[role].name;
    text = roll(r) < 0.5 ? `mutiny: the ${name} led it, and was hanged at the yardarm` : `mutiny, put down, and the ${name} deserted at the first chance`;
    w = refit(w, { ...w.outfit, crew: w.outfit.crew.filter((c) => c !== role) });
  } else {
    const lost = Math.ceil(w.gold * MUTINY_LOOT);
    w = { ...w, gold: w.gold - lost };
    text = `mutiny: the strongroom broken open, and ${lost} gone before order was restored`;
  }
  return { ...w, log: [...w.log, { turn: w.turn, text, stop: true }] };
}
