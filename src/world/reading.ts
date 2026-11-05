/**
 * What you can see of a ship before you engage her: her hull, what she
 * likely carries, and the character of how she fights, read off her deck.
 * A captain of the century would know a galleon from a merchant by her rig
 * and her gunports; this is that, in words.
 */

import { type CardDef, REACHES, type Reach, WOUNDS } from '../cards.ts';
import { type Extra, TARGETS, type TargetKind } from '../setup.ts';

export interface Reading {
  hull: number;
  cargo: number;
  bounty: number;
  /** How she fights, in a few words: `heavily gunned`, `fast: she'll run`. */
  traits: string[];
}

const copies = (cards: readonly CardDef[], test: (c: CardDef) => boolean) => cards.filter(test).reduce((t, c) => t + c.copies, 0);
const amount = (c: CardDef, kind: string) => c.effects.reduce((t, e) => t + (e.kind === kind && 'amount' in e ? e.amount : 0), 0);

/** Her character, from her deck: what a captain would read off her rig and her gunports. */
export function read(kind: TargetKind, extra: Extra = {}): Reading {
  const t = TARGETS[kind];
  const cards = t.cards;
  const total = copies(cards, () => true);
  // Weight of shot a card throws at you: its hurt, and what its wounds will cost after.
  // Weight of shot a card throws at you at a range: its hurt there, and what its wounds will cost after.
  const shotAt = (c: CardDef, r: Reach) =>
    c.effects.reduce((t, e) => t + (e.at && !e.at.includes(r) ? 0 : e.kind === 'hurt' ? e.amount : e.kind === 'wound' ? WOUNDS[e.what].hull : 0), 0);
  const avgAt = (r: Reach) => cards.reduce((sum, c) => sum + shotAt(c, r) * c.copies, 0) / total;
  // Her guns at their best range: one range applies at a time, so the best of them, not the sum.
  const guns = Math.max(...REACHES.map(avgAt));
  const running = copies(cards, (c) => c.effects.some((e) => e.kind === 'flee')) / total;
  const grip = copies(cards, (c) => c.effects.some((e) => e.kind === 'hold' || e.kind === 'chase'));
  const mends = copies(cards, (c) => c.effects.some((e) => e.kind === 'mend'));
  const wounds = copies(cards, (c) => c.effects.some((e) => e.kind === 'wound'));
  const cargo = t.cargo + (extra.cargo ?? 0);

  const traits = [guns >= 1.8 ? 'heavily gunned' : guns >= 1.3 ? 'well gunned' : 'lightly armed'];
  if (running === 0) traits.push("she won't run");
  else if (running >= 0.2) traits.push("fast: she'll run");
  if (grip >= 3) traits.push('hard to shake off');
  if (wounds >= 3) traits.push('her shot leaves wounds');
  if (mends >= 2) traits.push('she mends quickly');
  if (t.reinforce) traits.push('help comes if it drags on');
  if (avgAt('far') >= 1.1) traits.push('her guns reach you far off');
  if (Math.max(...cards.map((c) => shotAt(c, 'grappled'))) >= 4) traits.push('deadly alongside');
  traits.push(cargo >= 20 ? 'a rich hold' : cargo >= 10 ? 'a fair hold' : cargo > 0 ? 'a light hold' : 'nothing to take');
  return { hull: t.hull + (extra.hull ?? 0), cargo, bounty: t.bounty, traits };
}
