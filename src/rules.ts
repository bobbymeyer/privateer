/**
 * The encounter loop. Pure: no rendering, no I/O, no Math.random. Every
 * function takes a state and returns a new one, and the RNG lives in the
 * state, so a seed and a list of actions replay the same encounter exactly.
 *
 * The loop:
 *   1. Ship cards and target cards are shuffled into one deck.
 *   2. Three are dealt. You keep two, which resolve in the order you name
 *      them and are then spent, into the discard; the third goes to the
 *      bottom of the deck. A spent card comes back only when a card says
 *      so (`recall`).
 *   3. It ends when either side flees, when either hull reaches 0, or when
 *      the deck can no longer deal a full hand.
 *
 * Shot strikes the hull at once. Some of it also leaves a wound that
 * outlasts it — a leak, a fire, shot-away sails — as a card on top of the
 * deck against the side it struck. Keeping a wound card deals with it, at
 * its cost; sending it to the bottom only puts it off. Shot-away sails cost
 * no hull, but till they're dealt with, that side can't flee.
 *
 * Every decision in combat is a card. There is no stop button: you get away
 * the same way the target does, by playing a flee card while threatened.
 */

import { type Card, type Effect, type Side, type Wound, woundCard } from './cards.ts';
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
  /** How far you've made toward breaking away. At ESCAPE, you're away. */
  way: number;
}

export interface TargetState {
  name: string;
  hull: number;
  maxHull: number;
  /** What is still in its hold. */
  cargo: number;
  /** Paid on `destroyed`. */
  bounty: number;
  /** How far she's made toward breaking away. At ESCAPE, she's away. */
  way: number;
  /** Taken rather than sunk — a town — so what's left in the hold is yours too. */
  takenWhole?: boolean;
}

/**
 * Credibly threatened: hull at half or less, or outgunned two to one. The
 * rules no longer turn on it — any ship may run — but it's how a captain
 * reads a fight, and the bots and the fight sheet use it.
 */
export function threatened(side: { hull: number; maxHull: number }, other: { hull: number }): boolean {
  return side.hull * 2 <= side.maxHull || other.hull >= OUTGUNNED * side.hull;
}

export const OUTGUNNED = 2;

/** Way needed to break away: two flee cards, unless chase or hold takes it back in between. */
export const ESCAPE = 3;

/** Why an effect did less than its face value, when that is worth saying. */
export type EffectNote = 'rigging';

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
  /** Cards kept and played, most recent last. They come back only by `recall`. */
  discard: Card[];
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
  /** Help that comes to the target if the fight drags on. */
  reinforce: Reinforcement | null;
  /** How much of that help has come. */
  reinforced: number;
  /** Reliability of each rumor got from prisoners. Emptied if you are sunk. */
  intel: number[];
  events: GameEvent[];
}

/** Indices into the hand, in the order the cards should resolve. */
export type Action = { type: 'keep'; picks: [number, number] };

/**
 * Help for the target that comes if the fight goes on: from round `from`, a
 * card on top of the deck every `every` rounds, `count` of them in all. It
 * is a fixed relief, not a flood: once it's all come, no more does.
 */
export interface Reinforcement {
  from: number;
  every: number;
  count: number;
  card: Omit<Card, 'id'>;
}

export interface EncounterSetup {
  seed: number;
  shipCards: Card[];
  targetCards: Card[];
  ship: Omit<ShipState, 'way'>;
  target: Omit<TargetState, 'way'>;
  reinforce?: Reinforcement;
}

export function createEncounter(setup: EncounterSetup): EncounterState {
  const [deck, rng] = shuffle([...setup.shipCards, ...setup.targetCards], setup.seed >>> 0);
  const state: EncounterState = {
    rng,
    deck,
    hand: [],
    discard: [],
    ship: { ...setup.ship, way: 0 },
    target: { ...setup.target, way: 0 },
    plunder: 0,
    round: 0,
    outcome: null,
    payout: 0,
    minted: 0,
    reinforce: setup.reinforce ?? null,
    reinforced: 0,
    intel: [],
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
      if (outcome) {
        s.discard.push(card);
        return end(s, outcome);
      }
    }
    // Played, and spent.
    s.discard.push(card);
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
      applied = Math.min(effect.amount, s.target.hull);
      s.target.hull -= applied;
      break;
    case 'hurt': {
      const soaked = Math.min(effect.amount, s.ship.brace);
      s.ship.brace -= soaked;
      applied = Math.min(effect.amount - soaked, s.ship.hull);
      s.ship.hull -= applied;
      break;
    }
    case 'wound':
      applied = 1;
      wound(s, mine ? 'target' : 'ship', effect.what);
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
      // Making way: the card's worth. Not with the sails shot away.
      const runner = mine ? s.ship : s.target;
      if (rigged(s, card.side)) {
        note = 'rigging';
        break;
      }
      applied = effect.amount;
      runner.way += applied;
      if (runner.way >= ESCAPE) fled = mine ? 'fled' : 'escaped';
      break;
    }
    case 'interrogate':
      applied = 1;
      s.intel.push(effect.reliability);
      break;
    case 'chase':
    case 'hold': {
      // Taking way off the other side: grappled, or run down.
      const other = mine ? s.target : s.ship;
      applied = Math.min(effect.amount, other.way);
      other.way -= applied;
      break;
    }
    case 'recall': {
      // The side's own spent cards, most recent first, back under the deck.
      for (let i = s.discard.length - 1; i >= 0 && applied < effect.amount; i--) {
        const spent = s.discard[i];
        if (spent.side !== card.side || spent.damage) continue;
        s.discard.splice(i, 1);
        s.deck.push(spent);
        applied++;
      }
      break;
    }
  }
  s.events.push({ type: 'effect', round: s.round, card, effect, applied, ...(note ? { note } : {}) });
  return [s, fled];
}

/** A wound against `side`, on top of the deck: it's in the next hand. */
function wound(s: EncounterState, side: Side, what: Wound): void {
  s.minted += 1;
  s.deck.unshift(woundCard(side, `${what}-${side}#${s.minted}`, what));
}

/** Shot-away sails still in a side's deck or hand: it can't flee. */
const rigged = (s: EncounterState, side: Side) => [...s.deck, ...s.hand].some((c) => c.side === side && c.wound === 'sails');

/** Your hull is checked first: if both reach 0 on one effect, you went down. */
function settled(s: EncounterState): Outcome | null {
  if (s.ship.hull <= 0) return 'sunk';
  if (s.target.hull <= 0) return 'destroyed';
  return null;
}

function deal(s: EncounterState): EncounterState {
  // Fight too long and help comes: on top, so it's in the next hand — a
  // card every so many rounds, till the relief has all arrived.
  const r = s.reinforce;
  const round = s.round + 1;
  if (r && s.reinforced < r.count && round >= r.from && (round - r.from) % r.every === 0) {
    s.minted += 1;
    s.reinforced += 1;
    s.deck.unshift({ ...r.card, id: `reinforce#${s.minted}` });
  }
  if (s.deck.length < HAND_SIZE) return end(s, 'parted');
  s.round += 1;
  s.hand = s.deck.slice(0, HAND_SIZE);
  s.deck = s.deck.slice(HAND_SIZE);
  s.events.push({ type: 'dealt', round: s.round, cards: s.hand.slice() });
  return s;
}

function end(s: EncounterState, outcome: Outcome): EncounterState {
  s.outcome = outcome;
  if (outcome === 'sunk') s.intel = [];
  const taken = s.target.takenWhole ? s.target.cargo : 0;
  s.payout =
    outcome === 'sunk' ? 0 : outcome === 'destroyed' ? s.plunder + s.target.bounty + taken : s.plunder;
  s.events.push({ type: 'ended', round: s.round, outcome, payout: s.payout });
  return s;
}

/** Cards and effects are never mutated, so a shallow copy of the containers is enough. */
function clone(s: EncounterState): EncounterState {
  return {
    ...s,
    deck: s.deck.slice(),
    hand: s.hand.slice(),
    discard: s.discard.slice(),
    ship: { ...s.ship },
    target: { ...s.target },
    events: s.events.slice(),
    intel: s.intel.slice(),
  };
}
