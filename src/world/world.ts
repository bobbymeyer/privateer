/**
 * The world between encounters: you, the other ships, the turn, and what you
 * have heard. Pure, like the encounter rules: state in, state out.
 *
 * The sea itself — map, currents, wind — is fixed by the seed, so it is
 * built once by `createSea` and passed alongside rather than copied each turn.
 */

import type { RngState } from '../rng.ts';
import { buildMap, type NodeId, portNamed } from './map.ts';
import { PORTS } from './ports.ts';
import { type Rumor, FADED, makeRumor, markerStrength } from './rumors.ts';
import { buildPattern, type SeaKnowledge } from './sea.ts';
import { type FleetEntry, type Sea, type Ship, moveShip, spawnShips } from './ships.ts';
import type { Roller } from './random.ts';

export interface WorldState {
  rng: RngState;
  turn: number;
  player: NodeId;
  ships: Ship[];
  rumors: Rumor[];
  know: SeaKnowledge;
  nextRumor: number;
}

/** Where the powers keep guard ships that will come after you. */
export const HUNTER_STATIONS = ['Havana', 'Cartagena', 'San Juan', 'Callao', 'Cádiz', 'Lisbon', 'Goa', 'Batavia', 'Manila', 'Algiers'];

/** A merchant out of every port, a guard ship at every station, and the great courses. */
export const DEFAULT_FLEET: FleetEntry[] = [
  ...PORTS.map((p): FleetEntry => ({ kind: 'merchant', home: p.name })),
  ...HUNTER_STATIONS.map((home): FleetEntry => ({ kind: 'hunter', home })),
  { kind: 'treasure-fleet', route: 'flota' },
  { kind: 'treasure-fleet', route: 'galeones' },
  { kind: 'treasure-fleet', route: 'south sea fleet' },
  { kind: 'treasure-ship', route: 'manila galleon' },
  { kind: 'treasure-ship', route: 'carreira' },
  { kind: 'treasure-ship', route: 'retourvloot' },
  { kind: 'armada', route: 'barlovento' },
  { kind: 'armada', route: 'mar océano' },
];

let built: Sea | null = null;

/** The sea is the same every run — built once, then shared. */
export function createSea(): Sea {
  if (!built) {
    const map = buildMap();
    built = { map, pattern: buildPattern(map) };
  }
  return built;
}

/** Drake fitted out at Plymouth. */
export const START = 'Plymouth';

export function createWorld(sea: Sea, seed: number, fleet = DEFAULT_FLEET): WorldState {
  return {
    rng: (seed ^ 0x0ce4) >>> 0,
    turn: 0,
    player: portNamed(sea.map, START),
    ships: spawnShips(sea, fleet),
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
