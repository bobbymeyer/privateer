/**
 * Who sails the sea besides you, and how each kind moves. Ports are targets
 * too, but they don't move, so they are nodes on the map, not ships.
 */

import { type Graph, type NodeId, type SeaMap, portNamed, ports } from './map.ts';
import { distanceNm } from './geo.ts';
import { ROUTES } from './ocean.ts';
import type { Nation } from './ports.ts';
import { type Roller, roll, weighted } from './random.ts';
import { type SeaPattern, legWeight } from './sea.ts';

export type ShipKind = 'merchant' | 'hunter' | 'privateer' | 'corsair' | 'treasure-ship' | 'treasure-fleet' | 'armada' | 'monster';

export interface Ship {
  id: number;
  kind: ShipKind;
  node: NodeId;
  /** Where it is headed. */
  dest: NodeId | null;
  /** A fixed course of ports, sailed in order and round again. */
  route: NodeId[] | null;
  /** The name of that course, from ocean.ts. */
  routeName: string | null;
  /** Which stop of the route it is bound for. */
  leg: number;
  /** Where it fits out, and where a hunter keeps station. */
  home: NodeId;
  /** Sunk or taken: laid up at home, refitting, until this turn. */
  laidUp: number;
  /** Whose flag it flies: its home port's. */
  nation: Nation;
}

/** How each nation regards you. Below zero, its guard ships hunt you. */
export type Standing = Partial<Record<Nation, number>>;
export const wantedBy = (standing: Standing, nation: Nation) => (standing[nation] ?? 0) < 0;

export interface KindHabits {
  /** Moves only on even turns. Everybody who knows the sea knows this. */
  slow: boolean;
  /** Chance on any turn of ignoring its goal and going where the sea takes it. */
  drift: number;
  /** Draws too much water for the banks. */
  deep: boolean;
  /**
   * How much the sea decides its heading when it is bound somewhere: the
   * leg weight is raised to this. 1 for square-riggers, which go round
   * rather than beat; less for weatherly craft that can work upwind.
   */
  pull: number;
}

export const HABITS: Record<ShipKind, KindHabits> = {
  merchant: { slow: false, drift: 0.2, deep: false, pull: 1 },
  // Guard ships: small, weatherly, able to work to windward.
  hunter: { slow: false, drift: 0.15, deep: false, pull: 0.4 },
  // Enemy privateers: fast, weatherly raiders out of their own ports.
  privateer: { slow: false, drift: 0.2, deep: false, pull: 0.5 },
  // Barbary corsairs: galleys and xebecs, quick and weatherly, out for any ship they can take.
  corsair: { slow: false, drift: 0.15, deep: false, pull: 0.4 },
  // A sea monster goes where the current takes it, but never far from its own sea.
  monster: { slow: false, drift: 0.85, deep: false, pull: 1 },
  'treasure-ship': { slow: false, drift: 0.1, deep: true, pull: 1 },
  'treasure-fleet': { slow: true, drift: 0.1, deep: true, pull: 1 },
  armada: { slow: true, drift: 0.3, deep: true, pull: 1 },
};

/** Merchants trade within this many days of where they are. */
export const TRADE_RANGE = 30;
/** Hunters chase you while you are within this many days of their station. */
export const HUNT_RANGE = 25;
/** Privateers chase you while you are within this many days of their home port. */
export const PRIVATEER_RANGE = 10;

/** What a pursuer needs to know of the world to decide whether to come after you. */
export interface Pursuit {
  /** How each nation regards you: a guard ship comes once its nation wants you. */
  standing: Standing;
  /** A nation whose towns you've raided lately: its guard ships hunt twice as far. */
  alarmed: (n: Nation) => boolean;
  /** A nation at war with England: its privateers come for you. */
  enemy: (n: Nation) => boolean;
  /** Ships that have fought you and gone off for easier prey, for now. */
  leftBe?: (id: number) => boolean;
}
export const NO_PURSUIT: Pursuit = { standing: {}, alarmed: () => false, enemy: () => false };
/** A corsair cruises no farther than this many days from home. */
export const CORSAIR_REACH = 45;
/** A sea monster wanders no farther than this many days from the heart of its sea. */
export const MONSTER_RANGE = 12;
/** And past that, how often it still goes where the sea takes it rather than home. */
export const MONSTER_HOMING_DRIFT = 0.2;

/** Merchants trade mostly with their own flag: this much likelier. */
export const HOME_TRADE = 3;

export interface Sea {
  map: SeaMap;
  pattern: SeaPattern;
}

/** The water a kind can sail. */
export const graphFor = (map: SeaMap, kind: ShipKind): Graph => (HABITS[kind].deep ? map.deep : map);

/** Whether a ship of this kind moves at all on this turn. */
export const movesOn = (kind: ShipKind, turn: number) => !HABITS[kind].slow || turn % 2 === 0;

/** The ports a merchant at `node` might sail for next. */
export function tradingPorts(map: SeaMap, node: NodeId): NodeId[] {
  return ports(map).filter((p) => p !== node && map.distTo(p)[node] <= TRADE_RANGE);
}

/**
 * Where a hunter is bound. It keeps station unless its nation wants you,
 * you're within its range, and you're not in another nation's protected
 * waters — which a guard ship won't enter.
 */
export function hunterGoal(map: SeaMap, hunter: { home: NodeId; nation: Nation }, player: NodeId, standing: Standing, alarmed = false): NodeId {
  if (!wantedBy(standing, hunter.nation)) return hunter.home;
  if (!mayEnter(map, { kind: 'hunter', nation: hunter.nation }, player)) return hunter.home;
  // A raid raises the alarm: for a while they hunt twice as far.
  return map.distTo(hunter.home)[player] <= HUNT_RANGE * (alarmed ? 2 : 1) ? player : hunter.home;
}

/**
 * Where a privateer is bound: after you, if her nation is at war with
 * England and you're in her range; else home. Unlike a guard ship she goes
 * where she likes — raiding other nations' coasts is the trade.
 */
export function privateerGoal(map: SeaMap, ship: { home: NodeId; nation: Nation }, player: NodeId, enemy: boolean): NodeId {
  if (!enemy) return ship.home;
  return map.distTo(ship.home)[player] <= PRIVATEER_RANGE ? player : ship.home;
}

/** Whether this kind goes after you at all. */
export const pursues = (kind: ShipKind) => kind === 'hunter' || kind === 'privateer';

/** Where a pursuer is bound, by kind. */
export function pursuerGoal(map: SeaMap, ship: { kind: ShipKind; home: NodeId; nation: Nation; id?: number }, player: NodeId, p: Pursuit): NodeId {
  if (ship.kind === 'privateer' && ship.id != null && p.leftBe?.(ship.id)) return ship.home;
  return ship.kind === 'privateer'
    ? privateerGoal(map, ship, player, p.enemy(ship.nation))
    : hunterGoal(map, ship, player, p.standing, p.alarmed(ship.nation));
}

/**
 * Countries protect their waters: a guard ship stays out of any other
 * nation's. Everyone else may go where they like, privateers included.
 */
export const mayEnter = (map: SeaMap, ship: { kind: ShipKind; nation: Nation }, node: NodeId) =>
  ship.kind !== 'hunter' || map.nodes[node].waters === null || map.nodes[node].waters === ship.nation;

/**
 * How much a ship likes a leg that keeps its distance, against one that
 * closes it. Above zero, a ship will go round to run with the sea, which is
 * what gives the sea its grain on routes and not only on drift.
 */
export const SIDESTEP = 0.5;

/** The legs a ship bound for `dest` will consider, with how much it likes each. */
export function onward(g: Graph, from: NodeId, dest: NodeId, allowed: (n: NodeId) => boolean = () => true): [NodeId, number][] {
  const d = g.distTo(dest);
  const here = d[from];
  return g.adj[from]
    .filter(allowed)
    .map((m): [NodeId, number] => [m, d[m] < here ? 1 : d[m] === here ? SIDESTEP : 0])
    .filter(([, f]) => f > 0);
}

/**
 * One turn of movement. `hunted` is where you are; `standing`, who wants you.
 * Mutates `ship`; the caller has already copied it.
 */
export function moveShip(sea: Sea, r: Roller, ship: Ship, turn: number, hunted: NodeId, pursuit: Pursuit = NO_PURSUIT): void {
  const { map, pattern } = sea;
  if (ship.laidUp > turn) return;
  if (!movesOn(ship.kind, turn)) return;
  const g = graphFor(map, ship.kind);

  const allowed = (n: NodeId) => mayEnter(map, ship, n);
  if (ship.kind === 'monster') {
    // Drifting with the current, and back toward its own sea if it strays.
    ship.dest = map.distTo(ship.home)[ship.node] > MONSTER_RANGE ? ship.home : null;
  } else if (ship.kind === 'corsair') {
    // Out to cruise off a port within reach, where the shipping is, and home between cruises.
    if (ship.dest === null || ship.node === ship.dest) {
      ship.dest = ship.node === ship.home ? corsairGround(map, r, ship) : ship.home;
      return;
    }
  } else if (pursues(ship.kind)) {
    ship.dest = pursuerGoal(map, ship, hunted, pursuit);
    if (ship.node === hunted && ship.dest === hunted) return; // found you
  } else if (ship.dest === null || ship.node === ship.dest) {
    // In port: a turn to load, and the next port picked.
    if (ship.route) {
      ship.leg = (ship.leg + 1) % ship.route.length;
      ship.dest = ship.route[ship.leg];
    } else {
      const here = map.nodes[ship.node].port?.nation;
      const options = tradingPorts(map, ship.node);
      ship.dest = options.length ? options[weighted(r, options.map((p) => (map.nodes[p].port!.nation === here ? HOME_TRADE : 1)))] : ship.home;
    }
    return;
  }

  const weightOf = (m: NodeId) => legWeight(map, pattern, ship.node, m, turn);
  // A monster out of its sea turns for home in earnest.
  const drift = ship.kind === 'monster' && ship.dest !== null ? MONSTER_HOMING_DRIFT : HABITS[ship.kind].drift;
  if (ship.dest !== null && ship.dest !== ship.node && roll(r) >= drift) {
    const legs = onward(g, ship.node, ship.dest, allowed);
    if (legs.length) {
      ship.node = legs[weighted(r, legs.map(([m, f]) => f * weightOf(m) ** HABITS[ship.kind].pull))][0];
      return;
    }
  }
  const out = g.adj[ship.node].filter(allowed);
  if (out.length) ship.node = out[weighted(r, out.map(weightOf))];
}

/** Who sails, from where, and on what course. */
export interface FleetEntry {
  kind: ShipKind;
  /** The port it fits out from. Route ships start at their route's first port. */
  home?: string;
  route?: keyof typeof ROUTES;
  /** For a monster: the heart of its sea, in longitude and latitude, and the sea's name. */
  at?: [number, number];
  sea?: string;
}

export function spawnShips(sea: Sea, fleet: FleetEntry[]): Ship[] {
  const { map } = sea;
  return fleet.map((entry, id) => {
    if (entry.at) {
      const home = nearestOpen(map, entry.at);
      return { id, kind: entry.kind, node: home, dest: null, route: null, routeName: entry.sea ?? null, leg: 0, home, laidUp: 0, nation: 'local' as Nation };
    }
    const route = entry.route ? ROUTES[entry.route].map((name) => portNamed(map, name)) : null;
    const home = route ? route[0] : portNamed(map, entry.home ?? 'Havana');
    const nation = map.nodes[home].port!.nation;
    return { id, kind: entry.kind, node: home, dest: route ? route[1] : null, route, routeName: entry.route ?? null, leg: route ? 1 : 0, home, laidUp: 0, nation };
  });
}

/** The open-water node nearest a point: where a monster keeps. */
function nearestOpen(map: SeaMap, at: [number, number]): NodeId {
  let best = 0;
  let bestD = Infinity;
  for (const n of map.nodes) {
    if (n.kind !== 'ocean' || n.port || !map.adj[n.id].length) continue;
    const d = distanceNm(at, [n.lon, n.lat]);
    if (d < bestD) [best, bestD] = [n.id, d];
  }
  return best;
}

/** A cruising ground for a corsair: off a port within its reach, the nearer the likelier. */
export function corsairGround(map: SeaMap, r: Roller, ship: { home: NodeId }): NodeId {
  const d = map.distTo(ship.home);
  const grounds = ports(map).filter((p) => p !== ship.home && d[p] <= CORSAIR_REACH);
  if (!grounds.length) return ship.home;
  return grounds[weighted(r, grounds.map((p) => 1 / (5 + d[p])))];
}
