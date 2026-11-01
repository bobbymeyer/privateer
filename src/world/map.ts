/**
 * The sea: a graph of nodes, some of them ports. Generated from a seed and
 * never changed afterwards, so it lives outside the per-turn state.
 */

import { type Roller, roll } from './random.ts';

export type NodeId = number;

export interface SeaNode {
  id: NodeId;
  /** 0..1 across, 0..ASPECT down. For drawing, and for currents and wind. */
  x: number;
  y: number;
  port: string | null;
}

export interface SeaMap {
  nodes: SeaNode[];
  /** Neighbours of each node. Edges are undirected; currents give them a grain. */
  adj: NodeId[][];
  /** Hops between every pair of nodes. */
  dist: number[][];
}

export const ASPECT = 0.625;

const PORT_NAMES = ['saltmarsh', 'kestrel bay', 'wrack', 'lanthorn', 'greyhaven', 'the narrows', 'cold harbour', 'mallow'];

export function generateMap(seed: number, { cols = 8, rows = 5, ports = 6, landChance = 0.15 } = {}): SeaMap {
  const r: Roller = { rng: seed >>> 0 };
  const nodes: SeaNode[] = [];

  // One node per grid cell, jittered; a few cells are land and get none.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (roll(r) < landChance) continue;
      nodes.push({
        id: nodes.length,
        x: (col + 0.2 + 0.6 * roll(r)) / cols,
        y: ((row + 0.2 + 0.6 * roll(r)) / rows) * ASPECT,
        port: null,
      });
    }
  }

  const d = (a: SeaNode, b: SeaNode) => Math.hypot(a.x - b.x, a.y - b.y);
  const adj: Set<NodeId>[] = nodes.map(() => new Set());
  const link = (a: NodeId, b: NodeId) => {
    adj[a].add(b);
    adj[b].add(a);
  };

  // Each node to its three nearest.
  for (const n of nodes) {
    const nearest = nodes.filter((m) => m !== n).sort((a, b) => d(n, a) - d(n, b)).slice(0, 3);
    for (const m of nearest) link(n.id, m.id);
  }

  // Join any islands of the graph by their closest pair, until it is one sea.
  for (;;) {
    const comp = components(adj);
    if (comp.length === 1) break;
    let best: [NodeId, NodeId] = [0, 0];
    let bestD = Infinity;
    for (const a of comp[0]) {
      for (const other of comp.slice(1)) {
        for (const b of other) {
          const dd = d(nodes[a], nodes[b]);
          if (dd < bestD) [best, bestD] = [[a, b], dd];
        }
      }
    }
    link(best[0], best[1]);
  }

  // Ports spread out: each next one is the node farthest from those chosen.
  const chosen: NodeId[] = [Math.floor(roll(r) * nodes.length)];
  while (chosen.length < Math.min(ports, nodes.length)) {
    let far = 0;
    let farD = -1;
    for (const n of nodes) {
      const nearest = Math.min(...chosen.map((c) => d(n, nodes[c])));
      if (nearest > farD) [far, farD] = [n.id, nearest];
    }
    chosen.push(far);
  }
  chosen.forEach((id, i) => (nodes[id].port = PORT_NAMES[i % PORT_NAMES.length]));

  const adjList = adj.map((s) => [...s].sort((a, b) => a - b));
  return { nodes, adj: adjList, dist: nodes.map((n) => bfs(adjList, n.id)) };
}

function bfs(adj: NodeId[][], from: NodeId): number[] {
  const dist = adj.map(() => Infinity);
  dist[from] = 0;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const m of adj[queue[i]]) {
      if (dist[m] === Infinity) {
        dist[m] = dist[queue[i]] + 1;
        queue.push(m);
      }
    }
  }
  return dist;
}

function components(adj: Set<NodeId>[]): NodeId[][] {
  const seen = new Set<NodeId>();
  const out: NodeId[][] = [];
  for (let start = 0; start < adj.length; start++) {
    if (seen.has(start)) continue;
    const comp = [start];
    seen.add(start);
    for (let i = 0; i < comp.length; i++) {
      for (const m of adj[comp[i]]) if (!seen.has(m)) (seen.add(m), comp.push(m));
    }
    out.push(comp);
  }
  return out;
}

/** Every node exactly `k` hops from `from`. */
export function ring(map: SeaMap, from: NodeId, k: number): NodeId[] {
  return map.nodes.filter((n) => map.dist[from][n.id] === k).map((n) => n.id);
}

export const ports = (map: SeaMap) => map.nodes.filter((n) => n.port !== null).map((n) => n.id);
