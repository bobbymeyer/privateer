/**
 * A rumor is a report that a ship was at a node, on a turn, from a source of
 * some reliability. It is true at that moment with probability `reliability`;
 * otherwise it is off by a few nodes, more for worse sources.
 *
 * Two things come out of one:
 *
 * - **the marker**, which fades every turn — how much the report itself is
 *   still worth;
 * - **the prediction**, a cloud of where the ship could be by now, which
 *   starts at the report and spreads as the ship sails on. Knowing the
 *   currents and the wind is what keeps it tight: the sea has a grain, and
 *   ships run with it.
 */

import { type NodeId, ports, ring } from './map.ts';
import { type Roller, pick, roll } from './random.ts';
import { type SeaKnowledge, legWeight } from './sea.ts';
import { HABITS, type Sea, type Ship, type ShipKind, graphFor, movesOn, onward, voyageFrom } from './ships.ts';

export interface Rumor {
  id: number;
  shipId: number;
  kind: ShipKind;
  /** The fixed course it keeps, if any. Treasure routes were common knowledge. */
  route: NodeId[] | null;
  /** Where the ship was said to be. */
  reported: NodeId;
  /** When it was said to be there. */
  turn: number;
  /** 0..1. The chance the report was exactly right. */
  reliability: number;
}

/** How far a wrong report can be off: one node for good sources, three for bad. */
export function maxOff(reliability: number): number {
  return reliability >= 0.85 ? 1 : reliability >= 0.6 ? 2 : 3;
}

/** The marker loses this share of its strength each turn. */
export const FADE = 0.8;
/** Below this, the marker is gone. */
export const FADED = 0.1;

export function markerStrength(rumor: Rumor, now: number): number {
  return rumor.reliability * FADE ** (now - rumor.turn);
}

export function makeRumor(sea: Sea, r: Roller, id: number, ship: Ship, turn: number, reliability: number): Rumor {
  let reported = ship.node;
  if (roll(r) >= reliability) {
    // Off by 1..maxOff hops; nearer if the sea is too small for that.
    for (let d = 1 + Math.floor(roll(r) * maxOff(reliability)); d >= 1; d--) {
      const candidates = ring(sea.map, ship.node, d);
      if (candidates.length) {
        reported = pick(r, candidates);
        break;
      }
    }
  }
  return { id, shipId: ship.id, kind: ship.kind, route: ship.route, reported, turn, reliability };
}

/**
 * Where the ship could be now, as a probability per node.
 *
 * Starts from the report — all of `reliability` on the reported node, the
 * rest spread over the nodes it could be off by — then sails it forward a
 * turn at a time, the way its kind sails:
 *
 * - merchants are bound for a port, but which one is not known, so every
 *   port is weighed equally;
 * - treasure runs and the armada keep a known course, so only its ports
 *   are weighed, each bound for the next;
 * - either way, a ship spends a turn in each port it reaches;
 * - a treasure run that reaches the Atlantic is gone, and comes back in
 *   by the islands when the crossing is done — while it is away, the
 *   prediction adds up to less than one;
 * - hunters are bound for you (`player`), and stay once they reach you;
 * - slow kinds only move on even turns; deep keels keep off the banks.
 *
 * Within that, the observer can only weigh the legs out of a node by what it
 * knows of the sea (`know`). Knowing nothing, every leg looks the same.
 */
export function predict(sea: Sea, rumor: Rumor, now: number, know: SeaKnowledge, player: NodeId): number[] {
  const { map, pattern } = sea;
  const g = graphFor(map, rumor.kind);
  const N = map.nodes.length;
  const hunter = rumor.kind === 'hunter';
  const goals: NodeId[] = hunter ? [player] : rumor.route ?? ports(map);
  /** Where a ship bound for goals[i] goes next, once there. */
  const after = (i: number): number[] =>
    rumor.route ? [(i + 1) % goals.length] : goals.map((_, j) => j).filter((j) => j !== i);

  // p[g][n]: bound for goals[g], at node n.
  const start = map.nodes.map(() => 0);
  start[rumor.reported] = rumor.reliability;
  const near = map.nodes.filter((n) => {
    const d = map.dist[rumor.reported][n.id];
    return d >= 1 && d <= maxOff(rumor.reliability);
  });
  for (const n of near) start[n.id] += (1 - rumor.reliability) / near.length;
  if (!near.length) start[rumor.reported] = 1;
  let p = goals.map(() => start.map((v) => v / goals.length));

  const drift = HABITS[rumor.kind].drift;

  // Mass that has sailed for Europe: when it comes back, where, bound for which stop.
  const crossing: { back: number; node: NodeId; gi: number; mass: number }[] = [];

  for (let t = rumor.turn; t < now; t++) {
    const q = goals.map(() => new Array<number>(N).fill(0));
    for (const c of crossing) if (c.back === t) q[c.gi][c.node] += c.mass;
    if (!movesOn(rumor.kind, t)) {
      p = p.map((row, gi) => row.map((v, n) => v + q[gi][n]));
      continue;
    }
    // A leg's weight depends on the turn, not the goal: worked out once per turn.
    const cache = new Map<number, number>();
    const weigh = (from: NodeId, to: NodeId) => {
      const k = from * N + to;
      let v = cache.get(k);
      if (v === undefined) cache.set(k, (v = legWeight(map, pattern, from, to, t, know)));
      return v;
    };
    const spread = (gi: number, from: NodeId, to: NodeId[], mass: number, like: number[] = to.map(() => 1), pull = 1) => {
      if (!to.length) return void (q[gi][from] += mass);
      const w = to.map((m, i) => like[i] * weigh(from, m) ** pull);
      const total = w.reduce((x, y) => x + y, 0);
      to.forEach((m, i) => (q[gi][m] += (mass * w[i]) / total));
    };

    goals.forEach((goal, gi) => {
      for (let n = 0; n < N; n++) {
        const mass = p[gi][n];
        if (mass === 0) continue;

        if (n === goal) {
          // A hunter that has found you stays on you; anyone else spends the
          // turn in port and is bound for the next — or sails for Europe.
          const voyage = rumor.route ? voyageFrom(map, n) : null;
          if (hunter) q[gi][n] += mass;
          else if (voyage) {
            const inbound = (gi + 1) % goals.length;
            crossing.push({ back: t + voyage.turns, node: goals[inbound], gi: (inbound + 1) % goals.length, mass });
          } else for (const gj of after(gi)) q[gj][n] += mass / after(gi).length;
          continue;
        }

        const legs = onward(g, n, goal);
        spread(gi, n, g.adj[n], mass * (legs.length ? drift : 1));
        if (legs.length) spread(gi, n, legs.map(([m]) => m), mass * (1 - drift), legs.map(([, f]) => f), HABITS[rumor.kind].pull);
      }
    });
    p = q;
  }

  return map.nodes.map((n) => p.reduce((sum, row) => sum + row[n.id], 0));
}

/** The fewest nodes that together hold `mass` of the prediction: the ring to search. */
export function searchArea(p: number[], mass = 0.7): NodeId[] {
  const order = p.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const out: NodeId[] = [];
  let sum = 0;
  for (const [v, i] of order) {
    if (sum >= mass) break;
    out.push(i);
    sum += v;
  }
  return out;
}
