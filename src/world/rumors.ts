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
import { HABITS, type Sea, type Ship, type ShipKind, movesOn, onward } from './ships.ts';

export interface Rumor {
  id: number;
  shipId: number;
  kind: ShipKind;
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
  return { id, shipId: ship.id, kind: ship.kind, reported, turn, reliability };
}

/**
 * Where the ship could be now, as a probability per node.
 *
 * Starts from the report — all of `reliability` on the reported node, the
 * rest spread over the nodes it could be off by — then sails it forward a
 * turn at a time, the way its kind sails:
 *
 * - merchants and treasure runs are bound for a port, but which one is not
 *   known, so every port is weighed equally;
 * - hunters are bound for you (`player`), and stay once they reach you;
 * - armadas go where the sea takes them;
 * - slow kinds only move on even turns.
 *
 * Within that, the observer can only weigh the legs out of a node by what it
 * knows of the sea (`know`). Knowing nothing, every leg looks the same.
 */
export function predict(sea: Sea, rumor: Rumor, now: number, know: SeaKnowledge, player: NodeId): number[] {
  const { map, pattern } = sea;
  const N = map.nodes.length;
  const harbours = ports(map);
  const goals: (NodeId | null)[] =
    rumor.kind === 'armada' ? [null] : rumor.kind === 'hunter' ? [player] : harbours;

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
  const loads = rumor.kind === 'merchant';

  for (let t = rumor.turn; t < now; t++) {
    if (!movesOn(rumor.kind, t)) continue;
    const q = goals.map(() => new Array<number>(N).fill(0));
    const spread = (gi: number, from: NodeId, to: NodeId[], mass: number, like: number[] = to.map(() => 1)) => {
      const w = to.map((m, i) => like[i] * legWeight(map, pattern, from, m, t, know));
      const total = w.reduce((x, y) => x + y, 0);
      to.forEach((m, i) => (q[gi][m] += (mass * w[i]) / total));
    };

    // Bound for a goal: the legs it would consider, as it weighs them.
    const goTo = (gi: number, n: NodeId, goal: NodeId | null, mass: number) => {
      const legs = goal === null ? [] : onward(map, n, goal);
      if (!legs.length) return spread(gi, n, map.adj[n], mass);
      spread(gi, n, legs.map(([m]) => m), mass, legs.map(([, f]) => f));
    };

    goals.forEach((goal, gi) => {
      for (let n = 0; n < N; n++) {
        const mass = p[gi][n];
        if (mass === 0) continue;

        // A hunter that has found you stays on you.
        if (rumor.kind === 'hunter' && n === goal) {
          q[gi][n] += mass;
          continue;
        }

        // Arrived: bound somewhere else now. Merchants spend the turn loading.
        if (goal !== null && n === goal) {
          const others = goals.map((g, i) => [g, i] as const).filter(([g]) => g !== n);
          for (const [, gj] of others) {
            if (loads) q[gj][n] += mass / others.length;
            else goTo(gj, n, goals[gj], mass / others.length);
          }
          continue;
        }

        const out = map.adj[n];
        if (goal === null) {
          spread(gi, n, out, mass);
          continue;
        }
        spread(gi, n, out, mass * drift);
        goTo(gi, n, goal, mass * (1 - drift));
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
