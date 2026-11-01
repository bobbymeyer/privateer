/**
 * The sea as the game sails it: the world graph from data/world.json, with
 * every leg longer than a day's sail split into a day's steps, so one step is
 * one turn everywhere. A coastal leg is a day; an ocean leg of 300 miles is
 * five, and a ship on it is somewhere along it — `underway` nodes.
 *
 * Then what the coast makes of the water: ports, straits, rivers, banks, and
 * the guns of forts.
 */

import world from './data/world.json' with { type: 'json' };
import { type LonLat, along, distanceNm } from './geo.ts';
import { RIVERS, SHOALS, STRAITS } from './ocean.ts';
import { type Nation, PORTS } from './ports.ts';

export type NodeId = number;

/** Nautical miles a ship makes in a turn. A turn is a day. */
export const DAY_NM = 60;

export interface Port {
  name: string;
  nation: Nation;
  fort: boolean;
}

export interface SeaNode {
  id: NodeId;
  lon: number;
  lat: number;
  /** coast and ocean nodes come from the world graph; underway nodes are a day along a longer leg. */
  kind: 'coast' | 'ocean' | 'passage' | 'underway';
  port: Port | null;
  /** In a named narrows. */
  strait: string | null;
  /** On a bank too shallow for deep keels. */
  shoal: string | null;
  /** At a river's mouth. */
  river: string | null;
  /** Under the guns of this port's fort. */
  guns: string | null;
}

/** Unreachable. */
export const FAR = 1 << 30;

export interface Graph {
  adj: NodeId[][];
  /** Turns from every node to `dest`, worked out on first asking and kept a while. */
  distTo(dest: NodeId): Int32Array;
}

export interface SeaMap extends Graph {
  nodes: SeaNode[];
  /** The same sea for deep keels: no banks. */
  deep: Graph;
}

const at = (n: SeaNode): LonLat => [n.lon, n.lat];

export function buildMap(): SeaMap {
  const raw = world.nodes as [number, number, number][];
  const kinds = ['coast', 'ocean', 'passage'] as const;
  const nodes: SeaNode[] = raw.map(([lon, lat, k], id) => ({ id, lon, lat, kind: kinds[k], port: null, strait: null, shoal: null, river: null, guns: null }));
  const adj: NodeId[][] = nodes.map(() => []);
  const link = (a: NodeId, b: NodeId) => (adj[a].push(b), adj[b].push(a));

  // Split each leg into days.
  for (let i = 0; i < world.edges.length; i += 2) {
    const [a, b] = [world.edges[i], world.edges[i + 1]];
    const days = Math.max(1, Math.round(distanceNm(at(nodes[a]), at(nodes[b])) / DAY_NM));
    let prev = a;
    for (let d = 1; d < days; d++) {
      const [lon, lat] = along(at(nodes[a]), at(nodes[b]), d / days);
      const id = nodes.length;
      nodes.push({ id, lon, lat, kind: 'underway', port: null, strait: null, shoal: null, river: null, guns: null });
      adj.push([]);
      link(prev, id);
      prev = id;
    }
    link(prev, b);
  }

  const shore = nodes.filter((n) => n.kind === 'coast' || n.kind === 'passage');
  const nearest = (p: LonLat, among: SeaNode[], taken?: Set<NodeId>) => {
    let best: SeaNode | null = null;
    let bestD = Infinity;
    for (const n of among) {
      if (taken?.has(n.id)) continue;
      const d = distanceNm(p, at(n));
      if (d < bestD) [best, bestD] = [n, d];
    }
    return best!;
  };

  const taken = new Set<NodeId>();
  for (const def of PORTS) {
    const n = nearest(def.at, shore, taken);
    taken.add(n.id);
    n.port = { name: def.name, nation: def.nation, fort: def.fort };
  }
  for (const [name, ids] of Object.entries(world.passages as Record<string, number[]>)) for (const id of ids) nodes[id].strait = name;
  for (const s of STRAITS) for (const n of nodes) if (n.kind !== 'underway' && distanceNm(s.at, at(n)) <= DAY_NM) n.strait ??= s.name;
  for (const r of RIVERS) nearest(r.at, shore).river = r.name;
  for (const n of nodes) n.shoal = SHOALS.find((s) => inPolygon(at(n), s.outline))?.name ?? null;
  for (const n of nodes) {
    if (!n.port?.fort) continue;
    for (const m of [n.id, ...adj[n.id]]) nodes[m].guns ??= n.port.name;
  }

  const deepAdj = adj.map((out, i) => (nodes[i].shoal && !nodes[i].port ? [] : out.filter((m) => !nodes[m].shoal || nodes[m].port)));
  return { nodes, adj, distTo: distances(adj), deep: { adj: deepAdj, distTo: distances(deepAdj) } };
}

/** Breadth-first distances to a node, cached; the oldest are let go past a few hundred. */
function distances(adj: NodeId[][]): (dest: NodeId) => Int32Array {
  const cache = new Map<NodeId, Int32Array>();
  return (dest) => {
    const hit = cache.get(dest);
    if (hit) {
      cache.delete(dest);
      cache.set(dest, hit);
      return hit;
    }
    const d = new Int32Array(adj.length).fill(FAR);
    d[dest] = 0;
    const queue = new Int32Array(adj.length);
    let head = 0;
    let tail = 0;
    queue[tail++] = dest;
    while (head < tail) {
      const n = queue[head++];
      for (const m of adj[n]) if (d[m] === FAR) (d[m] = d[n] + 1, (queue[tail++] = m));
    }
    cache.set(dest, d);
    if (cache.size > 400) cache.delete(cache.keys().next().value!);
    return d;
  };
}

function inPolygon([x, y]: LonLat, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Every node exactly `k` turns from `from`. */
export function ring(map: SeaMap, from: NodeId, k: number): NodeId[] {
  const d = map.distTo(from);
  const out: NodeId[] = [];
  for (let i = 0; i < d.length; i++) if (d[i] === k) out.push(i);
  return out;
}

const portLists = new WeakMap<SeaMap, NodeId[]>();
export const ports = (map: SeaMap): NodeId[] => {
  let list = portLists.get(map);
  if (!list) portLists.set(map, (list = map.nodes.filter((n) => n.port !== null).map((n) => n.id)));
  return list;
};

export const portNamed = (map: SeaMap, name: string): NodeId => {
  const n = map.nodes.find((x) => x.port?.name === name);
  if (!n) throw new Error(`no port ${name}`);
  return n.id;
};
