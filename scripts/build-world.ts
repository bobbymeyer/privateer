/**
 * Builds src/world/data/world.json, the graph of the whole sea, from Natural
 * Earth's 1:10m land (public domain):
 *
 *   npm run world -- path/to/ne_10m_land.geojson
 *
 * Coastline first, because the coast is where the action is: a node offshore
 * every COAST_NM along every coast and island. Then the open ocean is filled,
 * sparser the farther it is from land. Then the narrow passages are threaded
 * through by hand. Then the lot is triangulated on the sphere, and edges that
 * cross land or run far longer than their neighbourhood are dropped.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { geoDelaunay } from 'd3-geo-voronoi';
import { PASSAGES } from '../src/world/passages.ts';

type LL = [number, number];

/** Nautical miles between coastal nodes: about a day's coasting. */
const COAST_NM = 60;
/** How far offshore a coastal node sits, as a share of that. */
const OFFSHORE = 0.3;
/** Open-ocean spacing grows with distance from the coast, up to this many times the coastal. */
const OCEAN_MAX = 5;
/** Nothing is built beyond these latitudes: the ice. */
const SOUTH = -62;
const NORTH = 72;

const R_NM = 3440.065;
const KM_PER_NM = 1.852;
const step = COAST_NM / R_NM; // radians

const src = process.argv[2];
if (!src) throw new Error('usage: npm run world -- ne_10m_land.geojson');
const geo = JSON.parse(readFileSync(src, 'utf8'));

// --- Land raster, 0.05°, even–odd fill over every ring --------------------

const RES = 0.05;
const W = 360 / RES;
const H = 180 / RES;
const land = new Uint8Array(W * H);
const rings: LL[][] = [];
const outer: LL[][] = [];
for (const f of geo.features) {
  const polys: LL[][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) poly.forEach((ring, i) => (rings.push(ring), i === 0 && outer.push(ring)));
}
{
  const rows: number[][] = Array.from({ length: H }, () => []);
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      if (y1 === y2) continue;
      const r0 = Math.ceil((90 - Math.max(y1, y2)) / RES - 0.5);
      const r1 = Math.floor((90 - Math.min(y1, y2)) / RES - 0.5);
      for (let r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) {
        const y = 90 - (r + 0.5) * RES;
        if ((y1 > y) === (y2 > y)) continue;
        rows[r].push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
  }
  rows.forEach((xs, r) => {
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] + 180) / RES - 0.5));
      const c1 = Math.min(W - 1, Math.floor((xs[k + 1] + 180) / RES - 0.5));
      for (let c = c0; c <= c1; c++) land[r * W + c] = 1;
    }
  });
}
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
const isLand = ([lon, lat]: LL) => {
  const c = Math.floor((wrapLon(lon) + 180) / RES);
  const r = Math.floor((90 - lat) / RES);
  return r >= 0 && r < H && land[r * W + Math.min(W - 1, c)] === 1;
};

// --- Sphere helpers --------------------------------------------------------

const rad = Math.PI / 180;
const toVec = ([lon, lat]: LL) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const angle = (a: LL, b: LL) => {
  const [p, q] = [toVec(a), toVec(b)];
  return Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
};
/** The point `t` of the way along the great circle a→b. */
function along(a: LL, b: LL, t: number): LL {
  const w = angle(a, b);
  if (w < 1e-9) return a;
  const [p, q] = [toVec(a), toVec(b)];
  const [s1, s2] = [Math.sin((1 - t) * w) / Math.sin(w), Math.sin(t * w) / Math.sin(w)];
  const v = [p[0] * s1 + q[0] * s2, p[1] * s1 + q[1] * s2, p[2] * s1 + q[2] * s2];
  return [Math.atan2(v[1], v[0]) / rad, Math.asin(Math.max(-1, Math.min(1, v[2]))) / rad];
}

/** Points by cell, for neighbour queries with a radius in radians. */
class Hash {
  cell = 2; // degrees
  map = new Map<string, number[]>();
  pts: LL[] = [];
  key(lon: number, lat: number) {
    return `${Math.floor((wrapLon(lon) + 180) / this.cell)},${Math.floor((lat + 90) / this.cell)}`;
  }
  add(p: LL) {
    const id = this.pts.length;
    this.pts.push(p);
    const k = this.key(...p);
    (this.map.get(k) ?? this.map.set(k, []).get(k)!).push(id);
    return id;
  }
  near(p: LL, radius: number): number[] {
    const dLat = radius / rad;
    const dLon = Math.min(180, dLat / Math.max(0.05, Math.cos(Math.min(89, Math.abs(p[1]) + dLat) * rad)));
    const out: number[] = [];
    for (let lat = p[1] - dLat; lat <= p[1] + dLat + this.cell; lat += this.cell) {
      for (let lon = p[0] - dLon; lon <= p[0] + dLon + this.cell; lon += this.cell) {
        for (const id of this.map.get(this.key(lon, Math.max(-90, Math.min(89.99, lat)))) ?? []) {
          if (!out.includes(id) && angle(p, this.pts[id]) <= radius) out.push(id);
        }
      }
    }
    return out;
  }
}

// --- 1. Coast -------------------------------------------------------------

const nodes: { at: LL; kind: 'coast' | 'ocean' | 'passage'; sep: number; passage?: string }[] = [];
const hash = new Hash();
const place = (at: LL, kind: 'coast' | 'ocean' | 'passage', sep: number, passage?: string) => {
  nodes.push({ at, kind, sep, passage });
  hash.add(at);
};

for (const ring of outer) {
  // Walk the ring by great-circle distance, sampling every `step`.
  const inBand = ring.some(([, lat]) => lat > SOUTH && lat < NORTH);
  if (!inBand) continue;
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) total += segs[i] = angle(ring[i], ring[i + 1]);
  if (total * R_NM < 8) continue; // rocks
  const count = Math.max(1, Math.round(total / step));
  const gap = total / count;
  let i = 0;
  let acc = 0;
  for (let k = 0; k < count; k++) {
    const want = (k + 0.5) * gap;
    while (i < segs.length - 1 && acc + segs[i] < want) acc += segs[i++];
    const t = segs[i] > 0 ? (want - acc) / segs[i] : 0;
    const p = along(ring[i], ring[i + 1], t);
    if (p[1] <= SOUTH || p[1] >= NORTH) continue;
    // The local shoreline direction, over about a node's length either side.
    const a = ring[Math.max(0, i - 3)];
    const b = ring[Math.min(ring.length - 1, i + 4)];
    const kx = Math.cos(p[1] * rad);
    let [tx, ty] = [(b[0] - a[0]) * kx, b[1] - a[1]];
    const len = Math.hypot(tx, ty) || 1;
    [tx, ty] = [tx / len, ty / len];
    const off = (OFFSHORE * step) / rad; // degrees
    let placed = false;
    for (const scale of [1, 0.6, 0.35]) {
      for (const sign of [1, -1]) {
        const q: LL = [p[0] + (sign * -ty * off * scale) / kx, p[1] + sign * tx * off * scale];
        if (!isLand(q) && !placed) {
          if (!hash.near(q, step * 0.55).length) place(q, 'coast', step);
          placed = true;
        }
      }
      if (placed) break;
    }
  }
}
const coastCount = nodes.length;

// --- 2. Passages ----------------------------------------------------------

const passageChains: number[][] = [];
for (const p of PASSAGES) {
  const chain: number[] = [];
  for (let s = 0; s < p.path.length - 1; s++) {
    const n = Math.max(1, Math.round(angle(p.path[s], p.path[s + 1]) / (step * 0.5)));
    for (let k = 0; k < n; k++) {
      chain.push(nodes.length);
      place(along(p.path[s], p.path[s + 1], k / n), 'passage', step * 0.5, p.name);
    }
  }
  chain.push(nodes.length);
  place(p.path[p.path.length - 1], 'passage', step * 0.5, p.name);
  passageChains.push(chain);
}

// --- 3. Ocean -------------------------------------------------------------

{
  // Candidates on a Fibonacci sphere about a coastal step apart.
  const N = Math.round((4 * Math.PI) / (step * step * 0.87));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cands: { at: LL; d: number }[] = [];
  const coastOnly = new Hash();
  for (const n of nodes) coastOnly.add(n.at);
  for (let k = 0; k < N; k++) {
    const z = 1 - (2 * (k + 0.5)) / N;
    const lat = Math.asin(z) / rad;
    if (lat <= SOUTH || lat >= NORTH) continue;
    const lon = wrapLon(((k * golden) % (2 * Math.PI)) / rad);
    const at: LL = [lon, lat];
    if (isLand(at)) continue;
    // Distance to the coast, looked for outwards in widening rings.
    let d = Infinity;
    for (let r = step * 2; r <= step * 40 && d === Infinity; r *= 2) {
      for (const id of coastOnly.near(at, r)) d = Math.min(d, angle(at, coastOnly.pts[id]));
    }
    cands.push({ at, d: Math.min(d, step * 40) });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const { at, d } of cands) {
    const sep = Math.min(OCEAN_MAX * step, Math.max(step, 0.6 * d));
    if (hash.near(at, sep * 0.9).length) continue;
    place(at, 'ocean', sep);
  }
}

// --- 4. Triangulate, then drop what crosses land or runs too long --------

const tri = geoDelaunay(nodes.map((n) => n.at));
const inPassage = new Set(passageChains.flat());
const crossesLand = (a: LL, b: LL) => {
  const w = angle(a, b);
  const n = Math.max(2, Math.ceil((w * R_NM * KM_PER_NM) / 5)); // every 5 km
  let run = 0;
  for (let k = 1; k < n; k++) {
    if (isLand(along(a, b, k / n))) {
      if (++run * 5 > 12) return true; // more than a spit of land
    } else run = 0;
  }
  return false;
};
const edges = new Set<string>();
const keyOf = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
for (const [a, b] of tri.edges as [number, number][]) {
  if (inPassage.has(a) || inPassage.has(b)) continue; // joined by hand below
  const long = angle(nodes[a].at, nodes[b].at) > 2.2 * Math.max(nodes[a].sep, nodes[b].sep);
  if (long || crossesLand(nodes[a].at, nodes[b].at)) continue;
  edges.add(keyOf(a, b));
}
// Passages: a chain end to end, each end joined to its two nearest sea nodes.
for (const chain of passageChains) {
  for (let k = 0; k < chain.length - 1; k++) edges.add(keyOf(chain[k], chain[k + 1]));
  for (const end of [chain[0], chain[chain.length - 1]]) {
    const near = hash
      .near(nodes[end].at, step * 1.6)
      .filter((id) => !inPassage.has(id))
      .sort((x, y) => angle(nodes[end].at, nodes[x].at) - angle(nodes[end].at, nodes[y].at))
      .slice(0, 2);
    for (const id of near) edges.add(keyOf(end, id));
  }
}

// --- 5. The one ocean: the largest connected body -------------------------

const adj: number[][] = nodes.map(() => []);
for (const e of edges) {
  const [a, b] = e.split(',').map(Number);
  adj[a].push(b);
  adj[b].push(a);
}
const comp = new Int32Array(nodes.length).fill(-1);
const sizes: number[] = [];
for (let s = 0; s < nodes.length; s++) {
  if (comp[s] >= 0) continue;
  const c = sizes.length;
  const queue = [s];
  comp[s] = c;
  for (let i = 0; i < queue.length; i++) for (const m of adj[queue[i]]) if (comp[m] < 0) (comp[m] = c, queue.push(m));
  sizes.push(queue.length);
}
const main = sizes.indexOf(Math.max(...sizes));
const keep = nodes.map((_, i) => comp[i] === main);
const newId = new Int32Array(nodes.length).fill(-1);
let next = 0;
nodes.forEach((_, i) => keep[i] && (newId[i] = next++));

const outNodes = nodes.filter((_, i) => keep[i]).map((n) => [Math.round(n.at[0] * 100) / 100, Math.round(n.at[1] * 100) / 100, n.kind === 'coast' ? 0 : n.kind === 'ocean' ? 1 : 2]);
const outEdges: number[] = [];
for (const e of edges) {
  const [a, b] = e.split(',').map(Number);
  if (keep[a] && keep[b]) outEdges.push(newId[a], newId[b]);
}
const passages = Object.fromEntries(PASSAGES.map((p, i) => [p.name, passageChains[i].filter((id) => keep[id]).map((id) => newId[id])]));

writeFileSync(
  new URL('../src/world/data/world.json', import.meta.url),
  JSON.stringify({
    source: 'Natural Earth 1:10m land, public domain',
    coastNm: COAST_NM,
    // [lon, lat, kind]: 0 coast, 1 ocean, 2 passage
    nodes: outNodes,
    edges: outEdges,
    passages,
  }) + '\n',
);
const dropped = sizes.reduce((s, n) => s + n, 0) - sizes[main];
console.log(`${coastCount} coastal, ${nodes.length - coastCount} passage and ocean → ${next} kept (${dropped} in ${sizes.length - 1} cut-off pockets); ${outEdges.length / 2} edges`);
for (const [name, ids] of Object.entries(passages)) if (ids.length === 0) console.log(`  warning: ${name} was cut off`);
