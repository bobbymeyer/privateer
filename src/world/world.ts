/**
 * The world between encounters: you, the other ships, the turn, and what you
 * have heard. Pure, like the encounter rules: state in, state out.
 *
 * The sea itself — map, currents, wind — is fixed by the seed, so it is
 * built once by `createSea` and passed alongside rather than copied each turn.
 */

import type { RngState } from '../rng.ts';
import { generateMap, type NodeId, ports } from './map.ts';
import type { Roller } from './random.ts';
import { pick } from './random.ts';
import { type Rumor, FADED, makeRumor, markerStrength } from './rumors.ts';
import { generatePattern, type SeaKnowledge } from './sea.ts';
import { type Sea, type Ship, type ShipKind, moveShip, spawnShips } from './ships.ts';

export interface WorldState {
  rng: RngState;
  turn: number;
  player: NodeId;
  ships: Ship[];
  rumors: Rumor[];
  know: SeaKnowledge;
  nextRumor: number;
}

export const DEFAULT_FLEET: Record<ShipKind, number> = {
  merchant: 4,
  hunter: 2,
  'treasure-ship': 1,
  'treasure-fleet': 1,
  armada: 1,
};

export function createSea(seed: number): Sea {
  return { map: generateMap(seed), pattern: generatePattern(seed) };
}

export function createWorld(sea: Sea, seed: number, fleet = DEFAULT_FLEET): WorldState {
  const r: Roller = { rng: (seed ^ 0x0ce4) >>> 0 };
  const ships = spawnShips(sea, r, fleet);
  return {
    rng: r.rng,
    turn: 0,
    player: pick(r, ports(sea.map)),
    ships,
    rumors: [],
    know: { currents: false, winds: false },
    nextRumor: 0,
  };
}

/** You sail to `to` (a neighbour, or where you are), then everyone else moves. */
export function advance(sea: Sea, s: WorldState, to: NodeId): WorldState {
  if (to !== s.player && !sea.map.adj[s.player].includes(to)) {
    throw new Error(`node ${to} is not next to ${s.player}`);
  }
  const r: Roller = { rng: s.rng };
  const ships = s.ships.map((ship) => ({ ...ship }));
  for (const ship of ships) moveShip(sea, r, ship, s.turn, to);
  return {
    ...s,
    rng: r.rng,
    turn: s.turn + 1,
    player: to,
    ships,
    // Faded markers are dropped; what they said is no longer worth acting on.
    rumors: s.rumors.filter((rumor) => markerStrength(rumor, s.turn + 1) >= FADED),
  };
}

/**
 * A rumor about a ship, true as of now. From interrogation after a fight, or
 * bought in port; the caller decides which ship and how reliable the source.
 */
export function hearRumor(sea: Sea, s: WorldState, shipId: number, reliability: number): WorldState {
  const ship = s.ships.find((x) => x.id === shipId);
  if (!ship) throw new Error(`no ship ${shipId}`);
  const r: Roller = { rng: s.rng };
  const rumor = makeRumor(sea, r, s.nextRumor, ship, s.turn, reliability);
  return { ...s, rng: r.rng, rumors: [...s.rumors, rumor], nextRumor: s.nextRumor + 1 };
}

/** Learning the sea, from charts or an almanac. */
export function learn(s: WorldState, what: Partial<SeaKnowledge>): WorldState {
  return { ...s, know: { ...s.know, ...what } };
}
