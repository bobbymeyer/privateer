/**
 * The ship you sail in, chosen at Plymouth before anything else, as the
 * trail's banker, carpenter or farmer is: it sets your purse, your hold,
 * your hands, your deck, and what the voyage is worth at the end. A small
 * ship comes with more money and counts for more; a big one is easier.
 */

import { type Card, type CardDef, SHIP_CARDS, buildDeck, cardText } from './cards.ts';

type CardFace = Omit<CardDef, 'copies'> & { text: string };

/** Every card a ship of yours can hold, by key, with its words written from its effects. */
export const PLAYER_CARDS: Record<string, CardFace> = Object.fromEntries(SHIP_CARDS.map(({ copies: _, ...f }) => [f.key, { ...f, text: f.text ?? cardText(f.effects) }]));

/** Cards by key and count. */
export type Cards = Record<string, number>;

const BASE: Cards = Object.fromEntries(SHIP_CARDS.map((c) => [c.key, c.copies]));

export interface ShipClass {
  name: string;
  hull: number;
  /** The hands she takes to sail and fight her properly. */
  complement: number;
  /** Cards on top of the pinnace's. */
  cards: Cards;
  /** The money you fit out with. */
  purse: number;
  /** What the voyage's score is multiplied by. */
  multiplier: number;
  /** What she is, in a line. */
  text: string;
}

export const SHIP_CLASSES: Record<string, ShipClass> = {
  pinnace: {
    name: 'pinnace', hull: 12, complement: 30, cards: {}, purse: 120, multiplier: 2,
    text: 'small, quick and cheap to keep: money in hand for stores, a light deck, and twice the score',
  },
  sloop: {
    name: 'sloop', hull: 14, complement: 45, cards: { 'raking-fire': 1 }, purse: 70, multiplier: 1.5,
    text: 'between the two: a gun more than a pinnace, a bigger hold, half again the score',
  },
  brigantine: {
    name: 'brigantine', hull: 17, complement: 70, cards: { broadside: 1, 'raking-fire': 1 }, purse: 30, multiplier: 1,
    text: 'stout, well gunned, a deep hold, and a big crew to feed: little left in the purse, the score as it stands',
  },
};

export const SHIPS = Object.keys(SHIP_CLASSES);

/** The cards a ship fights with, by key and count. */
export function cardsOf(ship: string): Cards {
  const cards = { ...BASE };
  for (const [k, n] of Object.entries(SHIP_CLASSES[ship].cards)) cards[k] = (cards[k] ?? 0) + n;
  return cards;
}

/** The deck itself, ready to shuffle into an encounter. */
export const deckOf = (ship: string): Card[] =>
  buildDeck(
    'ship',
    Object.entries(cardsOf(ship)).map(([key, copies]) => ({ ...PLAYER_CARDS[key], copies })),
  );

export const deckSize = (ship: string) => Object.values(cardsOf(ship)).reduce((a, b) => a + b, 0);

/** Cards, as words: `broadside ×2, raking fire`. */
export const cardWords = (cards: Cards = {}) =>
  Object.entries(cards)
    .map(([k, n]) => `${PLAYER_CARDS[k].name}${n > 1 ? ` ×${n}` : ''}`)
    .join(', ');
