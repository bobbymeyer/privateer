/**
 * The coast of Brazil in December 1580: Portuguese, but not yet the King of
 * Spain's. Philip took Portugal's crown this year, and Portugal's colonies
 * swore to him only in 1581 and 1582, so a settlement on the coast may deal
 * with an English ship, or turn her away and send word south.
 *
 * And the bay of Guanabara, where Villegagnon's France Antarctique stood
 * from 1555 until the Portuguese took it in 1560: Norman ships still come
 * for the brazilwood the Tupinambá cut, and its red dye. (Probasco, on
 * Catherine de Medici and the Huguenot colonies, p. 52.)
 */

import { type Roller, roll } from './random.ts';
import type { WorldState } from './world.ts';

/** On raising the coast of Brazil, outward: a Portuguese settlement, this often. */
export const SETTLEMENT_CHANCE = 0.7;
/** A boat sent to treat: how often they deal, and what they ask. */
export const SETTLEMENT_DEALS = 0.55;
export const SETTLEMENT_COST = 5;
export const SETTLEMENT_DAYS = 14;
/** At Guanabara: a Norman ship loading brazilwood, this often; and what she sells it for. */
export const NORMANS_CHANCE = 0.6;
export const NORMAN_WOOD_COST = 2;

const ask = (s: WorldState, dilemma: WorldState['dilemma'], text: string): WorldState => (s.dilemma || s.hail || s.encounter ? s : { ...s, dilemma, log: [...s.log, { turn: s.turn, text, stop: true }] });

/** On raising the coast of Brazil or the bay of Guanabara, outward. Called by `raise`. */
export function arriveBrazil(s: WorldState, key: string): WorldState {
  if (key !== 'brazil' && key !== 'guanabara') return s;
  const r: Roller = { rng: s.rng };
  let w = s;
  if (key === 'brazil' && !w.seen.includes('settlement') && roll(r) < SETTLEMENT_CHANCE) {
    w = ask({ ...w, seen: [...w.seen, 'settlement'] }, { kind: 'settlement' }, 'smoke from a Portuguese settlement up the coast');
  }
  if (key === 'guanabara' && roll(r) < NORMANS_CHANCE) {
    w = ask(w, { kind: 'normans' }, 'a Norman ship in the bay, loading brazilwood');
  }
  return { ...w, rng: r.rng };
}
