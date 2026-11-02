/**
 * What you sail with, and so what you fight with. Your deck is never stored:
 * it is worked out from your ship, its upgrades and your crew, so buying,
 * hiring and refitting all change the cards you draw.
 */

import { type Card, type CardDef, SHIP_CARDS, buildDeck } from './cards.ts';

type CardFace = Omit<CardDef, 'copies'>;

/** Every card you can come to hold. The first nine are the pinnace's; the rest come aboard with crew and refits. */
export const PLAYER_CARDS: Record<string, CardFace> = {
  ...Object.fromEntries(SHIP_CARDS.map(({ copies: _, ...face }) => [face.key, face])),
  'double-shot': { key: 'double-shot', name: 'double-shotted guns', text: 'hit 5, hurt 1', effects: [{ kind: 'hit', amount: 5 }, { kind: 'hurt', amount: 1 }] },
  marksmen: { key: 'marksmen', name: 'marksmen in the tops', text: 'hit 1, hold 1', effects: [{ kind: 'hit', amount: 1 }, { kind: 'hold', amount: 1 }] },
  'prize-crew': { key: 'prize-crew', name: 'prize crew', text: 'plunder 3, interrogate', effects: [{ kind: 'plunder', amount: 3 }, { kind: 'interrogate', reliability: 0.8 }] },
  'all-hands': { key: 'all-hands', name: 'all hands', text: 'brace 3', effects: [{ kind: 'brace', amount: 3 }] },
  'surgeons-mate': { key: 'surgeons-mate', name: "surgeon's mate", text: 'repair 1, brace 1', effects: [{ kind: 'repair', amount: 1 }, { kind: 'brace', amount: 1 }] },
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
  pinnace: { name: 'pinnace', cost: 0, hull: 10, berths: 2, cards: {} },
  sloop: { name: 'sloop', cost: 40, hull: 12, berths: 3, cards: { 'raking-fire': 1 } },
  brigantine: { name: 'brigantine', cost: 90, hull: 14, berths: 4, cards: { broadside: 1, 'raking-fire': 1 } },
  frigate: { name: 'frigate', cost: 180, hull: 18, berths: 6, cards: { broadside: 2, 'chain-shot': 1 } },
};

export interface CrewRole {
  name: string;
  cost: number;
  cards: Cards;
  /** Steps of sight it adds: how far out you see current and wind. */
  sight?: number;
}

/** Hired in the bar: one of each. */
export const CREW: Record<string, CrewRole> = {
  gunner: { name: 'master gunner', cost: 12, cards: { 'double-shot': 1 } },
  marksmen: { name: 'marksmen', cost: 10, cards: { marksmen: 2 } },
  quartermaster: { name: 'quartermaster', cost: 10, cards: { 'prize-crew': 1 } },
  boatswain: { name: 'boatswain', cost: 8, cards: { 'all-hands': 1 } },
  surgeon: { name: 'surgeon', cost: 10, cards: { 'surgeons-mate': 1 } },
  pilot: { name: 'pilot', cost: 12, cards: { 'bear-away': 1 } },
  navigator: { name: 'navigator', cost: 15, cards: {}, sight: 1 },
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
};

export interface Outfit {
  ship: string;
  upgrades: string[];
  crew: string[];
}

export const START_OUTFIT: Outfit = { ship: 'pinnace', upgrades: [], crew: [] };

const add = (into: Cards, more: Cards = {}) => {
  for (const [k, n] of Object.entries(more)) into[k] = (into[k] ?? 0) + n;
  return into;
};

/** The cards an outfit fights with, by key and count. */
export function cardsOf(o: Outfit): Cards {
  const cards = add({ ...BASE }, SHIP_CLASSES[o.ship].cards);
  for (const u of o.upgrades) add(cards, UPGRADES[u].cards);
  for (const c of o.crew) add(cards, CREW[c].cards);
  return cards;
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
