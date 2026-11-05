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
import type { NodeId } from './map.ts';
import type { Sea } from './ships.ts';
import type { WorldState } from './world.ts';

/** The route she sails. */
export const PLATE_ROUTE = 'south sea fleet';
/** Where she's overhauled. */
export const PLATE_LANDMARK = 'cacafuego';
/** What she carries over a galleon's usual, asleep or warned; and what that does to her hull. */
export const PLATE_CARGO = 150;
export const ASLEEP_HULL = -4;
export const WARNED_HULL = 4;

/** The coast of Chile and Peru, where a raid wakes the South Sea. */
const PACIFIC_COAST = { west: -82, east: -68, south: -45, north: 5 };

/** Whether you've raided a town on the coast: then the treasure ship is warned. */
export function coastAwake(sea: Sea, s: WorldState): boolean {
  const raided = [...Object.keys(s.sacked), ...Object.keys(s.guarded)].map(Number) as NodeId[];
  return raided.some((n) => {
    const { lon, lat } = sea.map.nodes[n];
    return lon >= PACIFIC_COAST.west && lon <= PACIFIC_COAST.east && lat >= PACIFIC_COAST.south && lat <= PACIFIC_COAST.north;
  });
}

/** Asleep or warned, she strikes when she's beaten, and her silver comes whole: Drake's men spent four days moving it. */
export const plateExtra = (warned: boolean): Extra => ({ hull: warned ? WARNED_HULL : ASLEEP_HULL, cargo: PLATE_CARGO, takenWhole: true });

/**
 * Raising Cape San Francisco: the treasure ship comes alongside, if she's
 * at sea at all. Called by `raise` in journey.ts, the first time.
 */
export function overhaul(sea: Sea, s: WorldState): WorldState {
  const ship = s.ships.find((x) => x.routeName === PLATE_ROUTE);
  const log = (text: string) => [...s.log, { turn: s.turn, text, stop: true }];
  if (!ship || ship.laidUp > s.turn) {
    return { ...s, log: log('no sail to the north: the treasure ship has gone by, or never sailed') };
  }
  const warned = coastAwake(sea, s);
  const ships = s.ships.map((x) => (x.id === ship.id ? { ...x, node: s.player, dest: x.route?.[x.leg] ?? x.dest } : x));
  const text = warned
    ? 'a sail to the north, low in the water: the treasure ship from Callao. word of your raids has gone ahead, and her guns are run out'
    : 'a sail to the north, low in the water: the treasure ship from Callao. she takes you for a Spaniard, and comes down to speak you';
  return { ...s, ships, hail: { shipId: ship.id, kind: ship.kind, nation: ship.nation, plate: warned ? 'warned' : 'asleep' }, log: log(text) };
}

