/**
 * Surveying the sea: building the map from the world graph in
 * data/world.json, the ports, straits, banks and lanes, as the game sails it.
 * Heavy — a breadth-first search from every port and fort — so it's done at
 * build time (`npm run bake`) and shipped packed (map.ts `unpackSea`); the
 * tests run it to prove the packing is the same sea.
 */

import world from './data/world.json' with { type: 'json' };
import coast from './data/coast.json' with { type: 'json' };
import { type LonLat, along, distanceNm } from './geo.ts';
import { OCEAN_LANES, RIVERS, ROUTES, SHOALS, STRAITS } from './ocean.ts';
import { LANDMARKS } from './landmarks.ts';
import { type Nation, PORTS, WATERS_DAYS } from './ports.ts';
import { DAY_NM, FAR, type NodeId, type PackedSea, type SeaMap, type SeaNode, distances } from './map.ts';

const at = (n: SeaNode): LonLat => [n.lon, n.lat];

/** The sea, surveyed: what `unpackSea` gives back from the packing. */
export function buildMap(): SeaMap & { open: NodeId[][]; steps: [NodeId, NodeId, NodeId, number][] } {
  const steps: [NodeId, NodeId, NodeId, number][] = [];
  const raw = world.nodes as [number, number, number][];
  const kinds = ['coast', 'ocean', 'passage'] as const;
  const nodes: SeaNode[] = raw.map(([lon, lat, k], id) => ({ id, lon, lat, kind: kinds[k], port: null, strait: null, shoal: null, river: null, guns: null, waters: null }));
  const adj: NodeId[][] = nodes.map(() => []);
  const link = (a: NodeId, b: NodeId) => (adj[a].push(b), adj[b].push(a));

  // Split each leg into days.
  for (let i = 0; i < world.edges.length; i += 2) {
    const [a, b] = [world.edges[i], world.edges[i + 1]];
    const days = Math.max(1, Math.round(distanceNm(at(nodes[a]), at(nodes[b])) / DAY_NM));
    if (days > 1) steps.push([a, b, nodes.length, days]);
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
  return { nodes, adj: laneAdj, distTo: distances(laneAdj), deep: { adj: deepLaneAdj, distTo: distances(deepLaneAdj) }, lanes: [...laneEdges].map((k) => k.split(',').map(Number) as [NodeId, NodeId]), open: adj, steps, landmarks: marks };
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

function inPolygon([x, y]: LonLat, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}


/** The world's coasts as one SVG path, coarse enough for a chart of the whole world: islets under 0.8° dropped, points nearer than 0.35° merged. */
export function coastPath(): string {
  // Relative moves in tenths of a degree, which pack far smaller than absolute ones.
  const t = (v: number) => Math.round(v * 10);
  const num = (v: number) => (v / 10).toString().replace(/^0\./, '.').replace(/^-0\./, '-.');
  const pair = (dx: number, dy: number) => `${num(dx)}${dy < 0 ? '' : ','}${num(dy)}`;
  let d = '';
  for (const r of coast.rings as number[][]) {
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < r.length; i += 2) [w, s, e, n] = [Math.min(w, r[i]), Math.min(s, r[i + 1]), Math.max(e, r[i]), Math.max(n, r[i + 1])];
    if (e - w < 0.8 && n - s < 0.8) continue;
    let [lx, ly] = [r[0], r[1]];
    let [px, py] = [t(lx), t(-ly)];
    d += `M${num(px)}${py < 0 ? '' : ','}${num(py)}l`;
    let first = true;
    for (let i = 2; i < r.length; i += 2) {
      if (Math.abs(r[i] - lx) < 0.35 && Math.abs(r[i + 1] - ly) < 0.35) continue;
      [lx, ly] = [r[i], r[i + 1]];
      const [qx, qy] = [t(lx), t(-ly)];
      if (qx === px && qy === py) continue;
      d += `${first || qx - px < 0 ? '' : ' '}${pair(qx - px, qy - py)}`;
      [px, py] = [qx, qy];
      first = false;
    }
    d += 'z';
  }
  return d;
}

/** The surveyed sea, packed for the browser: see `PackedSea`. */
export function packSea(m: ReturnType<typeof buildMap>): PackedSea {
  const raw = world.nodes as [number, number, number][];
  const base: number[] = [];
  let [x, y] = [0, 0];
  for (const [lon, lat] of raw) {
    const [ix, iy] = [Math.round(lon * 100), Math.round(lat * 100)];
    base.push(ix - x, iy - y);
    [x, y] = [ix, iy];
  }
  const onLane = new Set(m.lanes.flat());
  const legs = m.steps.filter(([, , first, days]) => Array.from({ length: days - 1 }, (_, d) => first + d).some((id) => onLane.has(id))).flat();
  // In the survey's own order: a ship takes the first neighbour a day nearer, so the order is the route.
  const lanes: number[] = [];
  let prev = 0;
  for (const [a, b] of m.lanes) {
    lanes.push(a - prev, b - a);
    prev = a;
  }
  const by = (key: 'strait' | 'shoal' | 'river' | 'guns') => {
    const out: Record<string, number[]> = {};
    for (const n of m.nodes) if (n[key]) (out[n[key]!] ??= []).push(n.id);
    return out;
  };
  const nations = [...new Set(m.nodes.map((n) => n.waters).filter((w): w is Nation => !!w))];
  const waters: number[] = [];
  for (const n of m.nodes) {
    const v = n.waters ? nations.indexOf(n.waters) : -1;
    if (waters.length && waters[waters.length - 2] === v) waters[waters.length - 1]++;
    else waters.push(v, 1);
  }
  return {
    count: m.nodes.length,
    base,
    kinds: raw.map(([, , k]) => k).join(''),
    legs,
    lanes,
    ports: PORTS.map((def) => m.nodes.find((n) => n.port?.name === def.name)!.id),
    strait: by('strait'),
    shoal: by('shoal'),
    river: by('river'),
    guns: by('guns'),
    waters,
    nations,
    landmarks: m.landmarks,
    coast: coastPath(),
  };
}
