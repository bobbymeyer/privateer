/**
 * Builds src/world/data/coast.json, the coastline the browser draws, from
 * Natural Earth's 1:50m land (public domain), simplified and rounded:
 *
 *   npm run coast -- path/to/ne_50m_land.geojson
 *
 * Drawing only; the sea itself comes from world.json.
 */

import { readFileSync, writeFileSync } from 'node:fs';

type Ring = [number, number][];
const TOLERANCE = 0.05; // degrees: about three miles

const src = process.argv[2];
if (!src) throw new Error('usage: npm run coast -- ne_50m_land.geojson');
const geo = JSON.parse(readFileSync(src, 'utf8'));

function simplifyOpen(pts: Ring): Ring {
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
    let farD = TOLERANCE;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > farD) [far, farD] = [i, d];
    }
    if (far >= 0) (keep[far] = 1, stack.push([a, far], [far, b]));
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring has no line to measure from; split it at the point farthest from its start. */
function simplify(ring: Ring): Ring {
  const [x0, y0] = ring[0];
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) if (Math.hypot(ring[i][0] - x0, ring[i][1] - y0) > Math.hypot(ring[far][0] - x0, ring[far][1] - y0)) far = i;
  return [...simplifyOpen(ring.slice(0, far + 1)), ...simplifyOpen(ring.slice(far)).slice(1)];
}

const rings: number[][] = [];
for (const f of geo.features) {
  const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const ring = poly[0];
    if (ring.length < 4 || ring.every(([, lat]) => lat < -62)) continue;
    const pts = simplify(ring);
    if (pts.length < 4) continue;
    rings.push(pts.flatMap(([x, y]) => [Math.round(x * 20) / 20, Math.round(y * 20) / 20]));
  }
}

writeFileSync(new URL('../src/world/data/coast.json', import.meta.url), JSON.stringify({ source: 'Natural Earth 1:50m land, public domain', rings }) + '\n');
console.log(`${rings.length} rings, ${rings.reduce((t, r) => t + r.length / 2, 0)} points`);
