/**
 * Today's voyage, told in a few lines to paste wherever you like: the same
 * world for everyone who sails it that day, so the lines are worth comparing.
 * Plain text, copied to the clipboard by the end screen; nothing is sent
 * anywhere.
 */

import { SHIP_CLASSES } from './outfit.ts';
import { landmark } from './world/landmarks.ts';
import type { Backer } from './world/reckoning.ts';
import { ROLE } from './world/hands.ts';
import { score } from './world/score.ts';
import { dateOf, type WorldState } from './world/world.ts';

/** Whose money, as the captain would say it. */
const ON: Record<Backer, string> = { crown: 'on the Crown’s money', gentlemen: 'on gentlemen adventurers’ money', own: 'on my own stake' };

/** The voyage in a few lines: which voyage, the ship and her money, how far, who died, the score, the seed. */
export function shareText(w: WorldState, seed: number, daily: string | null): string {
  const sc = score(w);
  const c = SHIP_CLASSES[w.ship];
  const raised = w.voyage.visited.length - 1;
  const furthest = landmark(w.voyage.at).name;
  const dead = w.hands.filter((h) => h.dead && h.dead.cause !== 'went down with the ship');
  const lines = [
    `privateer · ${daily ? `today's voyage, ${daily}` : 'a voyage'}`,
    `a ${c.name}, ${ON[w.backer]}`,
    w.won
      ? `home to Plymouth on ${dateOf(w.turn)}, ${w.turn} days out, ${raised} landmarks raised`
      : `lost on ${dateOf(w.turn)}, ${raised} landmarks out, last raised ${furthest}`,
    w.won ? `${sc.title}: ${sc.total}` : sc.title,
    ...(dead.length ? [`the dead: ${dead.map((h) => `${h.name}, ${ROLE[h.role].title}, of ${h.dead!.cause}`).join('; ')}`] : []),
    `${w.crew} hands ${w.won ? 'home' : 'left'} of ${c.complement}${w.tally.taken ? ` · ${w.tally.taken} taken` : ''}${w.tally.sacks ? ` · ${w.tally.sacks} sacked` : ''}`,
    `seed ${seed}`,
  ];
  return lines.join('\n');
}
