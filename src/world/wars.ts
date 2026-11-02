/**
 * Who is at war with whom, in 16XX. A century of wars collapsed into one
 * table, like the ports: England against Spain and the Barbary corsairs;
 * Spain against the Dutch and the French; the Dutch against Portugal in the
 * Indies; the Ottomans against Venice and the Knights of Malta; and the
 * Barbary states against nearly everyone's shipping.
 *
 * For you, sailing for England, it decides what's fair game: an enemy's
 * ships and towns are, and the Crown approves. Anyone else's are not.
 */

import type { Nation } from './ports.ts';

/** The flag you sail under. */
export const YOUR_NATION: Nation = 'england';

export const WARS: [Nation, Nation][] = [
  ['england', 'spain'],
  ['england', 'barbary'],
  ['spain', 'netherlands'],
  ['spain', 'france'],
  ['portugal', 'netherlands'],
  ['ottoman', 'venice'],
  ['ottoman', 'malta'],
  ['barbary', 'spain'],
  ['barbary', 'france'],
  ['barbary', 'netherlands'],
  ['barbary', 'venice'],
  ['barbary', 'malta'],
];

export const atWar = (a: Nation, b: Nation) => WARS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** At war with England: fair game. */
export const isEnemy = (n: Nation) => atWar(YOUR_NATION, n);
