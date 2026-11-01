/**
 * Currents and wind: the grain of the sea. Both come from caribbean.ts and
 * are fixed, so a player who has learned them can predict where a ship will
 * go. Each is a vector per node: which way the water sets, which way the
 * wind blows, and how hard.
 */

import { BACKGROUND, RIVERS, SEASON_LENGTH, SEASONS, STREAMS } from './caribbean.ts';
import { project } from './grid.ts';
import type { NodeId, SeaMap } from './map.ts';

type Vec = [number, number];

export interface SeaPattern {
  /** Current at each node. */
  current: Vec[];
  /** Wind at each node, per season. */
  wind: Vec[][];
  seasonLength: number;
}

const bearing = (deg: number): Vec => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];

/** Where a stream runs past a point: the nearest point on its line, and the way it runs there. */
function nearestOnPath(p: Vec, path: Vec[]): { d: number; dir: Vec } {
  let best = { d: Infinity, dir: [0, 0] as Vec };
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const [dx, dy] = [bx - ax, by - ay];
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
    if (d < best.d) best = { d, dir: [dx / Math.sqrt(len2), dy / Math.sqrt(len2)] };
  }
  return best;
}

const MAX_CURRENT = 1.5;

export function currentAt(lon: number, lat: number): Vec {
  const p = project(lon, lat);
  let v: Vec = [0, 0];
  for (const s of STREAMS) {
    const { d, dir } = nearestOnPath(p, s.path.map(([a, b]) => project(a, b)));
    const k = s.strength * Math.exp(-((d / s.width) ** 2));
    v = [v[0] + dir[0] * k, v[1] + dir[1] * k];
  }
  // The slack set fills in where no stream runs.
  if (lat < BACKGROUND.southOf) {
    const slack = Math.max(0, 1 - Math.hypot(...v)) * BACKGROUND.strength;
    const b = bearing(BACKGROUND.heading);
    v = [v[0] + b[0] * slack, v[1] + b[1] * slack];
  }
  // Where streams overlap they add up; past this the sea is a one-way street.
  const len = Math.hypot(...v);
  if (len > MAX_CURRENT) v = [(v[0] / len) * MAX_CURRENT, (v[1] / len) * MAX_CURRENT];
  for (const r of RIVERS) {
    const [mx, my] = project(...r.at);
    const k = r.strength * Math.exp(-((Math.hypot(p[0] - mx, p[1] - my) / 1.2) ** 2));
    const b = bearing(r.seaward);
    v = [v[0] + b[0] * k, v[1] + b[1] * k];
  }
  return v;
}

export function windAt(lon: number, lat: number, season: number): Vec {
  const s = SEASONS[season];
  const n = s.norther;
  if (n && lat > n.northOf) {
    // Blends in over a degree, so the edge of a norther is not a wall.
    const k = Math.min(1, lat - n.northOf);
    const [a, b] = [bearing(s.toward), bearing(n.toward)];
    return [(a[0] * (1 - k) + b[0] * k) * s.strength, (a[1] * (1 - k) + b[1] * k) * s.strength];
  }
  const b = bearing(s.toward);
  return [b[0] * s.strength, b[1] * s.strength];
}

export function buildPattern(map: SeaMap): SeaPattern {
  return {
    current: map.nodes.map((n) => currentAt(n.lon, n.lat)),
    wind: SEASONS.map((_, i) => map.nodes.map((n) => windAt(n.lon, n.lat, i))),
    seasonLength: SEASON_LENGTH,
  };
}

export const seasonOf = (p: SeaPattern, turn: number) => Math.floor(turn / p.seasonLength) % p.wind.length;

function unit(map: SeaMap, a: NodeId, b: NodeId): Vec {
  const dx = map.nodes[b].x - map.nodes[a].x;
  const dy = map.nodes[b].y - map.nodes[a].y;
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

const along = (u: Vec, v: Vec, w: Vec) => u[0] * (v[0] + w[0]) / 2 + u[1] * (v[1] + w[1]) / 2;

/** How hard the current sets along a→b: negative against, positive with. */
export function currentAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId): number {
  return along(unit(map, a, b), p.current[a], p.current[b]);
}

/** How hard the wind blows along a→b on this turn: negative into it, positive downwind. */
export function windAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId, turn: number): number {
  const w = p.wind[seasonOf(p, turn)];
  return along(unit(map, a, b), w[a], w[b]);
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
