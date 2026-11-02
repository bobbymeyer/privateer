/**
 * Rumors are bought by the round. Stand the house a drink in port and
 * somebody may tell you about a ship: where it was when they saw it, a few
 * days back, from as far as a month's sail away.
 *
 * - **What's talked about:** ships whose wake came within reach of the
 *   port. A treasure fleet is talked about more than a merchant, and
 *   nearer ships more than farther ones.
 * - **How stale:** a sighting is up to twelve days old, mostly recent.
 * - **How true:** news from far off is garbled, and every round you buy
 *   finds the room drunker — less likely to know anything, and less right
 *   when it does. The room turns over overnight.
 */

import { MORALE_MAX } from './events.ts';
import { type NodeId, portNamed } from './map.ts';
import { type Roller, roll, weighted } from './random.ts';
import { serves } from './port.ts';
import { type Rumor, makeRumor } from './rumors.ts';
import type { Sea, ShipKind } from './ships.ts';
import type { WorldState } from './world.ts';

export const ROUND_COST = 2;
/** Ships farther than this many days from the port then aren't talked about. */
export const BAR_REACH = 30;

/** How much a kind of ship gets talked about. */
export const NOTABLE: Record<ShipKind, number> = {
  'treasure-fleet': 5,
  'treasure-ship': 4,
  armada: 3,
  hunter: 2,
  privateer: 2,
  monster: 3,
  merchant: 1,
};

export interface Round {
  world: WorldState;
  /** What you heard, if anything. */
  heard: Rumor | null;
}

export function buyRound(sea: Sea, s: WorldState): Round {
  const port = sea.map.nodes[s.player].port;
  if (!port) throw new Error('there is no bar at sea');
  if (s.gold < ROUND_COST) throw new Error('not enough in the purse for a round');
  if (!serves(sea, s)) throw new Error("the house won't serve you");
  const r: Roller = { rng: s.rng };
  // A round for the house does the crew's spirits good, the first one anyway.
  const paid: WorldState = { ...s, gold: s.gold - ROUND_COST, rounds: s.rounds + 1, morale: s.rounds === 0 ? Math.min(MORALE_MAX, s.morale + 1) : s.morale };

  // Anybody here know anything?
  if (roll(r) >= 0.85 * 0.8 ** s.rounds) return { world: { ...paid, rng: r.rng }, heard: null };

  const seen = sighting(sea, s, r, portNamed(sea.map, port.name), 12, -1, 1);
  if (!seen) return { world: { ...paid, rng: r.rng }, heard: null };
  const reliability = Math.max(0.2, Math.min(0.95, 0.92 - 0.012 * seen.far - 0.07 * s.rounds + (roll(r) - 0.5) * 0.16));
  const heard = makeRumor(sea, r, s.nextRumor, { ...seen.ship, node: seen.at }, s.turn - seen.age, reliability);
  return { world: { ...paid, rng: r.rng, rumors: [...s.rumors, heard], nextRumor: s.nextRumor + 1 }, heard };
}

/**
 * A ship somebody at `from` could have seen: where it was, `minAge` to
 * `maxAge` days back (recent likelier), within reach of `from`. Treasure is talked
 * about more than merchants, near ships more than far ones. Ships laid up
 * and the ship in `except` aren't.
 */
export function sighting(sea: Sea, s: WorldState, r: Roller, from: NodeId, maxAge: number, except = -1, minAge = 0) {
  const toHere = sea.map.distTo(from);
  const seen = s.ships.flatMap((ship, i) => {
    if (ship.id === except || ship.laidUp > s.turn) return [];
    const age = Math.min(s.trail[i].length, minAge + Math.floor(roll(r) ** 2 * (maxAge - minAge + 1)));
    const at = age === 0 ? ship.node : s.trail[i][age - 1];
    const far = toHere[at];
    return far <= BAR_REACH ? [{ ship, at, age, far }] : [];
  });
  return seen.length ? seen[weighted(r, seen.map((x) => NOTABLE[x.ship.kind] / (1 + x.far / 5)))] : null;
}
