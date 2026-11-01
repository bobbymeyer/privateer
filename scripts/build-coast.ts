/**
 * Builds src/world/data/land.json from Natural Earth's 1:10m land polygons
 * (public domain). Run when the grid in src/world/grid.ts changes:
 *
 *   npm run coast -- path/to/ne_10m_land.geojson
 *
 * Download from
 * https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson
 *
 * Writes, per grid cell, how many of its seven samples are on land, and the
 * coastline clipped to the map and simplified, for drawing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { BOUNDS, COLS, ROWS, cellSamples } from '../src/world/grid.ts';

type Ring = [number, number][];

const src = process.argv[2];
if (!src) throw new Error('usage: npm run coast -- ne_10m_land.geojson');
const geo = JSON.parse(readFileSync(src, 'utf8'));

const PAD = 1.5;
const box = { w: BOUNDS.west - PAD, e: BOUNDS.east + PAD, s: BOUNDS.south - PAD, n: BOUNDS.north + PAD };

// Every outer ring and hole that touches the map, with its bounding box.
const rings: { ring: Ring; hole: boolean; bb: [number, number, number, number] }[] = [];
for (const f of geo.features) {
  const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of ring) [w, s, e, n] = [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(n, y)];
      if (e < box.w || w > box.e || n < box.s || s > box.n) return;
      rings.push({ ring, hole: i > 0, bb: [w, s, e, n] });
    });
  }
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onLand(x: number, y: number): boolean {
  let land = false;
  for (const { ring, hole, bb } of rings) {
    if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
    if (inRing(x, y, ring)) land = !hole || land ? !hole : land;
  }
  return land;
}

// Land samples per cell, as one digit each, row by row.
let land = '';
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    land += cellSamples(col, row).filter(([x, y]) => onLand(x, y)).length;
  }
}

// Coastline for drawing: clipped to the box by dropping far rings,
// simplified with Douglas–Peucker, rounded to a hundredth of a degree.
function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 4) return pts;
  // A closed ring starts and ends on the same point, which leaves no line to
  // measure from. Split it at the point farthest from the start instead.
  const [x0, y0] = pts[0];
  const [xn, yn] = pts[pts.length - 1];
  if (x0 === xn && y0 === yn) {
    let far = 1;
    for (let i = 1; i < pts.length - 1; i++) {
      if (Math.hypot(pts[i][0] - x0, pts[i][1] - y0) > Math.hypot(pts[far][0] - x0, pts[far][1] - y0)) far = i;
    }
    return [...simplifyOpen(pts.slice(0, far + 1), tol), ...simplifyOpen(pts.slice(far), tol).slice(1)];
  }
  return simplifyOpen(pts, tol);
}

function simplifyOpen(pts: Ring, tol: number): Ring {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let far = -1;
    let farD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > farD) [far, farD] = [i, d];
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Sutherland–Hodgman: the part of a ring inside the box, cut along its edges. */
function clip(ring: Ring): Ring {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= box.w, (a, b) => cut(a, b, 0, box.w)],
    [(p) => p[0] <= box.e, (a, b) => cut(a, b, 0, box.e)],
    [(p) => p[1] >= box.s, (a, b) => cut(a, b, 1, box.s)],
    [(p) => p[1] <= box.n, (a, b) => cut(a, b, 1, box.n)],
  ];
  let out = ring;
  for (const [inside, at] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(at(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(at(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

function cut(a: [number, number], b: [number, number], axis: 0 | 1, v: number): [number, number] {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
}

const coast: Ring[] = [];
for (const { ring, hole } of rings) {
  if (hole) continue;
  const inside = clip(ring.slice(0, -1));
  if (inside.length < 3) continue;
  const pts = simplify([...inside, inside[0]], 0.03);
  if (pts.length >= 4) coast.push(pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
}

writeFileSync(
  new URL('../src/world/data/land.json', import.meta.url),
  JSON.stringify({ source: 'Natural Earth 1:10m land, public domain', cols: COLS, rows: ROWS, land, coast }) + '\n',
);
console.log(`${COLS}×${ROWS} cells, ${[...land].filter((d) => Number(d) < 4).length} sea; ${coast.length} coast rings, ${coast.reduce((n, r) => n + r.length, 0)} points`);
