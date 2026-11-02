/**
 * The world between encounters: you, the other ships, the turn, and what you
 * have heard. Pure, like the encounter rules: state in, state out.
 *
 * The sea itself — map, currents, wind — is fixed by the seed, so it is
 * built once by `createSea` and passed alongside rather than copied each turn.
 */

import type { RngState } from '../rng.ts';
import { buildMap, type NodeId, portNamed, ports } from './map.ts';
import { type Nation, PORTS, adjective, navyOf } from './ports.ts';
import { type Rumor, FADED, makeRumor, markerStrength } from './rumors.ts';
import { buildPattern, type Chart, CURRENT_SEEN, chartKnowledge, type SeaKnowledge, seasonOf, windSeen } from './sea.ts';
import { type FleetEntry, type Sea, type Ship, type Standing, mayEnter, moveShip, spawnShips } from './ships.ts';
import { type Roller, roll } from './random.ts';
import { type Outfit, START_OUTFIT, maxHullOf } from '../outfit.ts';
import { type Hail, type Meeting, REFIT_DAYS, type Reckoning, YOUR_NATION, meeting } from './meet.ts';

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
  /** How each nation regards you. Attack its ships and it falls; below zero, its guard ships hunt you. It drifts back toward zero. */
  standing: Standing;
  /** Your ship, its refits, your crew: what your deck is made of. */
  outfit: Outfit;
  /** Uncharted islands, a few to a run, out where nobody sails. */
  islands: { node: NodeId; found: boolean }[];
  /** Home to London with a score: the run is won. */
  won: boolean;
  /** A ship alongside, waiting on your choice. While there is one, the world waits. */
  hail: Hail | null;
  /** You fired on an English ship. England wants you, and London will hang you, until you're pardoned. */
  pirate: boolean;
  /** Ports sacked, and the turn until which they have nothing for anybody. */
  sacked: Record<NodeId, number>;
  /** Nations whose towns you've raided, and the turn until which their guard ships hunt twice as far. */
  alarm: Partial<Record<Nation, number>>;
  /** What happened that you'd hear about: navies driving off intruders, and the like. */
  log: { turn: number; text: string }[];
}

/** Days of each ship's wake that are remembered. */
export const TRAIL = 12;
export const START_GOLD = 20;
/** The score you need home in London to win. */
export const GOAL = 150;
export const HOME = 'London';
/** Every this many days, each nation's standing drifts a point back toward zero. */
export const STANDING_DECAY = 60;
/** Uncharted islands in a run, and what the Crown pays for charting one. */
export const ISLANDS = 8;
export const CHARTING_BOUNTY = 15;

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

/**
 * Where the powers keep guard ships that will come after you. Out where
 * control is weak — not in Europe, whose home waters their navies keep.
 */
export const HUNTER_STATIONS = ['Havana', 'Cartagena', 'San Juan', 'Callao', 'Goa', 'Batavia', 'Manila', 'Algiers', 'Port Royal', 'Bridgetown'];

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

/**
 * Where this run's uncharted islands lie: open ocean, nobody's waters, far
 * from every port and from each other.
 */
function placeIslands(sea: Sea, r: Roller): NodeId[] {
  const { map } = sea;
  const harbours = ports(map);
  const candidates = map.nodes.filter((n) => n.kind === 'ocean' && n.waters === null && Math.abs(n.lat) < 55);
  const placed: NodeId[] = [];
  for (let tries = 0; placed.length < ISLANDS && tries < 500; tries++) {
    const n = candidates[Math.floor(roll(r) * candidates.length)].id;
    const farFromPorts = harbours.every((p) => map.distTo(p)[n] >= 8);
    const farFromOthers = placed.every((q) => map.distTo(q)[n] >= 15);
    if (farFromPorts && farFromOthers) placed.push(n);
  }
  return placed;
}

export function createWorld(sea: Sea, seed: number, fleet = DEFAULT_FLEET): WorldState {
  const player = portNamed(sea.map, START);
  const ships = spawnShips(sea, fleet);
  const r: Roller = { rng: (seed ^ 0x0ce4) >>> 0 };
  const islands = placeIslands(sea, r).map((node) => ({ node, found: false }));
  return {
    rng: r.rng,
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
    hull: maxHullOf(START_OUTFIT),
    maxHull: maxHullOf(START_OUTFIT),
    encounter: null,
    reckoning: null,
    parted: {},
    sunk: false,
    standing: {},
    log: [],
    outfit: START_OUTFIT,
    islands,
    won: false,
    hail: null,
    pirate: false,
    sacked: {},
    alarm: {},
  };
}

/** You sail to `to` (a neighbour, or where you are), then everyone else moves. */
export function advance(sea: Sea, s: WorldState, to: NodeId): WorldState {
  if (s.sunk) throw new Error('you went down; the run is over');
  if (s.won) throw new Error('you are home and the run is won');
  if (s.encounter) throw new Error('there is a fight to finish first');
  if (s.hail) throw new Error('a ship is alongside: attack, or let her pass');
  if (to !== s.player && !sea.map.adj[s.player].includes(to)) {
    throw new Error(`node ${to} is not next to ${s.player}`);
  }
  const r: Roller = { rng: s.rng };
  const ships = s.ships.map((ship) => ({ ...ship }));
  const alarmed = (n: Nation) => (s.alarm[n] ?? -1) > s.turn;
  for (const ship of ships) moveShip(sea, r, ship, s.turn, to, s.standing, alarmed);

  // Countries protect their waters: a foreign guard ship found inside them
  // is driven off by the navy and laid up at home.
  const log = [...s.log];
  for (const ship of ships) {
    const owner = sea.map.nodes[ship.node].waters;
    if (ship.laidUp > s.turn || mayEnter(sea.map, ship, ship.node) || !owner) continue;
    log.push({ turn: s.turn + 1, text: `${navyOf(owner)} drove off a ${adjective(ship.nation)} guard ship` });
    Object.assign(ship, { node: ship.home, laidUp: s.turn + 1 + REFIT_DAYS, dest: null });
  }
  const turn = s.turn + 1;

  // Islands: sighted within sight, paid for once; an anchorage after.
  let gold = s.gold;
  let hull = s.hull;
  const near = sea.map.distTo(to);
  const islands = s.islands.map((isle) => {
    if (isle.found || near[isle.node] > s.sight) return isle;
    gold += CHARTING_BOUNTY;
    log.push({ turn, text: `you sighted land nobody has charted, and the Crown will pay ${CHARTING_BOUNTY} for it` });
    return { ...isle, found: true };
  });
  if (atIsland({ ...s, islands }, to)) hull = Math.min(s.maxHull, hull + 1);

  // Grudges fade.
  const standing =
    turn % STANDING_DECAY === 0
      ? Object.fromEntries(Object.entries(s.standing).map(([n, v]) => [n, s.pirate && n === YOUR_NATION ? v! : v! - Math.sign(v!)]))
      : s.standing;

  const next: WorldState = {
    ...s,
    rng: r.rng,
    turn,
    player: to,
    ships,
    // Faded markers are dropped; what they said is no longer worth acting on.
    rumors: s.rumors.filter((rumor) => markerStrength(rumor, turn) >= FADED),
    chart: observe(sea, s.chart, to, s.sight, turn),
    trail: s.ships.map((ship, i) => [ship.node, ...s.trail[i]].slice(0, TRAIL)),
    rounds: 0,
    log,
    islands,
    gold,
    hull,
    standing,
  };
  // Home with a score — and no noose waiting.
  if (sea.map.nodes[to].port?.name === HOME && gold >= GOAL && !s.pirate) {
    return { ...next, won: true, log: [...log, { turn, text: `home to London with ${gold}: the run is won` }] };
  }
  return meeting(sea, next);
}

/** A charted island you're lying at: no ship troubles you there, and the hull mends a point a day. */
export const atIsland = (s: WorldState, node = s.player) => s.islands.some((i) => i.found && i.node === node);

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
