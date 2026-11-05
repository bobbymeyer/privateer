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
import { OCEAN_LANES, RIVERS, ROUTES, SHOALS, STRAITS } from './ocean.ts';
import { LANDMARKS } from './landmarks.ts';
import { type Nation, PORTS, WATERS_DAYS } from './ports.ts';

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
  /** Whose protected waters these are: within reach of their nearest fort. */
  waters: Nation | null;
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
  /** The sea lanes, as legs: what the chart draws. The map's own adjacency is these and nothing else. */
  lanes: [NodeId, NodeId][];
  /** Every leg of open water, lanes or not: for drawing, never for sailing. */
  open: NodeId[][];
  /** Where each of the voyage's landmarks lies, by key. */
  landmarks: Record<string, NodeId>;
}

const at = (n: SeaNode): LonLat => [n.lon, n.lat];

export function buildMap(): SeaMap {
  const raw = world.nodes as [number, number, number][];
  const kinds = ['coast', 'ocean', 'passage'] as const;
  const nodes: SeaNode[] = raw.map(([lon, lat, k], id) => ({ id, lon, lat, kind: kinds[k], port: null, strait: null, shoal: null, river: null, guns: null, waters: null }));
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
      nodes.push({ id, lon, lat, kind: 'underway', port: null, strait: null, shoal: null, river: null, guns: null, waters: null });
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

  // Protected waters: each node belongs to the nation of its nearest fort,
  // if that fort is within reach.
  const distances_ = distances(adj);
  const nearestFort = new Int32Array(nodes.length).fill(WATERS_DAYS + 1);
  for (const n of nodes) {
    if (!n.port?.fort) continue;
    const d = distances_(n.id);
    for (let i = 0; i < nodes.length; i++) {
      if (d[i] < nearestFort[i]) {
        nearestFort[i] = d[i];
        nodes[i].waters = n.port.nation;
      }
    }
  }

  const deepAdj = adj.map((out, i) => (nodes[i].shoal && !nodes[i].port ? [] : out.filter((m) => !nodes[m].shoal || nodes[m].port)));

  // The sea lanes. Everyone sails them, you included: the open ocean off
  // them is water on the chart and nothing more. Ships kept to a few
  // thousand nodes instead of all of them meet, and a lane is somewhere to
  // lie in wait.
  // The voyage's landmarks: on a port, or the nearest water to where they lie. Their legs are lanes too.
  const marks: Record<string, NodeId> = {};
  // Open-sea landmarks sit off the ports, not on them: the Canaries aren't Las Palmas harbour.
  const water = nodes.filter((n) => n.kind !== 'underway' && !n.port);
  for (const l of LANDMARKS) marks[l.key] = typeof l.at === 'string' ? nodes.find((n) => n.port?.name === l.at)!.id : nearest(l.at, water).id;
  // Each leg, each way into a rumored detour, and each storm landfall tied to the landmarks near it.
  const legs: [NodeId, NodeId][] = LANDMARKS.flatMap((l) => [
    ...l.next.map((k): [NodeId, NodeId] => [marks[l.key], marks[k]]),
    ...(l.detour?.from ?? []).map((k): [NodeId, NodeId] => [marks[k], marks[l.key]]),
    ...(l.landfall?.near ?? []).map((k): [NodeId, NodeId] => [marks[l.key], marks[k]]),
  ]);
  const laneEdges = buildLanes(nodes, adj, deepAdj, distances_, distances(deepAdj), legs);
  const laneAdj: NodeId[][] = nodes.map(() => []);
  for (const key of laneEdges) {
    const [a, b] = key.split(',').map(Number);
    laneAdj[a].push(b);
    laneAdj[b].push(a);
  }
  const deepLaneAdj = laneAdj.map((out, i) => (nodes[i].shoal && !nodes[i].port ? [] : out.filter((m) => !nodes[m].shoal || nodes[m].port)));
  const traffic = new Uint16Array(nodes.length);
  for (const key of laneEdges) for (const n of key.split(',').map(Number)) traffic[n]++;
  return { nodes, adj: laneAdj, distTo: distances(laneAdj), deep: { adj: deepLaneAdj, distTo: distances(deepLaneAdj) }, lanes: [...laneEdges].map((k) => k.split(',').map(Number) as [NodeId, NodeId]), open: adj, landmarks: marks };
}

/** Each port's nearest neighbours that a lane joins it to. */
export const LANE_NEIGHBOURS = 3;

/**
 * The sea lanes, as a set of edges `a,b` (a < b): the shortest paths
 * between each port and its LANE_NEIGHBOURS nearest; between the pairs of a
 * tree spanning all ports, so no port is cut off; along the great crossings
 * (OCEAN_LANES); and along the great courses (ROUTES), traced through water
 * deep enough for the ships that sail them.
 */
function buildLanes(nodes: SeaNode[], adj: NodeId[][], deepAdj: NodeId[][], dist: (n: NodeId) => Int32Array, deepDist: (n: NodeId) => Int32Array, extra: [NodeId, NodeId][] = []): Set<string> {
  const edges = new Set<string>();
  const harbours = nodes.filter((n) => n.port).map((n) => n.id);
  const named = (name: string) => nodes.find((n) => n.port?.name === name)?.id;
  const trace = (from: NodeId, to: NodeId, g: NodeId[][], d: Int32Array) => {
    if (d[from] >= FAR) return;
    let at = from;
    while (at !== to) {
      const next = g[at].find((m) => d[m] === d[at] - 1);
      if (next === undefined) return;
      edges.add(at < next ? `${at},${next}` : `${next},${at}`);
      at = next;
    }
  };
  const join = (a: NodeId, b: NodeId) => trace(a, b, adj, dist(b));

  // Nearest neighbours, and a spanning tree over all ports by sailing days.
  const fromPort = new Map(harbours.map((p) => [p, dist(p)]));
  for (const p of harbours) {
    const d = fromPort.get(p)!;
    harbours.filter((q) => q !== p && d[q] < FAR).sort((a, b) => d[a] - d[b]).slice(0, LANE_NEIGHBOURS).forEach((q) => join(p, q));
  }
  const inTree = new Set([harbours[0]]);
  while (inTree.size < harbours.length) {
    let best: [NodeId, NodeId, number] | null = null;
    for (const p of inTree) {
      const d = fromPort.get(p)!;
      for (const q of harbours) if (!inTree.has(q) && d[q] < FAR && (!best || d[q] < best[2])) best = [p, q, d[q]];
    }
    if (!best) break;
    join(best[0], best[1]);
    inTree.add(best[1]);
  }

  for (const [a, b] of OCEAN_LANES) {
    const [x, y] = [named(a), named(b)];
    if (x !== undefined && y !== undefined) join(x, y);
  }
  // The voyage's legs, landmark to landmark: the Strait and the Horn both.
  for (const [a, b] of extra) if (a !== b) join(a, b);
  // The great courses, deep enough for the ships that sail them.
  for (const stops of Object.values(ROUTES)) {
    for (let i = 0; i < stops.length; i++) {
      const [x, y] = [named(stops[i]), named(stops[(i + 1) % stops.length])];
      if (x !== undefined && y !== undefined && x !== y) trace(x, y, deepAdj, deepDist(y));
    }
  }
  return edges;
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
