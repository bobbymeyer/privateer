/**
 * The score: what a voyage came to. Treasure home, every hand alive, and
 * the ship's condition, against the voyages of the time.
 *
 * | a voyage like | means |
 * | Drake's       | round the world, rich, most of the crew home |
 * | Cavendish's   | home rich, and dear in men |
 * | Fenton's      | home again, poorer, or no richer |
 * | Oxenham's     | lost |
 *
 * And one that isn't on that list: a pirate retired rich in a haven, who
 * never came home at all.
 */

import { SHIP_CLASSES } from '../outfit.ts';
import { howHome } from './journey.ts';
import { GOAL, START_GOLD, type WorldState } from './world.ts';

/** What each hand home is worth to the score. */
export const HAND_WORTH = 2;
/** What a sound ship is worth, all of her; a battered one, her share of it. */
export const SHIP_WORTH = 20;
/** Rich: what a voyage needs home to count as one that paid. */
export const RICH = GOAL;

export type Like = 'drake' | 'cavendish' | 'fenton' | 'oxenham' | 'pirate';

export interface Score {
  treasure: number;
  hands: number;
  ship: number;
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
  pirate: 'a pirate’s end',
};

export function score(w: WorldState): Score {
  const lost = { treasure: 0, hands: 0, ship: 0, total: 0 };
  if (w.ending === 'retired') {
    return { ...lost, treasure: w.gold, total: w.gold, like: 'pirate', title: LIKE_TITLES.pirate, text: 'rich, in a haven on the Barbary coast or in Munster, and never home again.' };
  }
  if (!w.won) {
    return { ...lost, like: 'oxenham', title: LIKE_TITLES.oxenham, text: 'lost. Oxenham crossed the isthmus of Panama in 1577, took the silver, and was hanged at Lima.' };
  }
  const treasure = w.gold;
  const hands = w.crew * HAND_WORTH;
  const ship = Math.round((w.hull / w.maxHull) * SHIP_WORTH);
  const total = treasure + hands + ship;
  const how = howHome(w.voyage);
  const rich = w.gold >= RICH;
  const mostHome = w.crew >= SHIP_CLASSES[w.outfit.ship].complement / 2;
  const parts = { treasure, hands, ship, total };
  if (rich && how === 'round' && mostHome) {
    return { ...parts, like: 'drake', title: LIKE_TITLES.drake, text: 'round the world, rich, and most of the crew home. the Queen will want to see you.' };
  }
  if (rich) {
    const way = how === 'round' ? 'round the world' : how === 'back' ? 'home the way you went' : 'home';
    return { ...parts, like: 'cavendish', title: LIKE_TITLES.cavendish, text: `${way}, rich${mostHome ? '' : ', and dear in men'}. Cavendish came home in 1588 with his sails of silk, and half his crew left behind.` };
  }
  const poorer = w.gold < START_GOLD;
  return { ...parts, like: 'fenton', title: LIKE_TITLES.fenton, text: `home again, ${poorer ? 'poorer than you left' : 'with little to show for it'}. Fenton turned back off Brazil in 1582 and was blamed for it.` };
}
