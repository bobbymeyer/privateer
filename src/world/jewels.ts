/**
 * Jewels: what a prize's great cabin or a town's church gives up besides
 * the silver, and what you do with them at home. Sell them to a goldsmith,
 * or set them aside for the Queen, who loved a jewel above anything.
 *
 * Grounded in Levin and Auble's essay on turquoise and queenship: a
 * turquoise ring was valued at £10 in 1514 and 1527, Cromwell's at £6 and
 * £7 beside a ruby ring at £13; in 1576 the goldsmith John Mabbe offered
 * Elizabeth "eighteen rings enameled white and black with Turcas in every
 * ring", her colours; and when Desmond was killed in January 1582 his gold
 * turquoise ring was sent to her as proof of it. She was fascinated by things
 * from the East, and asked her ambassador at Istanbul for Turkish clothes.
 *
 * So: a jewel's worth to a goldsmith is its `value`. Set aside for the Queen
 * it counts toward the gift at the reckoning, more if it's to her taste
 * (black-and-white enamel, or from the East). The dead commander's ring is
 * proof of service: presented, it makes court safe and forgives a question.
 */

import type { TargetKind } from '../setup.ts';
import type { Nation } from './ports.ts';
import { type Roller, pick, roll } from './random.ts';
import type { WorldState } from './world.ts';

export type JewelKind = 'turquoise' | 'pearls' | 'ruby' | 'emerald' | 'diamond' | 'enamel' | 'commander';

export interface Jewel {
  kind: JewelKind;
  /** What it's called in the log and at the reckoning: `a turquoise ring`, `the ring of Don Pedro de Arana`. */
  name: string;
  /** What a goldsmith gives for it. */
  value: number;
  /** Set aside for the Queen, rather than sold. */
  forQueen?: boolean;
}

/** What each kind is, what it's worth to a goldsmith, and whether it's to the Queen's taste. */
export const JEWELS: Record<Exclude<JewelKind, 'commander'>, { name: string; value: number; taste?: string }> = {
  turquoise: { name: 'a turquoise ring', value: 15, taste: 'turquoise from Persia, which she loves' },
  pearls: { name: 'a rope of pearls from the Margarita fishery', value: 30 },
  ruby: { name: 'a ruby ring', value: 25 },
  emerald: { name: 'an emerald from New Granada', value: 35 },
  diamond: { name: 'a table-cut diamond from the mines of Golconda', value: 60, taste: 'from the East' },
  enamel: { name: 'a ring enamelled white and black', value: 20, taste: 'in her colours, white and black' },
};
/** The dead commander's ring: worth a little, and proof of service. */
export const COMMANDER_VALUE = 20;
/** A jewel to the Queen's taste counts this much more toward the gift. */
export const TASTE = 1.5;

/** How often a prize or a town gives up a jewel, by what she is. */
const CHANCE: Partial<Record<TargetKind, number>> = { merchant: 0.2, 'treasure-ship': 0.6, privateer: 0.15, corsair: 0.15, town: 0.4, fortress: 0.6 };
/** Her captain killed in the taking, and his ring yours: this often, of a fighting ship or a great one. */
export const COMMANDER_CHANCE = 0.25;

const DONS = ['Don Pedro de Arana', 'Don Francisco de Zárate', 'Don Gonzalo de Ronquillo', 'Dom Jorge de Meneses', 'Dom Rodrigo de Lima', 'Don Luis de Velasco', 'Dom Álvaro de Castro', 'Don Juan de Antón'];

/** Which jewels her nation and her waters give: emeralds from the Spanish Main, diamonds and pearls from the East. */
function kindsFor(nation: Nation, east: boolean): Exclude<JewelKind, 'commander'>[] {
  if (east) return ['diamond', 'pearls', 'turquoise', 'ruby'];
  if (nation === 'spain') return ['emerald', 'pearls', 'ruby', 'enamel'];
  if (nation === 'portugal') return ['pearls', 'turquoise', 'ruby', 'diamond'];
  return ['turquoise', 'ruby', 'enamel'];
}

/**
 * A prize taken or a town sacked: a jewel, sometimes, and her captain's ring
 * if he fell. Called when a fight is settled. `east`: the Indies' waters.
 */
export function plunderJewels(s: WorldState, kind: TargetKind, nation: Nation, east: boolean, r: Roller): WorldState {
  let w = s;
  const found: Jewel[] = [];
  if (roll(r) < (CHANCE[kind] ?? 0)) {
    const k = pick(r, kindsFor(nation, east));
    found.push({ kind: k, name: JEWELS[k].name, value: JEWELS[k].value });
  }
  const fighting = kind === 'privateer' || kind === 'treasure-ship' || kind === 'fortress' || kind === 'corsair';
  if (fighting && (nation === 'spain' || nation === 'portugal') && roll(r) < COMMANDER_CHANCE) {
    found.push({ kind: 'commander', name: `the ring of ${pick(r, DONS)}, who fell defending her`, value: COMMANDER_VALUE });
  }
  if (!found.length) return w;
  w = { ...w, jewels: [...w.jewels, ...found] };
  return { ...w, log: [...w.log, ...found.map((j) => ({ turn: w.turn, text: `in the great cabin: ${j.name}` }))] };
}

/** Whether a jewel is to the Queen's taste. */
export const toHerTaste = (j: Jewel) => j.kind !== 'commander' && !!JEWELS[j.kind].taste;
/** What the jewels set aside for her count toward a gift. */
export const favourOf = (s: WorldState) => Math.round(s.jewels.filter((j) => j.forQueen).reduce((t, j) => t + j.value * (toHerTaste(j) ? TASTE : 1), 0));
/** Whether the dead commander's ring is set aside for her: proof of service. */
export const proofOfService = (s: WorldState) => s.jewels.some((j) => j.forQueen && j.kind === 'commander');

/** Set a jewel aside for the Queen, or back for the goldsmith. */
export function setAside(s: WorldState, i: number, forQueen: boolean): WorldState {
  if (!s.jewels[i]) throw new Error('no such jewel');
  return { ...s, jewels: s.jewels.map((j, k) => (k === i ? { ...j, forQueen } : j)) };
}

/** At the reckoning: the jewels not set aside sold to a goldsmith, into the strongroom. The rest stay, for her. */
export function sellJewels(s: WorldState): WorldState {
  const sold = s.jewels.filter((j) => !j.forQueen);
  if (!sold.length) return s;
  const gold = sold.reduce((t, j) => t + j.value, 0);
  return { ...s, gold: s.gold + gold, jewels: s.jewels.filter((j) => j.forQueen), log: [...s.log, { turn: s.turn, text: `${sold.length === 1 ? sold[0].name : `${sold.length} jewels`} sold to a goldsmith in Cheapside: ${gold}` }] };
}

/** What the jewels not set aside would fetch from a goldsmith. */
export const saleValue = (s: WorldState) => s.jewels.filter((j) => !j.forQueen).reduce((t, j) => t + j.value, 0);
