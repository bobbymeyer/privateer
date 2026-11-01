/**
 * Draws the world graph: land, edges, coastal and ocean nodes, the
 * passages, and Drake's circumnavigation found through the graph.
 *
 *   npm run world-chart -- out.svg land-50m.geojson [--box w,s,e,n] [--scale px-per-degree]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import world from '../src/world/data/world.json' with { type: 'json' };
import { DRAKE } from '../src/world/drake.ts';

const [out, landSrc] = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const [bw, bs, be, bn] = arg('box', '-180,-62,180,72').split(',').map(Number);
const S = Number(arg('scale', '6'));
const W = (be - bw) * S;
const H = (bn - bs) * S;
const X = (lon: number) => (lon - bw) * S;
const Y = (lat: number) => (bn - lat) * S;
const inBox = (lon: number, lat: number, pad = 2) => lon >= bw - pad && lon <= be + pad && lat >= bs - pad && lat <= bn + pad;

const nodes = world.nodes as [number, number, number][];
const adj: number[][] = nodes.map(() => []);
for (let i = 0; i < world.edges.length; i += 2) {
  const [a, b] = [world.edges[i], world.edges[i + 1]];
  adj[a].push(b);
  adj[b].push(a);
}

const parts: string[] = [`<rect width="${W}" height="${H}" fill="#fff"/>`];

// Land.
const geo = JSON.parse(readFileSync(landSrc, 'utf8'));
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const ring = poly[0] as [number, number][];
    if (!ring.some(([lon, lat]) => inBox(lon, lat, 10))) continue;
    parts.push(`<polygon points="${ring.map(([lon, lat]) => `${X(lon).toFixed(1)},${Y(lat).toFixed(1)}`).join(' ')}" fill="#e4e4e4" stroke="#aaa" stroke-width="0.5"/>`);
  }
}

// Edges; skip the ones that wrap the dateline.
for (let i = 0; i < world.edges.length; i += 2) {
  const [a, b] = [nodes[world.edges[i]], nodes[world.edges[i + 1]]];
  if (Math.abs(a[0] - b[0]) > 180 || !inBox(a[0], a[1]) || !inBox(b[0], b[1])) continue;
  parts.push(`<line x1="${X(a[0]).toFixed(1)}" y1="${Y(a[1]).toFixed(1)}" x2="${X(b[0]).toFixed(1)}" y2="${Y(b[1]).toFixed(1)}" stroke="#bbb" stroke-width="0.5"/>`);
}

// Nodes: coast black, ocean grey, passages red.
const fill = ['#111', '#999', '#b3261e'];
for (const [lon, lat, kind] of nodes) {
  if (!inBox(lon, lat)) continue;
  parts.push(`<circle cx="${X(lon).toFixed(1)}" cy="${Y(lat).toFixed(1)}" r="${kind === 1 ? 1.4 : 1.8}" fill="${fill[kind]}"/>`);
}

// Drake: nearest node to each place, shortest path between them.
const R = Math.PI / 180;
const dist = (a: [number, number], b: [number, number]) =>
  Math.acos(Math.min(1, Math.sin(a[1] * R) * Math.sin(b[1] * R) + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.cos((a[0] - b[0]) * R)));
const nearest = (at: [number, number]) => {
  let best = 0;
  for (let i = 1; i < nodes.length; i++) if (dist(at, [nodes[i][0], nodes[i][1]]) < dist(at, [nodes[best][0], nodes[best][1]])) best = i;
  return best;
};
const path = (from: number, to: number): number[] | null => {
  const prev = new Int32Array(nodes.length).fill(-1);
  prev[from] = from;
  const queue = [from];
  for (let i = 0; i < queue.length && prev[to] < 0; i++) for (const m of adj[queue[i]]) if (prev[m] < 0) (prev[m] = queue[i], queue.push(m));
  if (prev[to] < 0) return null;
  const out = [to];
  while (out[0] !== from) out.unshift(prev[out[0]]);
  return out;
};
let legs = 0;
let broken: string[] = [];
const stops = DRAKE.map((d) => nearest(d.at));
for (let k = 0; k < stops.length - 1; k++) {
  const p = path(stops[k], stops[k + 1]);
  if (!p) {
    broken.push(`${DRAKE[k].name} → ${DRAKE[k + 1].name}`);
    continue;
  }
  legs += p.length - 1;
  for (let j = 0; j < p.length - 1; j++) {
    const [a, b] = [nodes[p[j]], nodes[p[j + 1]]];
    if (Math.abs(a[0] - b[0]) > 180) continue;
    parts.push(`<line x1="${X(a[0]).toFixed(1)}" y1="${Y(a[1]).toFixed(1)}" x2="${X(b[0]).toFixed(1)}" y2="${Y(b[1]).toFixed(1)}" stroke="#b3261e" stroke-width="2"/>`);
  }
}
for (const [k, d] of DRAKE.entries()) {
  if (k === DRAKE.length - 1 || !inBox(...d.at)) continue;
  parts.push(`<text x="${X(d.at[0]) + 4}" y="${Y(d.at[1]) - 4}" font-family="Georgia" font-size="${Math.max(9, S * 1.6)}" fill="#b3261e">${d.name}</text>`);
}
const counts = [0, 0, 0];
for (const n of nodes) counts[n[2]]++;
parts.push(`<text x="8" y="${H - 8}" font-family="Georgia" font-size="12">${nodes.length} nodes (${counts[0]} coast, ${counts[1]} ocean, ${counts[2]} passage) · ${world.edges.length / 2} edges · Drake round the world in ${legs} legs${broken.length ? ` · BROKEN: ${broken.join('; ')}` : ''}</text>`);

writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>\n`);
console.log(`wrote ${out}: Drake in ${legs} legs${broken.length ? `; broken: ${broken.join('; ')}` : ''}`);
