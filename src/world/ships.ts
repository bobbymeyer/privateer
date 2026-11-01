/**
 * Who sails the sea besides you, and how each kind moves. Ports are targets
 * too, but they don't move, so they are nodes on the map, not ships.
 */

import { type NodeId, type SeaMap, ports } from './map.ts';
import { type Roller, pick, roll, weighted } from './random.ts';
import { type SeaPattern, legWeight } from './sea.ts';

export type ShipKind = 'merchant' | 'hunter' | 'treasure-ship' | 'treasure-fleet' | 'armada';

export interface Ship {
  id: number;
  kind: ShipKind;
  node: NodeId;
  /** Where it is headed, for the kinds that head anywhere. */
  dest: NodeId | null;
  /** The two ports a treasure run shuttles between. */
  route: [NodeId, NodeId] | null;
}

export interface KindHabits {
  /** Moves only on even turns. Everybody who knows the sea knows this. */
  slow: boolean;
  /** Chance on any turn of ignoring its goal and going where the sea takes it. */
  drift: number;
}

export const HABITS: Record<ShipKind, KindHabits> = {
  merchant: { slow: false, drift: 0.2 },
  hunter: { slow: false, drift: 0.25 },
  'treasure-ship': { slow: false, drift: 0.1 },
  'treasure-fleet': { slow: true, drift: 0.1 },
  armada: { slow: true, drift: 1 },
};

export interface Sea {
  map: SeaMap;
  pattern: SeaPattern;
}

/** Whether a ship of this kind moves at all on this turn. */
export const movesOn = (kind: ShipKind, turn: number) => !HABITS[kind].slow || turn % 2 === 0;

/**
 * One turn of movement. `hunted` is where the hunters think you are.
 * Mutates `ship`; the caller has already copied it.
 */
export function moveShip(sea: Sea, r: Roller, ship: Ship, turn: number, hunted: NodeId): void {
  const { map, pattern } = sea;
  if (!movesOn(ship.kind, turn)) return;

  // Goals first: arriving somewhere picks the next place to go.
  if (ship.kind === 'hunter') {
    ship.dest = hunted;
    if (ship.node === hunted) return; // found you
  }
  else if (ship.route && ship.node === ship.dest) ship.dest = ship.route[0] === ship.dest ? ship.route[1] : ship.route[0];
  else if (ship.kind === 'merchant' && (ship.dest === null || ship.node === ship.dest)) {
    ship.dest = pick(r, ports(map).filter((p) => p !== ship.node));
    return; // a turn in port to load
  }

  const options = map.adj[ship.node];
  const weightOf = (m: NodeId) => legWeight(map, pattern, ship.node, m, turn);

  // Headed somewhere: choose among the legs that close the distance, by the sea.
  if (ship.dest !== null && roll(r) >= HABITS[ship.kind].drift) {
    const legs = onward(map, ship.node, ship.dest);
    if (legs.length) {
      ship.node = legs[weighted(r, legs.map(([m, f]) => f * weightOf(m)))][0];
      return;
    }
  }
  // Otherwise the sea decides.
  ship.node = options[weighted(r, options.map(weightOf))];
}

/**
 * How much a ship likes a leg that keeps its distance, against one that
 * closes it. Above zero, a ship will go round to run with the sea, which is
 * what gives the sea its grain on routes and not only on drift.
 */
export const SIDESTEP = 0.5;

/** The legs a ship bound for `dest` will consider, with how much it likes each. */
export function onward(map: SeaMap, from: NodeId, dest: NodeId): [NodeId, number][] {
  const here = map.dist[from][dest];
  return map.adj[from]
    .map((m): [NodeId, number] => [m, map.dist[m][dest] < here ? 1 : map.dist[m][dest] === here ? SIDESTEP : 0])
    .filter(([, f]) => f > 0);
}

export function spawnShips(sea: Sea, r: Roller, counts: Partial<Record<ShipKind, number>>): Ship[] {
  const { map } = sea;
  const harbours = ports(map);
  // Treasure runs between the two ports farthest apart, and the next pair.
  const pairs: [NodeId, NodeId][] = [];
  for (const a of harbours) for (const b of harbours) if (a < b) pairs.push([a, b]);
  pairs.sort((p, q) => map.dist[q[0]][q[1]] - map.dist[p[0]][p[1]]);

  const ships: Ship[] = [];
  let run = 0;
  for (const kind of Object.keys(counts) as ShipKind[]) {
    for (let i = 0; i < (counts[kind] ?? 0); i++) {
      const route = kind === 'treasure-ship' || kind === 'treasure-fleet' ? pairs[run++ % pairs.length] : null;
      const node = route ? route[0] : pick(r, map.nodes).id;
      ships.push({ id: ships.length, kind, node, dest: route ? route[1] : null, route });
    }
  }
  return ships;
}
