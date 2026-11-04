/**
 * What you sail with, and so what you fight with. Your deck is never stored:
 * it is worked out from your ship, its upgrades and your crew, so buying,
 * hiring and refitting all change the cards you draw.
 */

import { type Card, type CardDef, type Effect, type Reach, SHIP_CARDS, buildDeck, cardText } from './cards.ts';

type CardFace = Omit<CardDef, 'copies'> & { text: string };

const near = ['close', 'grappled'] as Reach[];
const face = (key: string, name: string, effects: Effect[]): CardFace => ({ key, name, effects, text: cardText(effects) });

/** Every card you can come to hold: the pinnace's, then what comes aboard with crew, refits and prizes. Their text is written from their effects. */
export const PLAYER_CARDS: Record<string, CardFace> = {
  ...Object.fromEntries(SHIP_CARDS.map(({ copies: _, ...f }) => [f.key, { ...f, text: f.text ?? cardText(f.effects) }])),
  'double-shot': face('double-shot', 'double-shotted guns', [{ kind: 'hit', amount: 4, at: near }, { kind: 'hurt', amount: 1 }]),
  marksmen: face('marksmen', 'marksmen in the tops', [{ kind: 'hit', amount: 1, at: ['far'] }, { kind: 'hit', amount: 2, at: near }]),
  'prize-crew': face('prize-crew', 'prize crew', [{ kind: 'plunder', amount: 4, at: ['grappled'] }, { kind: 'interrogate', reliability: 0.8, at: ['grappled'] }]),
  'all-hands': face('all-hands', 'all hands', [{ kind: 'brace', amount: 3 }, { kind: 'recall', amount: 1 }]),
  'surgeons-mate': face('surgeons-mate', "surgeon's mate", [{ kind: 'repair', amount: 1 }, { kind: 'brace', amount: 1 }, { kind: 'recall', amount: 1 }]),
  reload: face('reload', 'run out the guns again', [{ kind: 'recall', amount: 2 }]),
  drilled: face('drilled', 'drilled crews', [{ kind: 'hit', amount: 1 }, { kind: 'recall', amount: 1 }]),

  // Prizes: what you can take off a ship you've taken, one card a prize.
  // Three ways to fight run through them — the guns (hit and wounds), the
  // boarders (close, grapple, plunder), and the runner (open the range and
  // go) — and most pay for what they give.
  'spare-canvas': face('spare-canvas', 'her spare canvas', [{ kind: 'repair', amount: 1 }, { kind: 'flee', amount: 1 }]),
  'her-pilot': face('her-pilot', 'her pilot, pressed', [{ kind: 'flee', amount: 1 }, { kind: 'interrogate', reliability: 0.8 }]),
  'stern-chasers': face('stern-chasers', 'her stern chasers', [{ kind: 'hit', amount: 2, at: ['far'] }, { kind: 'flee', amount: 1, at: ['far'] }]),
  grapnels: face('grapnels', 'her grapnels', [{ kind: 'hold', amount: 1, at: ['close'] }, { kind: 'plunder', amount: 2, at: ['grappled'] }]),
  pikes: face('pikes', 'boarding pikes', [{ kind: 'plunder', amount: 5, at: ['grappled'] }, { kind: 'hurt', amount: 2, at: ['grappled'] }]),
  'chain-and-bar': face('chain-and-bar', 'chain and bar', [{ kind: 'hit', amount: 1, at: ['far', 'close'] }, { kind: 'wound', what: 'sails', at: ['far', 'close'] }]),
  'long-guns': face('long-guns', 'her long guns', [{ kind: 'hit', amount: 3, at: ['far'] }, { kind: 'hit', amount: 1, at: ['close'] }]),
  'great-guns': face('great-guns', 'a Spanish great gun', [{ kind: 'hit', amount: 5, at: near }, { kind: 'wound', what: 'leak', at: near }, { kind: 'hurt', amount: 1 }]),
  'her-carpenters': face('her-carpenters', 'her carpenters', [{ kind: 'repair', amount: 3 }]),
  sweeps: face('sweeps', 'galley sweeps', [{ kind: 'chase', amount: 2 }]),
  renegades: face('renegades', 'renegades who know the trade', [{ kind: 'hold', amount: 1, at: ['close'] }, { kind: 'plunder', amount: 3, at: ['grappled'] }, { kind: 'recall', amount: 1 }]),
  'town-guns': face('town-guns', 'guns off the walls', [{ kind: 'hit', amount: 3, at: near }, { kind: 'hurt', amount: 1 }]),
  powder: face('powder', 'powder from the magazine', [{ kind: 'hit', amount: 2 }, { kind: 'wound', what: 'fire', at: ['close'] }]),
  'island-guides': face('island-guides', 'island guides', [{ kind: 'chase', amount: 1 }, { kind: 'recall', amount: 1 }]),
  whalebone: face('whalebone', 'its bones for knees and timbers', [{ kind: 'brace', amount: 3 }, { kind: 'repair', amount: 1 }]),
};

/**
 * What you might take off each kind of prize: three are offered, one kept.
 * A guard ship gives up her guns and grapnels, a merchant her canvas and her
 * pilot, a galleon a great gun or her carpenters.
 */
export const PRIZE_CARDS: Partial<Record<string, string[]>> = {
  merchant: ['spare-canvas', 'her-pilot', 'stern-chasers', 'her-carpenters'],
  hunter: ['long-guns', 'chain-and-bar', 'grapnels', 'pikes'],
  privateer: ['grapnels', 'pikes', 'stern-chasers', 'chain-and-bar'],
  corsair: ['sweeps', 'renegades', 'pikes', 'grapnels'],
  'treasure-ship': ['great-guns', 'her-carpenters', 'spare-canvas', 'her-pilot'],
  'treasure-fleet': ['great-guns', 'her-carpenters', 'long-guns', 'pikes'],
  armada: ['great-guns', 'long-guns', 'chain-and-bar'],
  town: ['town-guns', 'powder', 'her-pilot'],
  fortress: ['town-guns', 'powder', 'great-guns'],
  canoes: ['island-guides', 'spare-canvas', 'her-pilot'],
  monster: ['whalebone', 'island-guides', 'her-carpenters'],
};

/** Cards by key and count. */
export type Cards = Record<string, number>;

const BASE: Cards = Object.fromEntries(SHIP_CARDS.map((c) => [c.key, c.copies]));

export interface ShipClass {
  name: string;
  cost: number;
  hull: number;
  /** Berths for crew of note: the hands you hire for what they bring. */
  berths: number;
  /** Cards on top of the pinnace's. */
  cards: Cards;
}

export const SHIP_CLASSES: Record<string, ShipClass> = {
  pinnace: { name: 'pinnace', cost: 0, hull: 12, berths: 2, cards: {} },
  sloop: { name: 'sloop', cost: 40, hull: 14, berths: 3, cards: { 'raking-fire': 1 } },
  brigantine: { name: 'brigantine', cost: 90, hull: 17, berths: 4, cards: { broadside: 1, 'raking-fire': 1 } },
  frigate: { name: 'frigate', cost: 180, hull: 22, berths: 6, cards: { broadside: 2, 'chain-shot': 1 } },
};

export interface CrewRole {
  name: string;
  cost: number;
  /** Paid every WAGE_DAYS from the purse. Unpaid, the crew sour. */
  wage: number;
  cards: Cards;
  /** Steps of sight it adds: how far out you see current and wind. */
  sight?: number;
}

/** Hired in the bar: one of each. */
export const CREW: Record<string, CrewRole> = {
  gunner: { name: 'master gunner', cost: 12, wage: 2, cards: { 'double-shot': 1, reload: 1 } },
  marksmen: { name: 'marksmen', cost: 10, wage: 1, cards: { marksmen: 2 } },
  quartermaster: { name: 'quartermaster', cost: 10, wage: 1, cards: { 'prize-crew': 1 } },
  boatswain: { name: 'boatswain', cost: 8, wage: 1, cards: { 'all-hands': 1 } },
  surgeon: { name: 'surgeon', cost: 10, wage: 1, cards: { 'surgeons-mate': 1 } },
  pilot: { name: 'pilot', cost: 12, wage: 1, cards: { 'bear-away': 1 } },
  navigator: { name: 'navigator', cost: 15, wage: 2, cards: {}, sight: 1 },
};

export interface Upgrade {
  name: string;
  cost: number;
  cards?: Cards;
  hull?: number;
  /** How many times it can be fitted to one ship. */
  max: number;
}

/** Fitted at a shipyard, to the ship you have; a new ship starts bare. */
export const UPGRADES: Record<string, Upgrade> = {
  guns: { name: 'more guns', cost: 15, cards: { 'raking-fire': 1 }, max: 2 },
  sheathing: { name: 'sheathed hull', cost: 20, hull: 2, max: 1 },
  nets: { name: 'boarding nets', cost: 10, cards: { brace: 1 }, max: 1 },
  chasers: { name: 'chase guns', cost: 12, cards: { swivel: 1 }, max: 1 },
  drill: { name: 'gun drill', cost: 15, cards: { drilled: 1 }, max: 1 },
};

export interface Outfit {
  ship: string;
  upgrades: string[];
  crew: string[];
  /** Cards taken off prizes, one a prize. They come with you to a new ship. */
  prizes: string[];
  /** Cards struck out of the deck at a yard, a copy each. */
  struck: string[];
}

export const START_OUTFIT: Outfit = { ship: 'pinnace', upgrades: [], crew: [], prizes: [], struck: [] };

/** Every this many days, the hands of note are paid. */
export const WAGE_DAYS = 60;
export const wagesOf = (o: Outfit) => o.crew.reduce((t, c) => t + CREW[c].wage, 0);
/** What it costs at a yard to strike a card from the deck, and the fewest cards a deck may come down to. */
export const STRIKE_COST = 6;
export const MIN_DECK = 10;

const add = (into: Cards, more: Cards = {}) => {
  for (const [k, n] of Object.entries(more)) into[k] = (into[k] ?? 0) + n;
  return into;
};

/** The cards an outfit fights with, by key and count. */
export function cardsOf(o: Outfit): Cards {
  const cards = add({ ...BASE }, SHIP_CLASSES[o.ship].cards);
  for (const u of o.upgrades) add(cards, UPGRADES[u].cards);
  for (const c of o.crew) add(cards, CREW[c].cards);
  for (const p of o.prizes ?? []) add(cards, { [p]: 1 });
  for (const k of o.struck ?? []) if (cards[k]) cards[k] -= 1;
  return Object.fromEntries(Object.entries(cards).filter(([, n]) => n > 0));
}

/** The deck itself, ready to shuffle into an encounter. */
export function deckOf(o: Outfit): Card[] {
  const cards = cardsOf(o);
  return buildDeck(
    'ship',
    Object.entries(cards).map(([key, copies]) => ({ ...PLAYER_CARDS[key], copies })),
  );
}

export const maxHullOf = (o: Outfit) => SHIP_CLASSES[o.ship].hull + o.upgrades.reduce((t, u) => t + (UPGRADES[u].hull ?? 0), 0);
export const sightOf = (o: Outfit) => 1 + o.crew.reduce((t, c) => t + (CREW[c].sight ?? 0), 0);

export const deckSize = (o: Outfit) => Object.values(cardsOf(o)).reduce((a, b) => a + b, 0);

/** Where the deck's cards come from, a group each: the ship, each refit, each hand, the prizes. For showing, not for dealing. */
export interface DeckSource {
  label: string;
  /** What kind of source, for grouping: the ship and its refits, the crew, prizes. */
  kind: 'ship' | 'refit' | 'crew' | 'prize';
  cards: Cards;
}

export function deckSources(o: Outfit): DeckSource[] {
  const ship = add({ ...BASE }, SHIP_CLASSES[o.ship].cards);
  const sources: DeckSource[] = [{ label: `the ${SHIP_CLASSES[o.ship].name}`, kind: 'ship', cards: ship }];
  for (const u of o.upgrades) if (UPGRADES[u].cards) sources.push({ label: UPGRADES[u].name, kind: 'refit', cards: { ...UPGRADES[u].cards } });
  for (const c of o.crew) if (Object.keys(CREW[c].cards).length) sources.push({ label: `the ${CREW[c].name}`, kind: 'crew', cards: { ...CREW[c].cards } });
  if (o.prizes.length) sources.push({ label: 'taken off prizes', kind: 'prize', cards: add({}, Object.fromEntries(Object.entries(o.prizes.reduce((t, k) => ((t[k] = (t[k] ?? 0) + 1), t), {} as Cards)))) });
  return sources;
}

/** Cards, as words: `double-shotted guns, run out the guns again ×2`. */
export const cardWords = (cards: Cards = {}) =>
  Object.entries(cards)
    .map(([k, n]) => `${PLAYER_CARDS[k].name}${n > 1 ? ` ×${n}` : ''}`)
    .join(', ');
