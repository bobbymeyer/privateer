/** Words for what happened, shared by the terminal and the browser. */

import type { Effect } from './cards.ts';
import type { EffectNote, GameEvent, Outcome } from './rules.ts';

const VERB: Record<Exclude<Effect['kind'], 'flee' | 'hold' | 'chase' | 'hit' | 'hurt' | 'breach' | 'interrogate' | 'recall' | 'wound'>, string> = {
  plunder: 'hauls aboard',
  repair: 'repairs',
  brace: 'braces for',
  jettison: 'throws overboard',
  mend: 'mends the target by',
};

export function describeEffect(e: Effect, applied: number, note?: EffectNote, mine = true): string {
  if (e.kind === 'flee') {
    const who = mine ? 'you' : 'the target';
    if (note === 'rigging') return `${who} ${mine ? 'try' : 'tries'} to run, but the sails are shot away`;
    return `${who} ${mine ? 'make' : 'makes'} ${applied} way${applied > e.amount ? ', running hard' : ''}`;
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
  if (e.kind === 'chase') return applied ? `${mine ? 'you give chase' : 'she gives chase'}: ${applied} way off ${mine ? 'her' : 'you'}` : `${mine ? 'you give chase' : 'she gives chase'}, but ${mine ? 'she' : 'you'} had made no way`;
  if (e.kind === 'hold') return applied ? `${mine ? 'holds her' : 'holds you'}: ${applied} way lost` : `${mine ? 'holds her' : 'holds you'}, though no way had been made`;
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

/** What each word on a card means, in a line: for the card's tooltip and the fight sheet's glossary. */
export const GLOSSARY: { word: string; means: string }[] = [
  { word: 'hit', means: 'shot into her: that much off her hull' },
  { word: 'hurt', means: 'shot into you: that much off your hull, less any brace' },
  { word: 'leak, fire', means: 'a wound left on top of the deck: keep it to deal with it, at its cost in hull (leak 2, fire 3), or send it under and face it later' },
  { word: 'sails', means: 'sails shot away: no flee card works for that side until the wound is dealt with' },
  { word: 'plunder', means: 'that much from her hold into yours; kept even if you run' },
  { word: 'brace', means: 'soaks up the next hurt' },
  { word: 'repair, mend', means: 'hull back: repair is yours, mend is hers' },
  { word: 'jettison', means: 'she throws cargo over the side to lighten ship' },
  { word: 'flee', means: 'makes way; three way and that side is away' },
  { word: 'chase, hold', means: "take way off the other side: run her down, or grapple her" },
  { word: 'recall', means: 'that many of the side’s spent cards back under the deck' },
  { word: 'interrogate', means: 'prisoners will talk: a rumor, if you come through the fight' },
];

/** The glossary lines a card's text uses, for its tooltip. */
export function explainCard(text: string): string {
  return GLOSSARY.filter((g) => g.word.split(', ').some((w) => new RegExp(`\\b${w}\\b`).test(text)))
    .map((g) => `${g.word}: ${g.means}`)
    .join('\n');
}
