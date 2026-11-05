/**
 * The score: what a voyage came to. Treasure home, every hand alive, and
 * the ship's condition, times what the ship you chose counts for, against
 * the voyages of the time.
 *
 * | a voyage like | means |
 * | Drake's       | round the world, rich, most of the crew home |
 * | Cavendish's   | home rich, and dear in men |
 * | Fenton's      | home again, poorer, or no richer |
 * | Oxenham's     | lost |
 */

import { SHIP_CLASSES } from '../outfit.ts';
import { howHome } from './journey.ts';
import type { WorldState } from './world.ts';

/** What each hand home is worth to the score. */
export const HAND_WORTH = 2;
/** What a sound ship is worth, all of her; a battered one, her share of it. */
export const SHIP_WORTH = 20;
/** Rich: what a voyage needs home to count as one that paid. */
export const RICH = 200;

export type Like = 'drake' | 'cavendish' | 'fenton' | 'oxenham';

export interface Score {
  treasure: number;
  hands: number;
  ship: number;
  /** What the ship you chose counts for. */
  multiplier: number;
  total: number;
  like: Like;
  /** The voyage of the time it's like, named. */
  title: string;
  /** What it means, in a line. */
  text: string;
}

export const LIKE_TITLES: Record<Like, string> = {
  drake: 'a voyage like Drake’s',
  cavendish: 'a voyage like Cavendish’s',
  fenton: 'a voyage like Fenton’s',
  oxenham: 'a voyage like Oxenham’s',
};

export function score(w: WorldState): Score {
  const c = SHIP_CLASSES[w.ship];
  if (!w.won) {
    return { treasure: 0, hands: 0, ship: 0, multiplier: c.multiplier, total: 0, like: 'oxenham', title: LIKE_TITLES.oxenham, text: 'lost. Oxenham crossed the isthmus of Panama in 1577, took the silver, and was hanged at Lima.' };
  }
  const treasure = w.gold;
  const hands = w.crew * HAND_WORTH;
  const ship = Math.round((w.hull / w.maxHull) * SHIP_WORTH);
  const parts = { treasure, hands, ship, multiplier: c.multiplier, total: Math.round((treasure + hands + ship) * c.multiplier) };
  const how = howHome(w.voyage);
  const rich = w.gold >= RICH;
  const mostHome = w.crew >= c.complement / 2;
  if (rich && how === 'round' && mostHome) {
    return { ...parts, like: 'drake', title: LIKE_TITLES.drake, text: 'round the world, rich, and most of the crew home. the Queen will want to see you.' };
  }
  if (rich) {
    const way = how === 'round' ? 'round the world' : how === 'back' ? 'home the way you went' : 'home';
    return { ...parts, like: 'cavendish', title: LIKE_TITLES.cavendish, text: `${way}, rich${mostHome ? '' : ', and dear in men'}. Cavendish came home in 1588 with his sails of silk, and half his crew left behind.` };
  }
  const poorer = w.gold < c.purse;
  return { ...parts, like: 'fenton', title: LIKE_TITLES.fenton, text: `home again, ${poorer ? 'poorer than you left' : 'with little to show for it'}. Fenton turned back off Brazil in 1582 and was blamed for it.` };
}
