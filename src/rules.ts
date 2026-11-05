/**
 * The encounter loop. Pure: no rendering, no I/O, no Math.random. Every
 * function takes a state and returns a new one, and the RNG lives in the
 * state, so a seed and a list of actions replay the same encounter exactly.
 *
 * Two ships, two decks, and the range between them.
 *
 * - **Range**: grappled, close or far. Most cards care: long guns reach at
 *   far, a broadside is heavy close, boarders only go across grappled.
 *   Chase and grapnels close it; bearing away opens it. Opened past far,
 *   whoever opened it is away.
 * - **Her intent** is shown: the top card of her deck, face up, before you
 *   choose. You play first, then she plays it. Then her next card turns up.
 * - **Your hand**: three dealt from your deck. Keep two; they resolve in the
 *   order you name them and are spent. The third goes to the bottom. Spent
 *   cards come back only when a card recalls them, so a fight runs out when
 *   your deck can't deal you two — it's fought in a few rounds, not a dozen.
 * - **Wounds**: shot can leave a leak, a fire or shot-away sails, as a card
 *   on top of the wounded side's deck. Yours comes into your hand: keep it
 *   to deal with it, at its cost, or send it under. Hers becomes her
 *   intent, a round she spends on it. Shot-away sails stop that side opening
 *   the range till they're dealt with.
 */

import { type Card, type CardType, CHAIN_ORDER, type Effect, type Reach, REACHES, type Side, type Wound, cardType, woundCard } from './cards.ts';
import { type RngState, shuffle } from './rng.ts';

export const HAND_SIZE = 3;
export const KEEP = 2;

export type Outcome =
  /** You got away. Plunder kept. */
  | 'fled'
  /** The target got away. Plunder kept, the rest of its hold goes with it. */
  | 'escaped'
  /** The target's hull reached 0. Plunder kept, bounty paid, its hold sinks. */
  | 'destroyed'
  /** Your hull reached 0. This encounter's plunder is lost. */
  | 'sunk'
  /** Your deck ran out before anything was settled. Plunder kept. */
  | 'parted';

/** Grappled, close, far: an index into REACHES. */
export type Range = 0 | 1 | 2;
export const GRAPPLED = 0;
export const CLOSE = 1;
export const FAR = 2;
/** Ship fights and raids start close: within hail, or the boats offshore. */
export const START_RANGE: Range = CLOSE;

export interface ShipState {
  hull: number;
  maxHull: number;
  brace: number;
}

export interface TargetState {
  name: string;
  hull: number;
  maxHull: number;
  /** What is still in its hold. */
  cargo: number;
  /** Paid on `destroyed`. */
  bounty: number;
  /** Taken rather than sunk — a town — so what's left in the hold is yours too. */
  takenWhole?: boolean;
  /** It can't move: a town. Its range never opens past close, and it never gets away. */
  fixed?: boolean;
}

/**
 * Credibly threatened: hull at half or less, or outgunned two to one. The
 * rules don't turn on it, but it's how a captain reads a fight, and the bots
 * and the fight sheet use it.
 */
export function threatened(side: { hull: number; maxHull: number }, other: { hull: number }): boolean {
  return side.hull * 2 <= side.maxHull || other.hull >= OUTGUNNED * side.hull;
}

export const OUTGUNNED = 2;

/** Why an effect did less than its face value, when that is worth saying. */
export type EffectNote = 'rigging' | 'range' | 'fixed';

export type GameEvent =
  | { type: 'dealt'; round: number; cards: Card[] }
  | { type: 'played'; round: number; card: Card }
  | { type: 'effect'; round: number; card: Card; effect: Effect; applied: number; note?: EffectNote }
  | { type: 'rejected'; round: number; card: Card }
  | { type: 'range'; round: number; range: Range }
  | { type: 'chain'; round: number; card: Card; links: number }
  | { type: 'ended'; round: number; outcome: Outcome; payout: number };

/**
 * The chain: your last card's type, and how many links in order it made.
 * A card of the next type in CHAIN_ORDER gets a link more, and every one of
 * its hits, plunder, repairs and brace that much more. Hands' work doesn't
 * break it or add to it; anything else out of order starts it again; a
 * board card at the end of a full chain closes it.
 */
export interface Chain {
  last: CardType | null;
  links: number;
}
export const NO_CHAIN: Chain = { last: null, links: 0 };
/** The effects a link adds to: never bearing away or closing, which would jump the range. */
const SCALES: Effect['kind'][] = ['hit', 'plunder', 'repair', 'brace'];

/** The links a card of `type` would make, played now. */
export function linksFor(chain: Chain, type: CardType): number {
  if (type === 'hands') return 0;
  const i = CHAIN_ORDER.indexOf(type);
  return chain.last && CHAIN_ORDER.indexOf(chain.last) === i - 1 ? chain.links + 1 : 0;
}

/** The chain after a card of `type` is played. */
export function chained(chain: Chain, type: CardType): Chain {
  if (type === 'hands') return chain;
  const links = linksFor(chain, type);
  return type === CHAIN_ORDER.at(-1) && links ? NO_CHAIN : { last: type, links };
}

export interface EncounterState {
  rng: RngState;
  /** Your chain of cards in order: see `Chain`. */
  chain: Chain;
  /** Your deck. Index 0 is the top. */
  deck: Card[];
  hand: Card[];
  /** Your cards kept and played, most recent last. They come back only by `recall`. */
  discard: Card[];
  /** Her deck, index 0 the top; her spent cards; and the card she'll play this round, face up. */
  herDeck: Card[];
  herDiscard: Card[];
  intent: Card | null;
  range: Range;
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
 * card on top of her deck every `every` rounds, `count` of them in all.
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
  ship: ShipState;
  target: TargetState;
  reinforce?: Reinforcement;
  range?: Range;
}

export function createEncounter(setup: EncounterSetup): EncounterState {
  const [deck, rng1] = shuffle(setup.shipCards, setup.seed >>> 0);
  const [herDeck, rng] = shuffle(setup.targetCards, rng1);
  const state: EncounterState = {
    rng,
    chain: NO_CHAIN,
    deck,
    hand: [],
    discard: [],
    herDeck,
    herDiscard: [],
    intent: null,
    range: setup.range ?? START_RANGE,
    ship: { ...setup.ship },
    target: { ...setup.target },
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

  // Yours first, in the order you named them; then hers.
  const plays: Card[] = [...kept, ...(s.intent ? [s.intent] : [])];
  s.intent = null;
  for (const card of plays) {
    s.events.push({ type: 'played', round: s.round, card });
    // Your cards in the order of a boarding action scale; hers don't chain.
    // A card that does nothing at this range is no link: it breaks the chain.
    const mine = card.side === 'ship' && !card.damage;
    const type = cardType(card);
    const works = card.effects.some((e) => reaches(s, e));
    const links = mine && works ? linksFor(s.chain, type) : 0;
    if (mine) {
      if (links) s.events.push({ type: 'chain', round: s.round, card, links });
      s.chain = works ? chained(s.chain, type) : type === 'hands' ? s.chain : NO_CHAIN;
    }
    for (const effect of card.effects) {
      let away: Outcome | null;
      [s, away] = applyEffect(s, card, links && SCALES.includes(effect.kind) && 'amount' in effect ? ({ ...effect, amount: effect.amount + links } as Effect) : effect);
      const outcome = away ?? settled(s);
      if (outcome) {
        spend(s, card);
        return end(s, outcome);
      }
    }
    spend(s, card);
  }

  return deal(s);
}

/** A played card, spent: to its side's discard. */
function spend(s: EncounterState, card: Card) {
  (card.side === 'ship' ? s.discard : s.herDiscard).push(card);
}

const reaches = (s: EncounterState, e: Effect) => !e.at || e.at.includes(REACHES[s.range] as Reach);

function applyEffect(s: EncounterState, card: Card, effect: Effect): [EncounterState, Outcome | null] {
  let applied = 0;
  let note: EffectNote | undefined;
  let away: Outcome | null = null;
  const mine = card.side === 'ship';
  if (!reaches(s, effect)) {
    s.events.push({ type: 'effect', round: s.round, card, effect, applied: 0, note: 'range' });
    return [s, null];
  }
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
      // Bearing away: the range opens. Not with the sails shot away; a town can't, and can't be left by its own boats' oars past far.
      if (rigged(s, card.side)) {
        note = 'rigging';
        break;
      }
      if (!mine && s.target.fixed) {
        note = 'fixed';
        break;
      }
      const to = s.range + effect.amount;
      if (to > FAR) {
        applied = FAR - s.range + 1;
        away = mine ? 'fled' : 'escaped';
        break;
      }
      applied = to - s.range;
      setRange(s, to as Range);
      break;
    }
    case 'chase':
    case 'hold': {
      // The range closes: run down, or grappled.
      const to = Math.max(GRAPPLED, s.range - effect.amount) as Range;
      applied = s.range - to;
      if (applied) setRange(s, to);
      break;
    }
    case 'interrogate':
      applied = 1;
      s.intel.push(effect.reliability);
      break;
    case 'recall': {
      // The side's own spent cards, most recent first, back under its deck.
      const [spent, deck] = mine ? [s.discard, s.deck] : [s.herDiscard, s.herDeck];
      for (let i = spent.length - 1; i >= 0 && applied < effect.amount; i--) {
        if (spent[i].damage) continue;
        deck.push(spent.splice(i, 1)[0]);
        applied++;
      }
      break;
    }
  }
  s.events.push({ type: 'effect', round: s.round, card, effect, applied, ...(note ? { note } : {}) });
  return [s, away];
}

function setRange(s: EncounterState, to: Range) {
  s.range = to;
  s.events.push({ type: 'range', round: s.round, range: to });
}

/** A wound against `side`, on top of its deck: in your next hand, or her next intent. */
function wound(s: EncounterState, side: Side, what: Wound): void {
  s.minted += 1;
  const card = woundCard(side, `${what}-${side}#${s.minted}`, what);
  (side === 'ship' ? s.deck : s.herDeck).unshift(card);
}

/** Shot-away sails still against a side, in its deck, hand or intent: it can't open the range. */
const rigged = (s: EncounterState, side: Side) =>
  (side === 'ship' ? [...s.deck, ...s.hand] : [...s.herDeck, ...(s.intent ? [s.intent] : [])]).some((c) => c.side === side && c.wound === 'sails');

/** Your hull is checked first: if both reach 0 on one effect, you went down. */
function settled(s: EncounterState): Outcome | null {
  if (s.ship.hull <= 0) return 'sunk';
  if (s.target.hull <= 0) return 'destroyed';
  return null;
}

function deal(s: EncounterState): EncounterState {
  // Fight too long and help comes: on top of her deck.
  const r = s.reinforce;
  const round = s.round + 1;
  if (r && s.reinforced < r.count && round >= r.from && (round - r.from) % r.every === 0) {
    s.minted += 1;
    s.reinforced += 1;
    s.herDeck.unshift({ ...r.card, id: `reinforce#${s.minted}` });
  }
  if (s.deck.length < KEEP) return end(s, 'parted');
  s.round = round;
  s.hand = s.deck.slice(0, HAND_SIZE);
  s.deck = s.deck.slice(HAND_SIZE);
  // Her next card, face up. An empty deck is reshuffled from her spent cards.
  if (!s.herDeck.length && s.herDiscard.length) {
    const [again, rng] = shuffle(s.herDiscard.filter((c) => !c.damage), s.rng);
    s.herDeck = again;
    s.herDiscard = [];
    s.rng = rng;
  }
  s.intent = s.herDeck.shift() ?? null;
  s.events.push({ type: 'dealt', round: s.round, cards: s.hand.slice() });
  return s;
}

function end(s: EncounterState, outcome: Outcome): EncounterState {
  s.outcome = outcome;
  s.intent = null;
  if (outcome === 'sunk') s.intel = [];
  const taken = s.target.takenWhole ? s.target.cargo : 0;
  s.payout = outcome === 'sunk' ? 0 : outcome === 'destroyed' ? s.plunder + s.target.bounty + taken : s.plunder;
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
    herDeck: s.herDeck.slice(),
    herDiscard: s.herDiscard.slice(),
    ship: { ...s.ship },
    target: { ...s.target },
    events: s.events.slice(),
    intel: s.intel.slice(),
  };
}
