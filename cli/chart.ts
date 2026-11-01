/**
 * Draws the sea as an SVG: coastline, nodes, currents, ports, passages, and
 * where ships actually went over a long run, so the sea lanes can be seen.
 *
 *   npm run chart -- out.svg [--turns 3000] [--kind merchant] [--season 0]
 */

import { writeFileSync } from 'node:fs';
import { SEASONS } from '../src/world/caribbean.ts';
import { BOUNDS, KX } from '../src/world/grid.ts';
import { advance, createSea, createWorld, DEFAULT_FLEET } from '../src/world/world.ts';
import type { ShipKind } from '../src/world/ships.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const out = process.argv[2] ?? 'chart.svg';
const turns = Number(arg('turns', '3000'));
const only = arg('kind', '') as ShipKind | '';
const season = Number(arg('season', '-1'));

const { map, pattern } = createSea();

// Traffic: a big fleet over many turns, counting each ship-turn on a node.
const traffic = map.nodes.map(() => 0);
const fleet = [...DEFAULT_FLEET, ...DEFAULT_FLEET, ...DEFAULT_FLEET];
let w = createWorld(createSea(), 1, fleet);
for (let t = 0; t < turns; t++) {
  w = advance(createSea(), w, w.player);
  for (const s of w.ships) if (!s.away && (!only || s.kind === only)) traffic[s.node]++;
}
const peak = Math.max(...traffic);

const S = 40; // px per degree
const W = (BOUNDS.east - BOUNDS.west) * KX * S;
const H = (BOUNDS.north - BOUNDS.south) * S;
const px = (x: number) => (x - BOUNDS.west * KX) * S;
const py = (y: number) => (BOUNDS.north - y) * S;
const lonlat = (lon: number, lat: number) => `${px(lon * KX).toFixed(1)},${py(lat).toFixed(1)}`;

const parts: string[] = [];
parts.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
for (const ring of map.coast) parts.push(`<polygon points="${ring.map(([a, b]) => lonlat(a, b)).join(' ')}" fill="#e2e2e2" stroke="#999" stroke-width="0.6"/>`);

// Edges, faint.
for (const n of map.nodes) for (const m of map.adj[n.id]) if (m > n.id) {
  const o = map.nodes[m];
  parts.push(`<line x1="${px(n.x)}" y1="${py(n.y)}" x2="${px(o.x)}" y2="${py(o.y)}" stroke="#eee" stroke-width="0.6"/>`);
}

// Traffic.
for (const n of map.nodes) {
  if (!traffic[n.id]) continue;
  const r = 2 + 13 * Math.sqrt(traffic[n.id] / peak);
  parts.push(`<circle cx="${px(n.x)}" cy="${py(n.y)}" r="${r.toFixed(1)}" fill="#b3261e" fill-opacity="0.35"/>`);
}

// Banks, straits, rivers, guns.
for (const n of map.nodes) {
  const [cx, cy] = [px(n.x), py(n.y)];
  if (n.shoal) parts.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="#3a7" stroke-width="1"/>`);
  if (n.strait) parts.push(`<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" fill="none" stroke="#25c" stroke-width="1"/>`);
  if (n.river) parts.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="#25c" stroke-dasharray="2 2"/>`);
  if (n.guns && !n.port) parts.push(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="#000"/>`);
}

// Currents, or the wind of one season.
for (const n of map.nodes) {
  const [vx, vy] = season >= 0 ? pattern.wind[season][n.id] : pattern.current[n.id];
  const len = Math.hypot(vx, vy);
  if (len < 0.05) continue;
  const k = 14 * Math.min(1.6, len);
  const [x0, y0] = [px(n.x), py(n.y)];
  const [x1, y1] = [x0 + (vx / len) * k, y0 - (vy / len) * k];
  parts.push(`<line x1="${x0}" y1="${y0}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#123" stroke-width="${(0.5 + len).toFixed(2)}"/>`);
  parts.push(`<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="1.3" fill="#123"/>`);
}

// Ports.
for (const n of map.nodes) {
  if (!n.port) continue;
  const [cx, cy] = [px(n.x), py(n.y)];
  parts.push(`<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" fill="${n.port.fort ? '#000' : '#fff'}" stroke="#000"/>`);
  parts.push(`<text x="${cx + 7}" y="${cy + 4}" font-family="Georgia" font-size="11">${n.port.name}</text>`);
}
const title = season >= 0 ? `wind, ${SEASONS[season].name}` : 'currents';
parts.push(`<text x="10" y="${H - 10}" font-family="Georgia" font-size="13">${title} · traffic${only ? ` (${only})` : ''} over ${turns} turns · ${map.nodes.length} nodes</text>`);

writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">${parts.join('')}</svg>\n`);
console.log(`wrote ${out}`);
