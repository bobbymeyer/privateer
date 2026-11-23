/**
 * The Queen's arms, set up where no Christian prince holds the land: a post
 * with a brass plate bearing her arms and her name, as Drake nailed one up
 * at Nova Albion in 1579, and Ribault set up marble pillars carved with the
 * French king's arms in Florida in 1562 (Probasco, p. 53). A claim by first
 * possession — the answer Elizabeth gave Spain's ambassador, that the sea is
 * free and the land is his who first holds it — and fame when you're home.
 *
 * Once a place; a day's work, and a bundle of the spares or a chest of truck
 * for the post and the plate.
 */

import { landmark } from './landmarks.ts';
import { trueHere } from './rumors.ts';
import { landmarkHere } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** Where nobody holds the land: Patagonia, New Albion, Mendaña's islands, and two isles a storm may put you on. */
export const CLAIMABLE = ['san-julian', 'nova-albion', 'solomons', 'bermuda', 'mauritius'];
/** Fame at the reckoning for each place claimed, at court or with a gift. */
export const ARMS_FAME = 15;
/** How much each takes off the risk of being disowned: the claim answers Spain. */
export const ARMS_COURT = 0.05;
/** The day it takes. */
export const ARMS_DAYS = 1;

/** The place here you could set the Queen's arms up at, if any: claimable, not done, and really there. */
export function armsHere(sea: Sea, s: WorldState): string | null {
  const l = landmarkHere(sea, s);
  if (!l || !CLAIMABLE.includes(l.key) || s.arms.includes(l.key)) return null;
  return trueHere(s, l.key) ? l.key : null;
}

/** What you'd set the post and plate up with: a bundle of the spares first, else a chest of truck. Null if neither. */
export const armsPaidWith = (s: WorldState): 'spares' | 'truck' | null => (s.stores.spares > 0 ? 'spares' : s.truck > 0 ? 'truck' : null);

/** Set up the Queen's arms here: a day, and a bundle or a chest; once. */
export function plantArms(sea: Sea, s: WorldState, advance: (sea: Sea, s: WorldState, to: number) => WorldState): WorldState {
  const key = armsHere(sea, s);
  if (!key) throw new Error('there is nowhere here to set up the Queen’s arms');
  const paid = armsPaidWith(s);
  if (!paid) throw new Error('nothing to make the post and plate of: no spares, no truck');
  const name = landmark(key).name;
  let w: WorldState = {
    ...s,
    arms: [...s.arms, key],
    ...(paid === 'spares' ? { stores: { ...s.stores, spares: s.stores.spares - 1 } } : { truck: s.truck - 1 }),
    log: [...s.log, { turn: s.turn, text: `a post set up at ${name}, and a brass plate nailed to it with the Queen’s arms and her name: the land is hers` }],
  };
  for (let d = 0; d < ARMS_DAYS; d++) {
    w = advance(sea, w, w.player);
    if (w.encounter || w.hail || w.dilemma || w.sunk || w.won) break;
  }
  return w;
}

/** The fame of the places claimed, at the reckoning. */
export const armsFame = (s: { arms: string[] }) => s.arms.length * ARMS_FAME;
