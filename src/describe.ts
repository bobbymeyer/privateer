/** Words for what happened, shared by the terminal and the browser. */

import type { Effect } from './cards.ts';
import type { EffectNote, GameEvent, Outcome } from './rules.ts';

const VERB: Record<Exclude<Effect['kind'], 'flee' | 'hold'>, string> = {
  hit: 'hits the target for',
  hurt: 'hurts you for',
  plunder: 'hauls aboard',
  repair: 'repairs',
  brace: 'braces for',
  jettison: 'throws overboard',
  mend: 'mends the target by',
};

export function describeEffect(e: Effect, applied: number, note?: EffectNote, mine = true): string {
  if (e.kind === 'flee') {
    const who = mine ? 'you' : 'the target';
    if (note === 'unthreatened') return `${who} ${mine ? 'are' : 'is'} not threatened enough to run`;
    if (note === 'held') return `${who} ${mine ? 'try' : 'tries'} to run, but ${mine ? 'are' : 'is'} held`;
    return `${who} break${mine ? '' : 's'} away`;
  }
  if (e.kind === 'hold') return `${mine ? 'holds the target' : 'holds you'} for ${applied}`;
  const amount = e.amount;
  const short = applied !== amount && e.kind !== 'hurt' ? ` (of ${amount})` : '';
  const soaked = e.kind === 'hurt' && applied < amount ? ` (${amount - applied} braced)` : '';
  return `${VERB[e.kind]} ${applied}${short}${soaked}`;
}

export const OUTCOME_TEXT: Record<Outcome, string> = {
  fled: 'you got away',
  escaped: 'the target got away',
  destroyed: 'the target went down',
  sunk: 'you were sunk',
  parted: 'the ships drifted apart',
};

/** One line per event, or null for events that are not worth a line. */
export function describeEvent(e: GameEvent): string | null {
  switch (e.type) {
    case 'played': return e.card.name;
    case 'effect': return describeEffect(e.effect, e.applied, e.note, e.card.side === 'ship');
    case 'rejected': return `${e.card.name} goes to the bottom`;
    case 'ended': return `${OUTCOME_TEXT[e.outcome]}. you walk away with ${e.payout}`;
    case 'dealt': return null;
  }
}
