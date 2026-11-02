/**
 * Who you can meet at sea, and what each brings to a fight: its deck, its
 * hull, what's in its hold, and the price on its head.
 */

import { ARMADA_CARDS, type Card, type CardDef, HUNTER_CARDS, MERCHANT_CARDS, SHIP_CARDS, TREASURE_FLEET_CARDS, TREASURE_SHIP_CARDS, buildDeck } from './cards.ts';
import { type EncounterState, createEncounter } from './rules.ts';
import type { ShipKind } from './world/ships.ts';

export interface TargetDef {
  name: string;
  hull: number;
  cargo: number;
  bounty: number;
  cards: readonly CardDef[];
}

export const TARGETS: Record<ShipKind, TargetDef> = {
  merchant: { name: 'merchant', hull: 12, cargo: 12, bounty: 4, cards: MERCHANT_CARDS },
  hunter: { name: 'guard ship', hull: 12, cargo: 3, bounty: 10, cards: HUNTER_CARDS },
  'treasure-ship': { name: 'galleon', hull: 13, cargo: 30, bounty: 6, cards: TREASURE_SHIP_CARDS },
  'treasure-fleet': { name: 'treasure fleet', hull: 24, cargo: 60, bounty: 10, cards: TREASURE_FLEET_CARDS },
  armada: { name: 'armada', hull: 30, cargo: 4, bounty: 20, cards: ARMADA_CARDS },
};

/** Your ship, as it sails into a fight. */
export const SHIP = { hull: 6, maxHull: 6 };

export function encounterWith(kind: ShipKind, seed: number, ship: { hull: number; maxHull: number } = SHIP, shipCards: Card[] = buildDeck('ship', SHIP_CARDS)): EncounterState {
  const t = TARGETS[kind];
  return createEncounter({
    seed,
    shipCards,
    targetCards: buildDeck('target', t.cards),
    ship: { hull: ship.hull, maxHull: ship.maxHull, brace: 0 },
    target: { name: t.name, hull: t.hull, maxHull: t.hull, cargo: t.cargo, bounty: t.bounty },
  });
}

/** The fight the encounter loop was tuned on. */
export const merchantEncounter = (seed: number) => encounterWith('merchant', seed);
