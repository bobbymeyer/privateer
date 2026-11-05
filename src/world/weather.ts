/**
 * The days at sea, Oregon Trail's way: what the weather and the voyage do
 * to you between landmarks, most of it small. Rain to catch, fish to take,
 * a calm in the doldrums, williwaws in the Strait, fever in the tropics, a
 * man overboard; and now and then something that asks you — the water gone
 * foul, weevils in the bread, fever aboard. Called by `aDay`, at sea.
 */

import { type Roller, pick, roll } from './random.ts';
import { capacity, topUp } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** A rain squall, on a day in the tropics: sails spread to catch it. */
export const RAIN_CHANCE = 1 / 20;
/** Fish, birds or a turtle, on any day at sea. */
export const FISH_CHANCE = 1 / 25;
/** In the doldrums, a calm comes on this often, and holds this many days. */
export const CALM_CHANCE = 1 / 15;
export const CALM_DAYS = [2, 6] as const;
/** In the Strait, the williwaws hold you at anchor this often. */
export const WILLIWAW_CHANCE = 0.5;
/** In the tropics, a fever this often. */
export const FEVER_CHANCE = 1 / 45;
/** Anywhere at sea, a hand lost over the side. */
export const OVERBOARD_CHANCE = 1 / 150;
/** The asking events: the water foul, weevils, fever aboard. */
export const FOUL_CHANCE = 1 / 90;
export const WEEVIL_CHANCE = 1 / 90;

const tropic = (sea: Sea, s: WorldState) => Math.abs(sea.map.nodes[s.player].lat) < 23.5;
/** The doldrums: the windless belt either side of the line, in the Atlantic and the eastern Pacific. */
export const doldrums = (sea: Sea, s: WorldState) => {
  const { lat, lon } = sea.map.nodes[s.player];
  return Math.abs(lat) < 7 && ((lon > -45 && lon < 0) || (lon > -140 && lon < -85));
};
/** In the Strait of Magellan: bound through it, and near it. */
export const inStrait = (sea: Sea, s: WorldState) => {
  const v = s.voyage;
  const through = v.bound === 'strait' || v.bound === 'strait-east' || (v.at === 'strait' && v.bound === 'mocha') || (v.at === 'strait-east' && v.bound === 'brazil-home');
  if (!through) return false;
  const d = sea.map.distTo(sea.map.landmarks.strait)[s.player];
  return d <= 6;
};

/** Becalmed or held: no way made today. */
export const noWay = (s: WorldState) => s.calm > s.turn;

const deaths = (s: WorldState, lo: number, hi: number, r: Roller) => Math.min(s.crew, lo + Math.floor(roll(r) * (hi - lo + 1)));

const FISH = ['a school of bonito, and fresh fish for every mess', 'flying fish come aboard in the night', 'a turtle hauled aboard, and soup for all hands', 'boobies taken on the yards, and fresh meat'];
const RAIN = 'a rain squall: the sails spread to catch it, and the casks topped up';

/** A day at sea's weather and ills. Returns the new state; may set a dilemma. */
export function weatherDay(sea: Sea, s: WorldState, r: Roller): WorldState {
  let w = s;
  const log = (text: string, stop = false) => (w = { ...w, log: [...w.log, { turn: w.turn, text, ...(stop ? { stop } : {}) }] });
  const cap = capacity(w);

  // Williwaws in the Strait: down off the snow, and you anchor and wait.
  if (inStrait(sea, w) && !noWay(w) && roll(r) < WILLIWAW_CHANCE) {
    w = { ...w, calm: w.turn + 1 };
    log('williwaws off the mountains: anchored in a bight, a day lost');
  }
  // The doldrums: a calm, and the pitch bubbling in the seams.
  if (doldrums(sea, w) && !noWay(w) && roll(r) < CALM_CHANCE) {
    const days = CALM_DAYS[0] + Math.floor(roll(r) * (CALM_DAYS[1] - CALM_DAYS[0] + 1));
    w = { ...w, calm: w.turn + days };
    log(`becalmed in the doldrums: ${days} days without a breath of wind`, true);
  }
  if (tropic(sea, w) && roll(r) < RAIN_CHANCE && w.stores.water < cap.water) {
    w = { ...w, stores: { ...w.stores, water: topUp(w.stores.water, w.crew * 8, cap.water) } };
    log(RAIN);
  }
  if (roll(r) < FISH_CHANCE) {
    w = { ...w, fresh: Math.max(0, w.fresh - 10), stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 3, cap.food) } };
    log(pick(r, FISH));
  }
  if (tropic(sea, w) && roll(r) < FEVER_CHANCE && !w.dilemma) {
    w = { ...w, dilemma: { kind: 'fever' } };
    log('fever aboard', true);
  }
  if (roll(r) < OVERBOARD_CHANCE && w.crew > 0) {
    w = { ...w, crew: w.crew - 1 };
    log('a hand lost over the side in the night');
  }
  if (!w.dilemma && w.stores.water > 0 && roll(r) < FOUL_CHANCE) {
    w = { ...w, dilemma: { kind: 'foul' } };
    log('the water has gone foul in the casks', true);
  }
  if (!w.dilemma && w.stores.food > 0 && roll(r) < WEEVIL_CHANCE) {
    w = { ...w, dilemma: { kind: 'weevils' } };
    log('weevils in the bread', true);
  }
  return w;
}

/** The fever: press on, and lose men; or lie to and nurse them, and lose days. */
export const FEVER_PRESS = [2, 5] as const;
export const FEVER_NURSE = [0, 1] as const;
export const FEVER_NURSE_DAYS = 3;
/** Foul water: drink it and risk the flux; or heave half of it over. */
export const FLUX = [1, 4] as const;
export const FOUL_LOST = 0.5;
/** Weevils: eat it anyway, at this chance of a hand sickening of it and dying; or heave a quarter of it over. */
export const WEEVIL_SICK = 0.3;
export const WEEVIL_LOST = 0.25;

export function feverDeaths(s: WorldState, how: 'press' | 'nurse', r: Roller) {
  const [lo, hi] = how === 'press' ? FEVER_PRESS : FEVER_NURSE;
  return deaths(s, lo, hi, r);
}
export const fluxDeaths = (s: WorldState, r: Roller) => deaths(s, FLUX[0], FLUX[1], r);
