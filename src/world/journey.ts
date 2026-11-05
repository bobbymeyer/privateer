/**
 * The voyage: where you are on the chain of landmarks, where you're bound,
 * and where you've been. At a fork you choose the next leg, and the ship
 * sails it along the lanes; you can turn for home at any point, Fenton's
 * way. Coming into Plymouth again ends the run.
 */

import { HOME_LANDMARK, START_LANDMARK, landmark } from './landmarks.ts';
import type { Sea, WorldState } from './world.ts';
import { PLATE_LANDMARK, overhaul } from './treasure.ts';
import { arriving } from './happenings.ts';
import { SPICE_WORTH } from './stores.ts';
import { arriveDetour, followed, hearAt } from './rumors.ts';

export interface Voyage {
  /** The landmark you last raised. */
  at: string;
  /** The landmark you're making for, if you've chosen. */
  bound: string | null;
  /** Every landmark raised, in order. */
  visited: string[];
}

export const START_VOYAGE: Voyage = { at: START_LANDMARK, bound: null, visited: [START_LANDMARK] };

/** How a voyage came home: round the world, back the way it came, or turned back. */
export type Return = 'round' | 'back' | 'turned';
export function howHome(v: Voyage): Return {
  if (v.visited.includes('cape') || v.visited.includes('ladrones')) return 'round';
  if (v.visited.includes('strait-east')) return 'back';
  return 'turned';
}

/** The next landmarks from here: the way's, and any detour you mean to follow that branches here. */
function nextFrom(v: Voyage, detours: string[]): string[] {
  const rumored = detours.filter((k) => landmark(k).detour?.from.includes(v.at) && !v.visited.includes(k));
  return [...landmark(v.at).next, ...rumored];
}

/** Where you can make for from here: the next landmarks, any detour you're following, and, once you've left Plymouth, home. */
export function choices(v: Voyage, detours: string[] = []): string[] {
  const next = nextFrom(v, detours);
  if (v.at === START_LANDMARK || next.includes(HOME_LANDMARK)) return next;
  return [...next, HOME_LANDMARK];
}

/** The one way on from here, if the way doesn't divide (turning for home aside); null at a fork. */
export function onward(v: Voyage, detours: string[] = []): string | null {
  const next = nextFrom(v, detours);
  return next.length === 1 ? next[0] : null;
}

/** Make for a landmark: one of the next, a detour you're following, or home. */
export function makeFor(s: WorldState, key: string): WorldState {
  if (!choices(s.voyage, followed(s)).includes(key)) throw new Error(`you can’t make for ${landmark(key).name} from ${landmark(s.voyage.at).name}`);
  return { ...s, voyage: { ...s.voyage, bound: key } };
}

/** Days from here to a landmark, sailing the lanes. */
export const daysTo = (sea: Sea, s: WorldState, key: string) => sea.map.distTo(sea.map.landmarks[key])[s.player];

/**
 * After a day's sail: have you raised a landmark? The one you're bound for,
 * or any of the next — you may have come at one another way. Raising home
 * ends the run.
 */
export function raise(sea: Sea, s: WorldState): WorldState {
  const v = s.voyage;
  const candidates = [...new Set([...(v.bound ? [v.bound] : []), ...choices(v, followed(s))])];
  const raised = candidates.find((k) => sea.map.landmarks[k] === s.player);
  if (!raised || raised === v.at) return s;
  const voyage: Voyage = { at: raised, bound: null, visited: [...v.visited, raised] };
  const l = landmark(raised);
  if (raised === HOME_LANDMARK) {
    const how = howHome(voyage);
    const said = how === 'round' ? 'round the world and home' : how === 'back' ? 'home the way you went' : 'turned back, and home';
    // The spice sold on the quay.
    const sold = s.spice * SPICE_WORTH;
    const log = [...s.log, ...(sold ? [{ turn: s.turn, text: `${s.spice} tons of spice sold on the quay for ${sold}` }] : [])];
    const gold = s.gold + sold;
    return { ...s, voyage, gold, spice: 0, won: true, ending: 'home', log: [...log, { turn: s.turn, text: `Plymouth: ${said}, with ${gold}`, stop: true }] };
  }
  let w: WorldState = arriving({ ...s, voyage, landfall: null, log: [...s.log, { turn: s.turn, text: `you raise ${l.name}`, stop: true }] }, raised);
  // Off Cape San Francisco, the first time: the treasure ship.
  if (raised === PLATE_LANDMARK && !v.visited.includes(PLATE_LANDMARK)) w = overhaul(sea, w);
  // A detour: whether the rumor was true. Anywhere else: a rumor, maybe.
  w = l.detour ? arriveDetour(sea, w, raised) : hearAt(w, raised);
  return w;
}
