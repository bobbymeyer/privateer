/** A mutable cursor over the seeded RNG, for code that rolls many times. */

import { type RngState, next } from '../rng.ts';

export interface Roller {
  rng: RngState;
}

export function roll(r: Roller): number {
  const [v, s] = next(r.rng);
  r.rng = s;
  return v;
}

export function pick<T>(r: Roller, items: readonly T[]): T {
  return items[Math.floor(roll(r) * items.length)];
}

/** Picks an index with probability proportional to its weight. */
export function weighted(r: Roller, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = roll(r) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}
