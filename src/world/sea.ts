/**
 * Currents and wind: the grain of the sea. Both are fixed by the seed, so a
 * player who has learned them can predict where a ship will drift.
 *
 * Currents are a gyre — the sea turns slowly around its middle — and never
 * change. Wind follows a schedule of seasons that repeats.
 */

import { ASPECT, type NodeId, type SeaMap } from './map.ts';
import { type Roller, roll } from './random.ts';

export interface SeaPattern {
  /** +1 clockwise gyre, -1 counter-clockwise. */
  gyre: 1 | -1;
  /** Wind headings in radians, one per season, repeating. */
  seasons: number[];
  /** Turns per season. */
  seasonLength: number;
}

export function generatePattern(seed: number): SeaPattern {
  const r: Roller = { rng: (seed ^ 0x5eed) >>> 0 };
  const gyre = roll(r) < 0.5 ? 1 : -1;
  // A prevailing wind that swings through four seasons.
  const base = roll(r) * Math.PI * 2;
  const seasons = [0, 0.6, 0, -0.6].map((d) => base + d + (roll(r) - 0.5) * 0.4);
  return { gyre, seasons, seasonLength: 5 };
}

export function windAt(p: SeaPattern, turn: number): number {
  return p.seasons[Math.floor(turn / p.seasonLength) % p.seasons.length];
}

function unit(map: SeaMap, a: NodeId, b: NodeId): [number, number] {
  const dx = map.nodes[b].x - map.nodes[a].x;
  const dy = map.nodes[b].y - map.nodes[a].y;
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

/** How far sailing a→b runs with the current: -1 against, +1 with. */
export function currentAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId): number {
  const [ux, uy] = unit(map, a, b);
  const mx = (map.nodes[a].x + map.nodes[b].x) / 2 - 0.5;
  const my = (map.nodes[a].y + map.nodes[b].y) / 2 - ASPECT / 2;
  const len = Math.hypot(mx, my) || 1;
  // Perpendicular to the radius: round and round.
  const [cx, cy] = [(-my / len) * p.gyre, (mx / len) * p.gyre];
  return ux * cx + uy * cy;
}

/** How far sailing a→b runs before the wind on this turn: -1 into it, +1 downwind. */
export function windAlong(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId, turn: number): number {
  const [ux, uy] = unit(map, a, b);
  const w = windAt(p, turn);
  return ux * Math.cos(w) + uy * Math.sin(w);
}

/**
 * How strongly ships favour running with the current and before the wind:
 * a leg straight down the current is e^2.8, about sixteen times likelier
 * than one straight into it. Weaker, and knowing the sea hardly sharpened a
 * prediction at all — see `npm run rumors`.
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
 * `know` limits it to what an observer has learned — the true weight is
 * the one with everything known.
 */
export function legWeight(map: SeaMap, p: SeaPattern, a: NodeId, b: NodeId, turn: number, know: SeaKnowledge = { currents: true, winds: true }): number {
  const c = know.currents ? CURRENT_PULL * currentAlong(map, p, a, b) : 0;
  const w = know.winds ? WIND_PULL * windAlong(map, p, a, b, turn) : 0;
  return Math.exp(c + w);
}
