/**
 * Who you can meet at sea, and what each brings to a fight: its deck, its
 * hull, what's in its hold, and the price on its head.
 */

import { ARMADA_CARDS, type Card, type CardDef, CANOE_CARDS, FORTRESS_CARDS, HUNTER_CARDS, MERCHANT_CARDS, MONSTER_CARDS, PRIVATEER_CARDS, RAID_CARDS, RELIEF, SHIP_CARDS, TOWN_CARDS, TREASURE_FLEET_CARDS, TREASURE_SHIP_CARDS, buildDeck } from './cards.ts';
import { type EncounterState, type Reinforcement, createEncounter } from './rules.ts';
import type { ShipKind } from './world/ships.ts';

export interface TargetDef {
  name: string;
  hull: number;
  cargo: number;
  bounty: number;
  cards: readonly CardDef[];
  /** A town: taken whole, the rest of its treasury is yours. */
  takenWhole?: boolean;
  /** Help that comes if the fight goes on. */
  reinforce?: Reinforcement;
  /** Cards that go into your deck for this fight: a raid's way back to the boats. */
  yours?: readonly CardDef[];
}

/** What you can fight: a ship of any kind, or a port — open or fortified. */
export type TargetKind = ShipKind | 'town' | 'fortress' | 'canoes';

/** A raid that runs past the sixth round brings the garrison's relief: a card every other round, four in all. */
export const RELIEF_FROM = 7;
export const RELIEF_EVERY = 2;
export const RELIEF_COUNT = 4;

export const TARGETS: Record<TargetKind, TargetDef> = {
  merchant: { name: 'merchant', hull: 12, cargo: 12, bounty: 4, cards: MERCHANT_CARDS },
  monster: { name: 'sea monster', hull: 18, cargo: 0, bounty: 25, cards: MONSTER_CARDS },
  canoes: { name: 'war canoes', hull: 10, cargo: 4, bounty: 0, cards: CANOE_CARDS },
  privateer: { name: 'privateer', hull: 12, cargo: 8, bounty: 6, cards: PRIVATEER_CARDS },
  corsair: { name: 'corsair', hull: 12, cargo: 6, bounty: 6, cards: PRIVATEER_CARDS },
  hunter: { name: 'guard ship', hull: 14, cargo: 3, bounty: 10, cards: HUNTER_CARDS },
  'treasure-ship': { name: 'galleon', hull: 13, cargo: 30, bounty: 6, cards: TREASURE_SHIP_CARDS },
  'treasure-fleet': { name: 'treasure fleet', hull: 24, cargo: 60, bounty: 10, cards: TREASURE_FLEET_CARDS },
  armada: { name: 'armada', hull: 30, cargo: 4, bounty: 20, cards: ARMADA_CARDS },
  town: { name: 'town', hull: 12, cargo: 25, bounty: 0, cards: TOWN_CARDS, takenWhole: true, reinforce: { from: RELIEF_FROM, every: RELIEF_EVERY, count: RELIEF_COUNT, card: RELIEF }, yours: RAID_CARDS },
  fortress: { name: 'fortified port', hull: 22, cargo: 45, bounty: 0, cards: FORTRESS_CARDS, takenWhole: true, reinforce: { from: RELIEF_FROM, every: RELIEF_EVERY, count: RELIEF_COUNT, card: RELIEF }, yours: RAID_CARDS },
};

/** Your ship, as it sails into a fight. */
export const SHIP = { hull: 10, maxHull: 10 };

/** More than the usual: a veteran crew's hull, a laden hold. */
export interface Extra {
  hull?: number;
  cargo?: number;
  /** A town on its guard: its relief starts coming this many rounds sooner. */
  reliefSooner?: number;
}

export function encounterWith(kind: TargetKind, seed: number, ship: { hull: number; maxHull: number } = SHIP, shipCards: Card[] = buildDeck('ship', SHIP_CARDS), extra: Extra = {}): EncounterState {
  const base = TARGETS[kind];
  const t = { ...base, hull: base.hull + (extra.hull ?? 0), cargo: base.cargo + (extra.cargo ?? 0) };
  return createEncounter({
    seed,
    shipCards: [...shipCards, ...buildDeck('ship', t.yours ?? [])],
    targetCards: buildDeck('target', t.cards),
    ship: { hull: ship.hull, maxHull: ship.maxHull, brace: 0 },
    target: { name: t.name, hull: t.hull, maxHull: t.hull, cargo: t.cargo, bounty: t.bounty, takenWhole: t.takenWhole },
    reinforce: t.reinforce && extra.reliefSooner ? { ...t.reinforce, from: Math.max(2, t.reinforce.from - extra.reliefSooner) } : t.reinforce,
  });
}

/** The fight the encounter loop was tuned on. */
export const merchantEncounter = (seed: number) => encounterWith('merchant', seed);
