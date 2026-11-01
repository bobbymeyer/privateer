/** Words for what happened, shared by the terminal and the browser. */

import type { Effect } from './cards.ts';
import type { GameEvent, Outcome } from './rules.ts';

const VERB: Record<Effect['kind'], string> = {
  hit: 'hits the target for',
  hurt: 'hurts you for',
  plunder: 'hauls aboard',
  repair: 'repairs',
  brace: 'braces for',
  jettison: 'throws overboard',
  mend: 'mends the target by',
};

export function describeEffect(e: Effect, applied: number): string {
  const short = applied !== e.amount && e.kind !== 'hurt' ? ` (of ${e.amount})` : '';
  const soaked = e.kind === 'hurt' && applied < e.amount ? ` (${e.amount - applied} braced)` : '';
  return `${VERB[e.kind]} ${applied}${short}${soaked}`;
}

export const OUTCOME_TEXT: Record<Outcome, string> = {
  stopped: 'you broke off',
  destroyed: 'the target went down',
  escaped: 'the target slipped away',
  sunk: 'you were sunk',
};

/** One line per event, or null for events that are not worth a line. */
export function describeEvent(e: GameEvent): string | null {
  switch (e.type) {
    case 'played': return e.card.name;
    case 'effect': return describeEffect(e.effect, e.applied);
    case 'rejected': return `${e.card.name} goes to the bottom`;
    case 'ended': return `${OUTCOME_TEXT[e.outcome]}. you walk away with ${e.payout}`;
    case 'dealt': return null;
  }
}
