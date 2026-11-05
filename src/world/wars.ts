/**
 * Who is at war with whom, in 16XX — and how that changes. The table is
 * part of the world now: it opens a little differently each run, drifts
 * season by season as treaties are signed and broken, and your own conduct
 * can start a war.
 *
 * For you, sailing for England, it decides what's fair game: an enemy's
 * ships and towns are, and the Crown approves. Anyone else's are not.
 */

import { type Nation, nationName } from './ports.ts';
import { type Roller, pick, roll } from './random.ts';

/** The flag you sail under. */
export const YOUR_NATION: Nation = 'england';

export type War = [Nation, Nation];

/** The other powers' wars, as a run opens. */
export const STANDING_WARS: War[] = [
  // The Dutch Revolt, against the one crown of Spain and Portugal.
  ['spain', 'netherlands'],
  ['portugal', 'netherlands'],
  ['ottoman', 'malta'],
  ['barbary', 'spain'],
  ['barbary', 'portugal'],
  ['barbary', 'netherlands'],
  ['barbary', 'venice'],
  ['barbary', 'malta'],
];

/** England is always at odds with the corsairs, and opens at war with one of these, chosen by the run. */
export const CORSAIRS: Nation[] = ['barbary', 'morocco'];
export const ENGLAND_OPENS_AGAINST: Nation[] = ['spain', 'france', 'netherlands'];

/** The powers whose quarrels come and go. Independent harbours are nobody's enemy. */
export const POWERS: Nation[] = ['england', 'spain', 'france', 'netherlands', 'portugal', 'denmark', 'sweden', 'ottoman', 'barbary', 'morocco', 'venice'];

/** Each season, a war ends with this chance, and a peace breaks with this one. The corsairs make peace hard and break it easily. */
export const PEACE_CHANCE = 0.12;
export const WAR_CHANCE = 0.03;
const CORSAIR_PEACE = 0.05;
const CORSAIR_WAR = 0.1;

/** Enough of your attacks on a nation at peace with England, and England is at war with it. */
export const CASUS_BELLI = 6;

const same = (w: War, a: Nation, b: Nation) => (w[0] === a && w[1] === b) || (w[0] === b && w[1] === a);
export const atWar = (wars: War[], a: Nation, b: Nation) => wars.some((w) => same(w, a, b));
/** At war with England: fair game. */
export const isEnemy = (wars: War[], n: Nation) => atWar(wars, YOUR_NATION, n);
export const enemiesOf = (wars: War[], n: Nation): Nation[] => wars.flatMap((w) => (w[0] === n ? [w[1]] : w[1] === n ? [w[0]] : []));

export function declare(wars: War[], a: Nation, b: Nation): War[] {
  return atWar(wars, a, b) || a === b ? wars : [...wars, [a, b]];
}
export function makePeace(wars: War[], a: Nation, b: Nation): War[] {
  return wars.filter((w) => !same(w, a, b));
}

/** How a run's wars open: the standing ones, the corsairs, and England against one of the great powers. */
/**
 * 1580: Spain and Portugal one crown, and England's enemies both, at sea if
 * not yet by declaration; the corsairs everyone's. `r` is kept for the
 * signature: the opening is history now, not a roll.
 */
export function openingWars(r: Roller): War[] {
  void r;
  let wars = [...STANDING_WARS];
  for (const c of [...CORSAIRS, 'spain', 'portugal'] as Nation[]) wars = declare(wars, YOUR_NATION, c);
  return wars;
}

/** A season of diplomacy: every pair of powers may make peace, or fall out. Returns the new table and what was heard of it. */
export function drift(wars: War[], r: Roller): { wars: War[]; news: string[] } {
  const news: string[] = [];
  let next = wars;
  for (let i = 0; i < POWERS.length; i++) {
    for (let j = i + 1; j < POWERS.length; j++) {
      const [a, b] = [POWERS[i], POWERS[j]];
      const corsair = CORSAIRS.includes(a) || CORSAIRS.includes(b);
      if (atWar(next, a, b)) {
        if (roll(r) < (corsair ? CORSAIR_PEACE : PEACE_CHANCE)) {
          next = makePeace(next, a, b);
          news.push(`peace between ${nationName(a)} and ${nationName(b)}`);
        }
      } else if (roll(r) < (corsair ? CORSAIR_WAR : WAR_CHANCE)) {
        next = declare(next, a, b);
        news.push(`war between ${nationName(a)} and ${nationName(b)}`);
      }
    }
  }
  return { wars: next, news };
}
