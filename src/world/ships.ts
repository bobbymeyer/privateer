/**
 * Who sails the sea besides you, and how each kind moves. Ports are targets
 * too, but they don't move, so they are nodes on the map, not ships.
 */

import { type Graph, type NodeId, type SeaMap, portNamed, ports } from './map.ts';
import { ROUTES } from './ocean.ts';
import { type Roller, roll, weighted } from './random.ts';
import { type SeaPattern, legWeight } from './sea.ts';

export type ShipKind = 'merchant' | 'hunter' | 'treasure-ship' | 'treasure-fleet' | 'armada';

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
}

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
  'treasure-ship': { slow: false, drift: 0.1, deep: true, pull: 1 },
  'treasure-fleet': { slow: true, drift: 0.1, deep: true, pull: 1 },
  armada: { slow: true, drift: 0.3, deep: true, pull: 1 },
};

/** Merchants trade within this many days of where they are. */
export const TRADE_RANGE = 30;
/** Hunters chase you while you are within this many days of their station. */
export const HUNT_RANGE = 25;
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

/** Where a hunter stationed at `home` is bound, given where you are. */
export const hunterGoal = (map: SeaMap, home: NodeId, player: NodeId) => (map.distTo(home)[player] <= HUNT_RANGE ? player : home);

/**
 * How much a ship likes a leg that keeps its distance, against one that
 * closes it. Above zero, a ship will go round to run with the sea, which is
 * what gives the sea its grain on routes and not only on drift.
 */
export const SIDESTEP = 0.5;

/** The legs a ship bound for `dest` will consider, with how much it likes each. */
export function onward(g: Graph, from: NodeId, dest: NodeId): [NodeId, number][] {
  const d = g.distTo(dest);
  const here = d[from];
  return g.adj[from]
    .map((m): [NodeId, number] => [m, d[m] < here ? 1 : d[m] === here ? SIDESTEP : 0])
    .filter(([, f]) => f > 0);
}

/**
 * One turn of movement. `hunted` is where you are.
 * Mutates `ship`; the caller has already copied it.
 */
export function moveShip(sea: Sea, r: Roller, ship: Ship, turn: number, hunted: NodeId): void {
  const { map, pattern } = sea;
  if (!movesOn(ship.kind, turn)) return;
  const g = graphFor(map, ship.kind);

  if (ship.kind === 'hunter') {
    ship.dest = hunterGoal(map, ship.home, hunted);
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
  if (ship.dest !== ship.node && roll(r) >= HABITS[ship.kind].drift) {
    const legs = onward(g, ship.node, ship.dest);
    if (legs.length) {
      ship.node = legs[weighted(r, legs.map(([m, f]) => f * weightOf(m) ** HABITS[ship.kind].pull))][0];
      return;
    }
  }
  const out = g.adj[ship.node];
  if (out.length) ship.node = out[weighted(r, out.map(weightOf))];
}

/** Who sails, from where, and on what course. */
export interface FleetEntry {
  kind: ShipKind;
  /** The port it fits out from. Route ships start at their route's first port. */
  home?: string;
  route?: keyof typeof ROUTES;
}

export function spawnShips(sea: Sea, fleet: FleetEntry[]): Ship[] {
  const { map } = sea;
  return fleet.map((entry, id) => {
    const route = entry.route ? ROUTES[entry.route].map((name) => portNamed(map, name)) : null;
    const home = route ? route[0] : portNamed(map, entry.home ?? 'Havana');
    return { id, kind: entry.kind, node: home, dest: route ? route[1] : null, route, routeName: entry.route ?? null, leg: route ? 1 : 0, home };
  });
}
