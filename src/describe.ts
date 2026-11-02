/** Words for what happened, shared by the terminal and the browser. */

import type { Effect } from './cards.ts';
import type { EffectNote, GameEvent, Outcome } from './rules.ts';

const VERB: Record<Exclude<Effect['kind'], 'flee' | 'hold' | 'hit' | 'hurt' | 'breach' | 'interrogate' | 'recall' | 'wound'>, string> = {
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
    if (note === 'rigging') return `${who} ${mine ? 'try' : 'tries'} to run, but the sails are shot away`;
    return `${who} break${mine ? '' : 's'} away`;
  }
  if (e.kind === 'hit') return `hits the target for ${applied}`;
  if (e.kind === 'hurt') return `hurts you for ${applied}${applied < e.amount ? ` (${e.amount - applied} braced)` : ''}`;
  if (e.kind === 'wound') return `${mine ? 'leaves them' : 'leaves you'} ${e.what === 'leak' ? 'a leak below' : e.what === 'fire' ? 'fire aboard' : 'with sails shot away'}`;
  if (e.kind === 'breach') {
    if (!mine) return `the target loses ${applied} hull`;
    return `you lose ${applied} hull${applied < e.amount ? ` (${e.amount - applied} braced)` : ''}`;
  }
  if (e.kind === 'recall') return applied ? `brings ${applied} spent ${applied === 1 ? 'card' : 'cards'} back under the deck` : 'nothing spent to bring back';
  if (e.kind === 'interrogate') return `prisoners talk: a rumor, ${Math.round(e.reliability * 100)}% reliable`;
  if (e.kind === 'hold') return `${mine ? 'holds the target' : 'holds you'} for ${applied}`;
  const amount = e.amount;
  const short = applied !== amount ? ` (of ${amount})` : '';
  return `${VERB[e.kind]} ${applied}${short}`;
}

/** How a raid ends: a town can't run or go down, so the words differ. */
export const RAID_OUTCOME_TEXT: Record<Outcome, string> = {
  fled: 'you fall back to the boats',
  escaped: 'the town holds',
  destroyed: 'the town is sacked',
  sunk: 'you were sunk under the guns',
  parted: 'the raid peters out, and you withdraw',
};

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
