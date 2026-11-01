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

import { portNamed } from './map.ts';
import { type Roller, roll, weighted } from './random.ts';
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
  const r: Roller = { rng: s.rng };
  const paid: WorldState = { ...s, gold: s.gold - ROUND_COST, rounds: s.rounds + 1 };

  // Anybody here know anything?
  if (roll(r) >= 0.85 * 0.8 ** s.rounds) return { world: { ...paid, rng: r.rng }, heard: null };

  // When they saw it: up to the length of the wake, recent likelier.
  const toPort = sea.map.distTo(portNamed(sea.map, port.name));
  const sightings = s.ships.flatMap((ship, i) => {
    const age = Math.min(s.trail[i].length, 1 + Math.floor(roll(r) ** 2 * 12));
    const at = age === 0 ? ship.node : s.trail[i][age - 1];
    const far = toPort[at];
    return far <= BAR_REACH ? [{ ship, at, age, far }] : [];
  });
  if (!sightings.length) return { world: { ...paid, rng: r.rng }, heard: null };

  const seen = sightings[weighted(r, sightings.map((x) => NOTABLE[x.ship.kind] / (1 + x.far / 5)))];
  const reliability = Math.max(0.2, Math.min(0.95, 0.92 - 0.012 * seen.far - 0.07 * s.rounds + (roll(r) - 0.5) * 0.16));
  const heard = makeRumor(sea, r, s.nextRumor, { ...seen.ship, node: seen.at }, s.turn - seen.age, reliability);
  return { world: { ...paid, rng: r.rng, rumors: [...s.rumors, heard], nextRumor: s.nextRumor + 1 }, heard };
}
