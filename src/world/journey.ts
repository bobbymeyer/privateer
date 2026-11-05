/**
 * The voyage: where you are on the chain of landmarks, where you're bound,
 * and where you've been. You choose the next leg at each landmark — at a
 * fork, which way — and the ship sails it along the lanes. You can turn
 * aside to a port or a prize between, and come back to it; you can turn for
 * home at any point, Fenton's way. Coming into Plymouth again ends the run.
 */

import { HOME_LANDMARK, LANDMARKS, START_LANDMARK, landmark } from './landmarks.ts';
import type { Sea } from './ships.ts';
import type { WorldState } from './world.ts';

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

/** Where you can make for from here: the next landmarks, and, once you've left Plymouth, home. */
export function choices(v: Voyage): string[] {
  const next = landmark(v.at).next;
  if (v.at === START_LANDMARK || next.includes(HOME_LANDMARK)) return next;
  return [...next, HOME_LANDMARK];
}

/** Make for a landmark: one of the next, or home. */
export function makeFor(s: WorldState, key: string): WorldState {
  if (!choices(s.voyage).includes(key)) throw new Error(`you can’t make for ${landmark(key).name} from ${landmark(s.voyage.at).name}`);
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
  const candidates = [...new Set([...(v.bound ? [v.bound] : []), ...choices(v)])];
  const raised = candidates.find((k) => sea.map.landmarks[k] === s.player);
  if (!raised || raised === v.at) return s;
  const voyage: Voyage = { at: raised, bound: null, visited: [...v.visited, raised] };
  const l = landmark(raised);
  if (raised === HOME_LANDMARK && s.pirate) {
    // Plymouth would hang you. Not home yet: a pardon first, or a haven.
    return { ...s, log: [...s.log, { turn: s.turn, text: 'Plymouth, but they’d hang you here: buy a pardon first, or make for a pirate’s haven', stop: true }] };
  }
  if (raised === HOME_LANDMARK) {
    const how = howHome(voyage);
    const said = how === 'round' ? 'round the world and home' : how === 'back' ? 'home the way you went' : 'turned back, and home';
    return { ...s, voyage, won: true, ending: 'home', log: [...s.log, { turn: s.turn, text: `Plymouth: ${said}, with ${s.gold}`, stop: true }] };
  }
  return { ...s, voyage, log: [...s.log, { turn: s.turn, text: `you raise ${l.name}`, stop: true }] };
}

/** The landmarks in order of the main line, for drawing: every one, once. */
export const ALL_LANDMARKS = LANDMARKS;
