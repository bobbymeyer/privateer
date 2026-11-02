/**
 * Draws the world graph: land, edges, coastal and ocean nodes, the
 * passages, and Drake's circumnavigation found through the graph.
 *
 *   npm run chart -- out.svg land-50m.geojson [--box w,s,e,n] [--scale px-per-degree]
 *     [--turns 2000] [--kind treasure-fleet]   ship traffic over a long run
 *     [--flow current | --flow wind:2]          currents, or one season's wind
 */

import { readFileSync, writeFileSync } from 'node:fs';
import world from '../src/world/data/world.json' with { type: 'json' };
import { DRAKE } from '../src/world/drake.ts';
import { advance, createSea, createWorld } from '../src/world/world.ts';
import type { ShipKind } from '../src/world/ships.ts';

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

// Traffic: where ships actually went over a long run, every node including
// those a day along a longer leg.
const turns = Number(arg('turns', '0'));
const only = arg('kind', '') as ShipKind | '';
if (turns > 0) {
  const sea = createSea();
  const traffic = new Float64Array(sea.map.nodes.length);
  let w = createWorld(sea, 1);
  for (let t = 0; t < turns; t++) {
    w = advance(sea, w, w.player);
    for (const s of w.ships) if (!only || s.kind === only) traffic[s.node]++;
  }
  const peak = Math.max(...traffic);
  sea.map.nodes.forEach((n, i) => {
    if (!traffic[i] || !inBox(n.lon, n.lat)) return;
    const r = 1 + 2.2 * S * Math.sqrt(traffic[i] / peak);
    parts.push(`<circle cx="${X(n.lon).toFixed(1)}" cy="${Y(n.lat).toFixed(1)}" r="${r.toFixed(1)}" fill="#b3261e" fill-opacity="0.3"/>`);
  });
}

// Flow: currents, or the wind of one season, at the world graph's own nodes.
const flow = arg('flow', '');
if (flow) {
  const sea = createSea();
  const season = flow.startsWith('wind') ? Number(flow.split(':')[1] ?? 0) : -1;
  sea.map.nodes.forEach((n, i) => {
    if (n.kind === 'underway' || !inBox(n.lon, n.lat)) return;
    const [vx, vy] = season >= 0 ? sea.pattern.wind[season][i] : sea.pattern.current[i];
    const len = Math.hypot(vx, vy);
    if (len < 0.05) return;
    const k = 2.2 * S * Math.min(1.5, len);
    const [x0, y0] = [X(n.lon), Y(n.lat)];
    const [x1, y1] = [x0 + (vx / len) * k, y0 - (vy / len) * k];
    parts.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#123" stroke-width="${(0.4 + 0.6 * len).toFixed(2)}"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${(0.6 + 0.2 * S).toFixed(1)}" fill="#123"/>`);
  });
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
