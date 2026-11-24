/**
 * What a screen reader is told where the eye is shown a picture: the chart
 * in words, a gauge as a number and whether it's low, a card in full.
 * Pure, so the words can be tested.
 */

import { type Card, cardType } from '../cards.ts';
import { daysTo } from '../world/journey.ts';
import { HOME_LANDMARK, landmark } from '../world/landmarks.ts';
import type { Sea, WorldState } from '../world/world.ts';

const named = (k: string) => (k === HOME_LANDMARK ? 'Plymouth, home' : landmark(k).name);

/** The chart in words: where you are, where you're bound and how far, and where you've been. */
export function chartSummary(sea: Sea, w: WorldState): string {
  const here = sea.map.landmarks[w.voyage.at] === w.player ? `at ${named(w.voyage.at)}` : `at sea, last raised ${named(w.voyage.at)}`;
  const bound = w.voyage.bound ? `bound for ${named(w.voyage.bound)}, ${daysTo(sea, w, w.voyage.bound)} days` : 'no course set';
  const been = w.voyage.visited.map(named);
  return `the chart of the voyage: ${here}; ${bound}; raised so far: ${been.join(', ')}.`;
}

/** A gauge as a screen reader hears it: `hull 3 of 14, low`. */
export const gaugeLabel = (name: string, value: number, max: number, low = false) => `${name} ${value} of ${max}${low ? ', low' : ''}`;

/** A card in full: whose, what kind, its name and words, and what it would do now. */
export function cardLabel(card: Card, order: number | null, note = '', link = 0): string {
  const whose = card.damage ? (card.side === 'ship' ? 'a wound to you' : 'a wound to them') : `${card.side === 'ship' ? 'yours' : 'theirs'}, ${cardType(card)}`;
  const parts = [whose, card.name, card.text];
  if (link) parts.push(`played in order, plus ${link}`);
  if (note) parts.push(note);
  if (order !== null) parts.push(`picked, resolves ${order === 1 ? 'first' : 'second'}`);
  return parts.join('. ');
}
