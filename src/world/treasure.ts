/**
 * The set piece: the treasure ship off Cape San Francisco. Every year the
 * silver of Potosí goes north from Callao to Panama in a galleon of the
 * South Sea, alone, because nobody has ever been there to take her. In
 * March 1579 Drake overhauled the Nuestra Señora de la Concepción — the
 * Cacafuego — off Cape San Francisco, and came home with her silver.
 *
 * Raise Cape San Francisco and she is in sight, the first time. If the
 * coast is still asleep, she takes you for a Spaniard and comes down to
 * speak you, her guns struck below. If you have raided the coast of Chile
 * and Peru on the way, word has gone ahead of you: she is warned, and her
 * guns are run out. Either way she is the richest ship you will see.
 */

import type { Extra } from '../setup.ts';
import type { Sea, WorldState } from './world.ts';

/** Where she's overhauled. */
export const PLATE_LANDMARK = 'cacafuego';
/** What she carries over a galleon's usual, asleep or warned; and what that does to her hull. */
export const PLATE_CARGO = 150;
export const ASLEEP_HULL = -4;
export const WARNED_HULL = 4;

/** The towns on the coast of Chile and Peru, before the cape: a raid on either wakes the South Sea. */
export const PACIFIC_TOWNS = ['valparaiso', 'callao'];

/** Whether you've raided a town on the coast: then the treasure ship is warned. */
export const coastAwake = (s: WorldState): boolean => s.raided.some((k) => PACIFIC_TOWNS.includes(k));

/** Asleep or warned, she strikes when she's beaten, and her silver comes whole: Drake's men spent four days moving it. */
export const plateExtra = (warned: boolean): Extra => ({ hull: warned ? WARNED_HULL : ASLEEP_HULL, cargo: PLATE_CARGO, takenWhole: true });

/** Raising Cape San Francisco: the treasure ship comes alongside. Called by `raise` in journey.ts, the first time. */
export function overhaul(sea: Sea, s: WorldState): WorldState {
  void sea;
  const warned = coastAwake(s);
  const text = warned
    ? 'a sail to the north, low in the water: the treasure ship from Callao. word of your raids has gone ahead, and her guns are run out'
    : 'a sail to the north, low in the water: the treasure ship from Callao. she takes you for a Spaniard, and comes down to speak you';
  return { ...s, hail: { kind: 'treasure-ship', nation: 'spain', plate: warned ? 'warned' : 'asleep' }, log: [...s.log, { turn: s.turn, text, stop: true }] };
}
