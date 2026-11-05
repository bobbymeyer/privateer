/**
 * Who is at war with whom, in 1580. The table is history, fixed for the
 * voyage; only your own conduct can start a war.
 *
 * For you, sailing for England, it decides what's fair game: an enemy's
 * ships and towns are, and the Crown approves. Anyone else's are not.
 */

import type { Nation } from './ports.ts';

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

/** England is always at odds with the corsairs. */
export const CORSAIRS: Nation[] = ['barbary', 'morocco'];

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

/**
 * 1580: Spain and Portugal one crown, and England's enemies both, at sea if
 * not yet by declaration; the corsairs everyone's.
 */
export function openingWars(): War[] {
  let wars = [...STANDING_WARS];
  for (const c of [...CORSAIRS, 'spain', 'portugal'] as Nation[]) wars = declare(wars, YOUR_NATION, c);
  return wars;
}
