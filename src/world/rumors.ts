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

import { type NodeId, ring } from './map.ts';
import { type Roller, pick, roll } from './random.ts';
import { type SeaKnowledge, legWeight } from './sea.ts';
import type { Nation } from './ports.ts';
import { HABITS, type Sea, type Ship, type ShipKind, type Standing, graphFor, hunterGoal, mayEnter, movesOn, onward, tradingPorts } from './ships.ts';

export interface Rumor {
  id: number;
  shipId: number;
  kind: ShipKind;
  /** The fixed course it keeps, if any. Treasure routes were common knowledge. */
  route: NodeId[] | null;
  /** Its home port: where a hunter keeps station. */
  home: NodeId;
  /** Its flag. */
  nation: Nation;
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
  return { id, shipId: ship.id, kind: ship.kind, route: ship.route, home: ship.home, nation: ship.nation, reported, turn, reliability };
}

/**
 * Where the ship could be now, as a probability per node.
 *
 * Starts from the report — all of `reliability` on the reported node, the
 * rest spread over the nodes it could be off by — then sails it forward a
 * turn at a time, the way its kind sails:
 *
 * - a merchant is bound for one of the ports it trades with, and nobody
 *   knows which, so each is weighed equally;
 * - treasure fleets and armadas keep a known course, so only its ports are
 *   weighed, each bound for the next;
 * - either way, a ship spends a turn in each port it reaches;
 * - a hunter is bound for you if its nation wants you and you're in its
 *   range and not in foreign waters, else for its station; it never enters
 *   another nation's waters;
 * - slow kinds only move on even turns; deep keels keep off the banks.
 *
 * Within that, the observer can only weigh the legs out of a node by what it
 * knows of the sea (`know`). Knowing nothing, every leg looks the same.
 */
export function predict(sea: Sea, rumor: Rumor, now: number, know: SeaKnowledge, player: NodeId, standing: Standing = {}): number[] {
  const { map, pattern } = sea;
  const g = graphFor(map, rumor.kind);
  const N = map.nodes.length;
  const hunter = rumor.kind === 'hunter';
  const huntGoal = hunterGoal(map, rumor, player, standing);
  const allowed = (n: NodeId) => mayEnter(map, rumor, n);

  // The ports it could be bound for, and from each, the ones it could go on to.
  let goals: NodeId[];
  let after: (i: number) => number[];
  if (hunter) {
    goals = [huntGoal];
    after = () => [0];
  } else if (rumor.route) {
    goals = rumor.route;
    after = (i) => [(i + 1) % goals.length];
  } else {
    const first = new Set(tradingPorts(map, rumor.reported));
    const all = new Set(first);
    for (const p of first) for (const q of tradingPorts(map, p)) all.add(q);
    goals = [...all];
    const index = new Map(goals.map((p, i) => [p, i]));
    // Worked out once: this runs in the innermost loop.
    const next = goals.map((g) => tradingPorts(map, g).map((q) => index.get(q)).filter((j): j is number => j !== undefined));
    after = (i) => next[i];
  }
  const firstPorts = new Set(hunter || rumor.route ? goals : tradingPorts(map, rumor.reported));
  const startWeight = (i: number) => (firstPorts.has(goals[i]) ? 1 : 0);
  const startTotal = goals.reduce((t, _, i) => t + startWeight(i), 0);

  // p[g][n]: bound for goals[g], at node n.
  const start = new Float64Array(N);
  start[rumor.reported] = rumor.reliability;
  const near = ringsWithin(sea, rumor.reported, maxOff(rumor.reliability));
  for (const n of near) start[n] += (1 - rumor.reliability) / near.length;
  if (!near.length) start[rumor.reported] = 1;
  let p = goals.map((_, i) => start.map((v) => (v * startWeight(i)) / startTotal));

  const drift = HABITS[rumor.kind].drift;

  for (let t = rumor.turn; t < now; t++) {
    if (!movesOn(rumor.kind, t)) continue;
    const q = goals.map(() => new Float64Array(N));
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
      const row = p[gi];
      for (let n = 0; n < N; n++) {
        const mass = row[n];
        if (mass === 0) continue;

        if (n === goal) {
          if (hunter) {
            // On you: stays. At its station with you out of range: drifts.
            if (goal === player) q[gi][n] += mass;
            else spread(gi, n, g.adj[n].filter(allowed), mass);
          } else {
            const next = after(gi);
            if (!next.length) q[gi][n] += mass;
            for (const gj of next) q[gj][n] += mass / next.length;
          }
          continue;
        }

        const legs = onward(g, n, goal, allowed);
        spread(gi, n, g.adj[n].filter(allowed), mass * (legs.length ? drift : 1));
        if (legs.length) spread(gi, n, legs.map(([m]) => m), mass * (1 - drift), legs.map(([, f]) => f), HABITS[rumor.kind].pull);
      }
    });
    p = q;
  }

  const out = new Array<number>(N).fill(0);
  for (const row of p) for (let n = 0; n < N; n++) out[n] += row[n];
  return out;
}

/** Nodes 1..k turns from `from`. */
function ringsWithin(sea: Sea, from: NodeId, k: number): NodeId[] {
  const d = sea.map.distTo(from);
  const out: NodeId[] = [];
  for (let i = 0; i < d.length; i++) if (d[i] >= 1 && d[i] <= k) out.push(i);
  return out;
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
