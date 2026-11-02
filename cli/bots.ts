/**
 * Card-playing bots, shared by the simulators. Each tries the six ordered
 * keeps one step ahead and takes the best by what it values.
 */

import { type Action, type EncounterState, act, legalActions } from '../src/rules.ts';

export interface Weights {
  /** Per point of your hull still standing. */
  hull: number;
  /** Per point of damage on the target: progress toward the bounty. */
  damage: number;
  /** Added to the payout when you get away. Negative: would rather not. */
  fled: number;
}

function score(s: EncounterState, w: Weights): number {
  if (s.outcome === 'sunk') return -20;
  if (s.outcome === 'fled') return s.payout + w.fled;
  if (s.outcome) return s.payout;
  // Still fighting: what is aboard, plus what the position is worth.
  // Wounds waiting in the deck count for most of what they'll cost: they
  // mostly land, but one per hand can be put off.
  const pending = (side: 'ship' | 'target') =>
    [...s.deck, ...s.hand]
      .filter((c) => c.damage && c.side === side)
      .reduce((t, c) => t + c.effects.reduce((h, e) => h + (e.kind === 'breach' ? e.amount : 0), 0), 0);
  const hull = s.ship.hull - 0.7 * pending('ship');
  const dealt = s.target.maxHull - s.target.hull + 0.7 * pending('target');
  return s.plunder + w.hull * hull + w.damage * dealt + 0.2 * s.target.cargo;
}

export function lookahead(w: Weights): (s: EncounterState) => Action {
  return (s) => {
    let best = legalActions(s)[0];
    let bestScore = -Infinity;
    for (const a of legalActions(s)) {
      const v = score(act(s, a), w);
      if (v > bestScore) [best, bestScore] = [a, v];
    }
    return best;
  };
}

