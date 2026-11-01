/**
 * The encounter loop. Pure: no rendering, no I/O, no Math.random. Every
 * function takes a state and returns a new one, and the RNG lives in the
 * state, so a seed and a list of actions replay the same encounter exactly.
 *
 * The loop:
 *   1. Ship cards and target cards are shuffled into one deck.
 *   2. Three are dealt. You keep two, which resolve in the order you name
 *      them; the third goes to the bottom of the deck.
 *   3. It ends when either side flees, when either hull reaches 0, or when
 *      the deck can no longer deal a full hand.
 *
 * Shot is a card too. A hit does not touch the hull: it puts damage cards
 * on top of the deck, and the hull only drops when one is kept. One can be
 * sent to the bottom each hand; once they pile up, you have to take them.
 *
 * Every decision in combat is a card. There is no stop button: you get away
 * the same way the target does, by playing a flee card while threatened.
 */

import { type Card, type Effect, type Side, damageCard } from './cards.ts';
import { type RngState, shuffle } from './rng.ts';

export const HAND_SIZE = 3;
export const KEEP = 2;

export type Outcome =
  /** You fled. Plunder kept. */
  | 'fled'
  /** The target fled. Plunder kept, the rest of its hold goes with it. */
  | 'escaped'
  /** The target's hull reached 0. Plunder kept, bounty paid, its hold sinks. */
  | 'destroyed'
  /** Your hull reached 0. This encounter's plunder is lost. */
  | 'sunk'
  /** The deck ran short before anything was settled. Plunder kept. */
  | 'parted';

export interface ShipState {
  hull: number;
  maxHull: number;
  brace: number;
  /** Flee attempts of yours the target will cancel. */
  held: number;
}

export interface TargetState {
  name: string;
  hull: number;
  maxHull: number;
  /** What is still in its hold. */
  cargo: number;
  /** Paid on `destroyed`. */
  bounty: number;
  /** Flee attempts of the target's that you will cancel. */
  held: number;
}

/** Hull at half or less. The only state in which a flee card works. */
export function threatened(side: { hull: number; maxHull: number }): boolean {
  return side.hull * 2 <= side.maxHull;
}

/** Why an effect did less than its face value, when that is worth saying. */
export type EffectNote = 'held' | 'unthreatened';

export type GameEvent =
  | { type: 'dealt'; round: number; cards: Card[] }
  | { type: 'played'; round: number; card: Card }
  | { type: 'effect'; round: number; card: Card; effect: Effect; applied: number; note?: EffectNote }
  | { type: 'rejected'; round: number; card: Card }
  | { type: 'ended'; round: number; outcome: Outcome; payout: number };

export interface EncounterState {
  rng: RngState;
  /** Index 0 is the top. */
  deck: Card[];
  hand: Card[];
  ship: ShipState;
  target: TargetState;
  /** Hauled aboard this encounter, not yet safe. */
  plunder: number;
  round: number;
  outcome: Outcome | null;
  /** What you walk away with, once there is an outcome. */
  payout: number;
  /** Damage cards made so far, for unique ids. */
  minted: number;
  events: GameEvent[];
}

/** Indices into the hand, in the order the cards should resolve. */
export type Action = { type: 'keep'; picks: [number, number] };

export interface EncounterSetup {
  seed: number;
  shipCards: Card[];
  targetCards: Card[];
  ship: Omit<ShipState, 'held'>;
  target: Omit<TargetState, 'held'>;
}

export function createEncounter(setup: EncounterSetup): EncounterState {
  const [deck, rng] = shuffle([...setup.shipCards, ...setup.targetCards], setup.seed >>> 0);
  const state: EncounterState = {
    rng,
    deck,
    hand: [],
    ship: { ...setup.ship, held: 0 },
    target: { ...setup.target, held: 0 },
    plunder: 0,
    round: 0,
    outcome: null,
    payout: 0,
    minted: 0,
    events: [],
  };
  return deal(state);
}

/** Every legal action in this state. Handy for bots and for UIs. */
export function legalActions(state: EncounterState): Action[] {
  if (state.outcome) return [];
  const actions: Action[] = [];
  for (let a = 0; a < state.hand.length; a++) {
    for (let b = 0; b < state.hand.length; b++) {
      if (a !== b) actions.push({ type: 'keep', picks: [a, b] });
    }
  }
  return actions;
}

export function act(state: EncounterState, action: Action): EncounterState {
  if (state.outcome) throw new Error(`encounter is over (${state.outcome})`);

  const [a, b] = action.picks;
  const n = state.hand.length;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n || b >= n || a === b) {
    throw new Error(`bad picks ${a},${b} for a hand of ${n}`);
  }

  let s = clone(state);
  const kept = [s.hand[a], s.hand[b]];
  const rejected = s.hand.filter((_, i) => i !== a && i !== b);
  s.hand = [];

  for (const card of rejected) {
    s.deck.push(card);
    s.events.push({ type: 'rejected', round: s.round, card });
  }

  for (const card of kept) {
    s.events.push({ type: 'played', round: s.round, card });
    for (const effect of card.effects) {
      let fled: Outcome | null;
      [s, fled] = applyEffect(s, card, effect);
      const outcome = fled ?? settled(s);
      if (outcome) return end(s, outcome);
    }
  }

  return deal(s);
}

function applyEffect(s: EncounterState, card: Card, effect: Effect): [EncounterState, Outcome | null] {
  let applied = 0;
  let note: EffectNote | undefined;
  let fled: Outcome | null = null;
  const mine = card.side === 'ship';
  switch (effect.kind) {
    case 'hit':
      applied = mintDamage(s, 'target', effect.amount);
      break;
    case 'hurt':
      applied = mintDamage(s, 'ship', effect.amount);
      break;
    case 'breach':
      if (mine) {
        const soaked = Math.min(effect.amount, s.ship.brace);
        s.ship.brace -= soaked;
        applied = Math.min(effect.amount - soaked, s.ship.hull);
        s.ship.hull -= applied;
      } else {
        applied = Math.min(effect.amount, s.target.hull);
        s.target.hull -= applied;
      }
      break;
    case 'plunder':
      applied = Math.min(effect.amount, s.target.cargo);
      s.target.cargo -= applied;
      s.plunder += applied;
      break;
    case 'repair':
      applied = Math.min(effect.amount, s.ship.maxHull - s.ship.hull);
      s.ship.hull += applied;
      break;
    case 'brace':
      applied = effect.amount;
      s.ship.brace += applied;
      break;
    case 'jettison':
      applied = Math.min(effect.amount, s.target.cargo);
      s.target.cargo -= applied;
      break;
    case 'mend':
      applied = Math.min(effect.amount, s.target.maxHull - s.target.hull);
      s.target.hull += applied;
      break;
    case 'flee': {
      const runner = mine ? s.ship : s.target;
      if (!threatened(runner)) note = 'unthreatened';
      else if (runner.held > 0) {
        runner.held -= 1;
        note = 'held';
      } else {
        applied = 1;
        fled = mine ? 'fled' : 'escaped';
      }
      break;
    }
    case 'hold':
      applied = effect.amount;
      (mine ? s.target : s.ship).held += applied;
      break;
  }
  s.events.push({ type: 'effect', round: s.round, card, effect, applied, ...(note ? { note } : {}) });
  return [s, fled];
}

/**
 * Puts `n` damage cards against `side` on top of the deck, so fire lands in
 * the next hand. Random depths were tried first: spread out, damage cards
 * almost never shared a hand, one per hand can be dodged, and so incoming
 * fire almost never landed.
 */
function mintDamage(s: EncounterState, side: Side, n: number): number {
  const made: Card[] = [];
  for (let i = 0; i < n; i++) {
    s.minted += 1;
    made.push(damageCard(side, `damage-${side}#${s.minted}`));
  }
  s.deck.unshift(...made);
  return n;
}

/** Your hull is checked first: if both reach 0 on one effect, you went down. */
function settled(s: EncounterState): Outcome | null {
  if (s.ship.hull <= 0) return 'sunk';
  if (s.target.hull <= 0) return 'destroyed';
  return null;
}

function deal(s: EncounterState): EncounterState {
  if (s.deck.length < HAND_SIZE) return end(s, 'parted');
  s.round += 1;
  s.hand = s.deck.slice(0, HAND_SIZE);
  s.deck = s.deck.slice(HAND_SIZE);
  s.events.push({ type: 'dealt', round: s.round, cards: s.hand.slice() });
  return s;
}

function end(s: EncounterState, outcome: Outcome): EncounterState {
  s.outcome = outcome;
  s.payout =
    outcome === 'sunk' ? 0 : outcome === 'destroyed' ? s.plunder + s.target.bounty : s.plunder;
  s.events.push({ type: 'ended', round: s.round, outcome, payout: s.payout });
  return s;
}

/** Cards and effects are never mutated, so a shallow copy of the containers is enough. */
function clone(s: EncounterState): EncounterState {
  return {
    ...s,
    deck: s.deck.slice(),
    hand: s.hand.slice(),
    ship: { ...s.ship },
    target: { ...s.target },
    events: s.events.slice(),
  };
}
