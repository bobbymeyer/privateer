/**
 * Currents and wind: the grain of the sea. Both are fixed by ocean.ts, so a
 * captain who has learned them can predict where a ship will go. Each is a
 * vector per node — [east, north] — which way and how hard.
 */

import { type LonLat, bearing, heading, local } from './geo.ts';
import type { NodeId, SeaMap } from './map.ts';
import { RIVERS, SEASON_LENGTH, STREAMS, WIND } from './ocean.ts';

type Vec = [number, number];

export interface SeaPattern {
  /** Current at each node. */
  current: Vec[];
  /** Wind at each node, per season. */
  wind: Vec[][];
  seasonLength: number;
}

/** Past this, where streams overlap and add up, the sea would be a one-way street. */
const MAX_CURRENT = 1.5;

export function currentAt(p: LonLat): Vec {
  let v: Vec = [0, 0];
  for (const s of STREAMS) {
    // The nearest point on the stream's course, on a flat chart around p.
    const pts = s.path.map((q) => local(p, q));
    let best = { d: Infinity, dir: [0, 0] as Vec };
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const [dx, dy] = [bx - ax, by - ay];
      const len2 = dx * dx + dy * dy;
      if (len2 === 0 || Math.abs(dx) > 90) continue;
      const t = Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best.d) best = { d, dir: [dx / Math.sqrt(len2), dy / Math.sqrt(len2)] };
    }
    const k = s.strength * Math.exp(-((best.d / s.width) ** 2));
    v = [v[0] + best.dir[0] * k, v[1] + best.dir[1] * k];
  }
  const len = Math.hypot(...v);
  if (len > MAX_CURRENT) v = [(v[0] / len) * MAX_CURRENT, (v[1] / len) * MAX_CURRENT];
  for (const r of RIVERS) {
    const [x, y] = local(p, r.at);
    const k = r.strength * Math.exp(-((Math.hypot(x, y) / 1.2) ** 2));
    const b = bearing(r.seaward);
    v = [v[0] + b[0] * k, v[1] + b[1] * k];
  }
  return v;
}

const inBox = ([lon, lat]: LonLat, b: { west: number; east: number; south: number; north: number }) =>
  lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;

export function windAt(p: LonLat, season: number): Vec {
  const phi = p[1] - WIND.shift[season];
  const a = Math.abs(phi);
  const pole = Math.sign(phi) || 1;
  let east: number;
  let north: number;
  if (a < 28) {
    // Trades: toward the west and the equator, hardest about 14°, slack in
    // the doldrums at the equator.
    const k = Math.sin((Math.PI * a) / 28);
    east = -(0.2 + 0.8 * k);
    north = -pole * 0.4 * k;
  } else if (a < 68) {
    // Westerlies: toward the east and the pole, hardest about 48°; harder
    // still in the south, where no land breaks them.
    const k = Math.sin((Math.PI * (a - 28)) / 40) * (phi < 0 ? WIND.roaring : 1);
    east = k;
    north = pole * 0.4 * k;
  } else {
    // Polar easterlies, weak.
    east = -0.3 * Math.sin((Math.PI * (a - 68)) / 22);
    north = 0;
  }
  let v: Vec = [east, north];

  const m = WIND.monsoon.seasons[season];
  if (m && WIND.monsoon.regions.some((b) => inBox(p, b))) {
    const b = bearing(m.toward);
    v = [b[0] * m.strength, b[1] * m.strength];
  }
  const n = WIND.norther;
  if (season === 0 && inBox(p, n)) {
    const b = bearing(n.toward);
    v = [b[0] * n.strength, b[1] * n.strength];
  }
  return v;
}

export function buildPattern(map: SeaMap): SeaPattern {
  const at = (i: number): LonLat => [map.nodes[i].lon, map.nodes[i].lat];
  return {
    current: map.nodes.map((_, i) => currentAt(at(i))),
    wind: WIND.shift.map((_, s) => map.nodes.map((_, i) => windAt(at(i), s))),
    seasonLength: SEASON_LENGTH,
  };
}

export const seasonOf = (p: SeaPattern, turn: number) => Math.floor(turn / p.seasonLength) % p.wind.length;

const along = (u: Vec, v: Vec, w: Vec) => (u[0] * (v[0] + w[0])) / 2 + (u[1] * (v[1] + w[1])) / 2;
const dir = (map: SeaMap, a: NodeId, b: NodeId) => heading([map.nodes[a].lon, map.nodes[a].lat], [map.nodes[b].lon, map.nodes[b].lat]);

/** How hard the current sets along a→b: negative against, positive with. */
export function currentAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId): number {
  return along(dir(map, a, b), p.current[a], p.current[b]);
}

/** How hard the wind blows along a→b on this turn: negative into it, positive downwind. */
export function windAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId, turn: number): number {
  const w = p.wind[seasonOf(p, turn)];
  return along(dir(map, a, b), w[a], w[b]);
}

/**
 * How strongly ships favour running with the current and before the wind:
 * a leg straight down a current of strength 1 is e^2.8, about sixteen times
 * likelier than one straight into it. Weaker, and knowing the sea hardly
 * sharpened a prediction at all — see `npm run rumors`.
 */
export const CURRENT_PULL = 2.8;
export const WIND_PULL = 2.0;

/** What the player has learned of the sea. */
export interface SeaKnowledge {
  currents: boolean;
  winds: boolean;
}

/**
 * The weight a ship gives sailing a→b, against the other ways it could go.
 * `know` limits it to what an observer has learned — the true weight is the
 * one with everything known.
 */
export function legWeight(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId, turn: number, know: SeaKnowledge = { currents: true, winds: true }): number {
  const c = know.currents ? CURRENT_PULL * currentAlong(map, p, a, b) : 0;
  const w = know.winds ? WIND_PULL * windAlong(map, p, a, b, turn) : 0;
  return Math.exp(c + w);
}
