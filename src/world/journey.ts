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
import { SPICE_WORTH, WOOD_WORTH } from './stores.ts';
import { petsWorth } from './pets.ts';
import { arriveBrazil } from './brazil.ts';
import { arriveDetour, followed, hearAt } from './rumors.ts';
import { comeHome } from './reckoning.ts';
import { strangersArriving } from './pressed.ts';
import { SILK_WORTH } from './disguise.ts';
import { alive } from './hands.ts';
import { friendly, meetPeople, peopleAt } from './peoples.ts';
import { inTrades, nextStep } from './course.ts';

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
  // Home: the voyage is over, and there's nowhere left to make for.
  if (v.at === HOME_LANDMARK) return [];
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
export function daysTo(sea: Sea, s: WorldState, key: string): number {
  const dest = sea.map.landmarks[key];
  const steps = sea.map.distTo(dest)[s.player];
  if (!Number.isFinite(steps) || steps <= 0) return steps;
  // Before the Pacific trades she makes three days' way in two: count the leg as she'll sail it.
  let inTrade = 0;
  for (let n = s.player, d = steps; d > 0; d--) {
    const next = nextStep(sea, { ...s, player: n }, dest);
    if (next === null) break;
    if (inTrades(sea, next)) inTrade++;
    n = next;
  }
  return steps - Math.floor(inTrade / 3);
}

/**
 * After a day's sail: have you raised a landmark? The one you're bound for,
 * or any of the next — you may have come at one another way. Raising home
 * brings the reckoning (reckoning.ts), and that ends the run.
 */
export function raise(sea: Sea, s: WorldState): WorldState {
  const v = s.voyage;
  // Bound for one landmark, only that one: the lane to the coast of Brazil passes the bay of
  // Guanabara, and passing it isn't putting in there. Not yet bound, any way on from here.
  const candidates = v.bound ? [v.bound] : choices(v, followed(s));
  const raised = candidates.find((k) => sea.map.landmarks[k] === s.player);
  if (!raised || raised === v.at) return s;
  const voyage: Voyage = { at: raised, bound: null, visited: [...v.visited, raised] };
  const l = landmark(raised);
  if (raised === HOME_LANDMARK) {
    const how = howHome(voyage);
    const said = how === 'round' ? 'round the world and home' : how === 'back' ? 'home the way you went' : 'turned back, and home';
    // The spice and the brazilwood sold on the quay.
    const sold = s.spice * SPICE_WORTH;
    const dye = s.wood * WOOD_WORTH;
    const pets = petsWorth(s);
    const silk = s.silk * SILK_WORTH;
    const log = [
      ...s.log,
      ...(sold ? [{ turn: s.turn, text: `${s.spice} tons of spice sold on the quay for ${sold}` }] : []),
      ...(dye ? [{ turn: s.turn, text: `${s.wood} tons of brazilwood sold to the dyers for ${dye}` }] : []),
      ...(silk ? [{ turn: s.turn, text: `${s.silk} tons of Persian silk sold to the mercers for ${silk}` }] : []),
      ...(pets ? [{ turn: s.turn, text: `${[s.monkeys && `${s.monkeys} ${s.monkeys === 1 ? 'monkey' : 'monkeys'}`, s.parrots && `${s.parrots} ${s.parrots === 1 ? 'parrot' : 'parrots'}`].filter(Boolean).join(' and ')} sold in London for ${pets}` }] : []),
    ];
    const gold = s.gold + sold + dye + pets + silk;
    // Not over yet: the shares, and the reckoning.
    return comeHome({ ...s, voyage, gold, spice: 0, wood: 0, silk: 0, monkeys: 0, parrots: 0, log: [...log, { turn: s.turn, text: `Plymouth: ${said}, with ${gold}`, stop: true }] });
  }
  // The people of the coast, as they stand with you; then what happens on arriving.
  let w: WorldState = meetPeople({ ...s, voyage, landfall: null, log: [...s.log, { turn: s.turn, text: `you raise ${l.name}`, stop: true }] }, raised);
  w = arriving(w, raised);
  // Men who aren't your own: pressed men slip away, jail-hands run, idle soldiers go, the interpreter may sell you.
  w = strangersArriving(w, raised);
  w = arriveBrazil(w, raised);
  // Off Cape San Francisco, the first time: the treasure ship.
  if (raised === PLATE_LANDMARK && !v.visited.includes(PLATE_LANDMARK)) w = overhaul(sea, w);
  // A detour: whether the rumor was true. Anywhere else: a rumor, maybe.
  // Friends tell you what they know.
  // Friends tell you what they know, and so does a renegade who has the language.
  w = l.detour ? arriveDetour(sea, w, raised) : hearAt(w, raised, friendly(w, peopleAt(raised)) || alive(w, 'interpreter'));
  return w;
}
