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
import { buildPattern, type Chart, CURRENT_SEEN, chartKnowledge, type SeaKnowledge, seasonOf, windSeen } from './sea.ts';
import { type FleetEntry, type Sea, type Ship, moveShip, spawnShips } from './ships.ts';
import type { Roller } from './random.ts';
import { SHIP } from '../setup.ts';
import { type Meeting, type Reckoning, meeting } from './meet.ts';

export interface WorldState {
  rng: RngState;
  turn: number;
  player: NodeId;
  ships: Ship[];
  rumors: Rumor[];
  nextRumor: number;
  /** In the purse. */
  gold: number;
  /** How many steps out you can see the water. The crew will extend it. */
  sight: number;
  /** What you have seen of the sea, node by node. See `chartKnowledge`. */
  chart: Chart;
  /** Where each ship has been, the day before first: what the bar's news is made of. */
  trail: NodeId[][];
  /** Rounds bought in this port tonight. Each one finds the drinkers less sober. */
  rounds: number;
  /** Your hull, carried from fight to fight; mended in port. */
  hull: number;
  maxHull: number;
  /** The fight at hand. While there is one, the world waits. */
  encounter: Meeting | null;
  /** How the last fight ended. */
  reckoning: Reckoning | null;
  /** Ships you've parted from, and the turn until which they leave you be. */
  parted: Record<number, number>;
  /** You went down. The run is over. */
  sunk: boolean;
}

/** Days of each ship's wake that are remembered. */
export const TRAIL = 12;
export const START_GOLD = 20;

/** What you can see from where you are: the water `sight` steps out, its current and this season's wind. */
export function observe(sea: Sea, chart: Chart, from: NodeId, sight: number, turn: number): Chart {
  const out = chart.slice();
  const bits = CURRENT_SEEN | windSeen(seasonOf(sea.pattern, turn));
  const depth = new Map<NodeId, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    out[n] |= bits;
    if (depth.get(n)! >= sight) continue;
    for (const m of sea.map.adj[n]) if (!depth.has(m)) (depth.set(m, depth.get(n)! + 1), queue.push(m));
  }
  return out;
}

/** The player's knowledge of the sea, for predictions. */
export const knowledge = (s: WorldState): SeaKnowledge => chartKnowledge(s.chart);

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
  const player = portNamed(sea.map, START);
  const ships = spawnShips(sea, fleet);
  return {
    rng: (seed ^ 0x0ce4) >>> 0,
    turn: 0,
    player,
    ships,
    rumors: [],
    nextRumor: 0,
    gold: START_GOLD,
    sight: 1,
    chart: observe(sea, new Uint8Array(sea.map.nodes.length), player, 1, 0),
    trail: ships.map(() => []),
    rounds: 0,
    hull: SHIP.hull,
    maxHull: SHIP.maxHull,
    encounter: null,
    reckoning: null,
    parted: {},
    sunk: false,
  };
}

/** You sail to `to` (a neighbour, or where you are), then everyone else moves. */
export function advance(sea: Sea, s: WorldState, to: NodeId): WorldState {
  if (s.sunk) throw new Error('you went down; the run is over');
  if (s.encounter) throw new Error('there is a fight to finish first');
  if (to !== s.player && !sea.map.adj[s.player].includes(to)) {
    throw new Error(`node ${to} is not next to ${s.player}`);
  }
  const r: Roller = { rng: s.rng };
  const ships = s.ships.map((ship) => ({ ...ship }));
  for (const ship of ships) moveShip(sea, r, ship, s.turn, to);
  return meeting(sea, {
    ...s,
    rng: r.rng,
    turn: s.turn + 1,
    player: to,
    ships,
    // Faded markers are dropped; what they said is no longer worth acting on.
    rumors: s.rumors.filter((rumor) => markerStrength(rumor, s.turn + 1) >= FADED),
    chart: observe(sea, s.chart, to, s.sight, s.turn + 1),
    trail: s.ships.map((ship, i) => [ship.node, ...s.trail[i]].slice(0, TRAIL)),
    rounds: 0,
  });
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

/** Gold in, from a prize. */
export const earn = (s: WorldState, amount: number): WorldState => ({ ...s, gold: s.gold + amount });
