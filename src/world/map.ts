/**
 * The sea as the game sails it, as surveyed once at build time (survey.ts,
 * `npm run bake`) and shipped packed in data/sea.json: the world graph from
 * data/world.json, with
 * every leg longer than a day's sail split into a day's steps, so one step is
 * one turn everywhere. A coastal leg is a day; an ocean leg of 300 miles is
 * five, and a ship on it is somewhere along it — `underway` nodes.
 *
 * Then what the coast makes of the water: ports, straits, rivers, banks, and
 * the guns of forts.
 */

import { along } from './geo.ts';
import { type Nation, PORTS } from './ports.ts';
import sea from './data/sea.json' with { type: 'json' };

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
  /** Where each of the voyage's landmarks lies, by key. */
  landmarks: Record<string, NodeId>;
}

/** Breadth-first distances to a node, cached; the oldest are let go past a few hundred. */
export function distances(adj: NodeId[][]): (dest: NodeId) => Int32Array {
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

// --- The sea, packed ---------------------------------------------------------

/**
 * The surveyed sea, packed small for the browser: a few hundred milliseconds
 * of breadth-first searches on a desktop, and seconds on a phone, done once
 * at build time instead. Day-steps off the lanes are never sailed, so only
 * their places in the numbering are kept: their positions are NaN.
 */
export interface PackedSea {
  /** Nodes in all, the world graph's and the day-steps between. */
  count: number;
  /** The world graph's nodes, in hundredths of a degree, each the difference from the one before: lon, lat, lon, lat… */
  base: number[];
  /** Their kinds, a digit each: 0 coast, 1 ocean, 2 passage. */
  kinds: string;
  /** Legs whose day-steps lie on the lanes: from, to, the first step's id, and how many days the leg is. */
  legs: number[];
  /** The lanes' edges in the survey's order (the order is the route), each the difference from the one before: a, b-a, a, b-a… */
  lanes: number[];
  /** Each port of PORTS, by its node. */
  ports: number[];
  strait: Record<string, number[]>;
  shoal: Record<string, number[]>;
  river: Record<string, number[]>;
  guns: Record<string, number[]>;
  /** Whose waters, run by run over the ids: nation (an index into `nations`, or -1 for nobody's), length. */
  waters: number[];
  nations: string[];
  landmarks: Record<string, number>;
  /** The world's coasts as one SVG path, at the whole-world chart's scale. */
  coast: string;
}

const KINDS = ['coast', 'ocean', 'passage'] as const;

/** The sea from its packing: the same nodes, lanes and landmarks the survey made. */
export function unpackSea(p: PackedSea): SeaMap {
  const blank = (id: NodeId, lon: number, lat: number, kind: SeaNode['kind']): SeaNode => ({ id, lon, lat, kind, port: null, strait: null, shoal: null, river: null, guns: null, waters: null });
  const nodes: SeaNode[] = new Array(p.count);
  let [x, y] = [0, 0];
  for (let i = 0; i < p.kinds.length; i++) {
    x += p.base[2 * i];
    y += p.base[2 * i + 1];
    nodes[i] = blank(i, x / 100, y / 100, KINDS[Number(p.kinds[i])]);
  }
  for (let i = p.kinds.length; i < p.count; i++) nodes[i] = blank(i, NaN, NaN, 'underway');
  // Day-steps on the lanes, placed exactly as the survey placed them.
  for (let i = 0; i < p.legs.length; i += 4) {
    const [a, b, first, days] = p.legs.slice(i, i + 4);
    const [pa, pb]: [number, number][] = [[nodes[a].lon, nodes[a].lat], [nodes[b].lon, nodes[b].lat]];
    for (let d = 1; d < days; d++) {
      const [lon, lat] = along(pa, pb, d / days);
      Object.assign(nodes[first + d - 1], { lon, lat });
    }
  }
  PORTS.forEach((def, i) => (nodes[p.ports[i]].port = { name: def.name, nation: def.nation, fort: def.fort }));
  for (const key of ['strait', 'shoal', 'river', 'guns'] as const) for (const [name, ids] of Object.entries(p[key])) for (const id of ids) nodes[id][key] = name;
  let id = 0;
  for (let i = 0; i < p.waters.length; i += 2) {
    const nation = p.waters[i] < 0 ? null : (p.nations[p.waters[i]] as Nation);
    for (let k = 0; k < p.waters[i + 1]; k++) nodes[id++].waters = nation;
  }
  const adj: NodeId[][] = Array.from({ length: p.count }, () => []);
  const lanes: [NodeId, NodeId][] = [];
  let a = 0;
  for (let i = 0; i < p.lanes.length; i += 2) {
    a += p.lanes[i];
    const b = a + p.lanes[i + 1];
    lanes.push([a, b]);
    adj[a].push(b);
    adj[b].push(a);
  }
  const deep = adj.map((out, i) => (nodes[i].shoal && !nodes[i].port ? [] : out.filter((m) => !nodes[m].shoal || nodes[m].port)));
  return { nodes, adj, distTo: distances(adj), deep: { adj: deep, distTo: distances(deep) }, lanes, landmarks: { ...p.landmarks } };
}

/** The sea the game sails: unpacked once. */
export const loadMap = (): SeaMap => unpackSea(sea as PackedSea);
