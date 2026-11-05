/**
 * Who you can meet at sea, and what each brings to a fight: its deck, its
 * hull, what's in its hold, and the price on its head.
 */

import { ARMADA_CARDS, type Card, type CardDef, CANOE_CARDS, FORTRESS_CARDS, HUNTER_CARDS, MERCHANT_CARDS, MONSTER_CARDS, PRIVATEER_CARDS, RAID_CARDS, RELIEF, SHIP_CARDS, TOWN_CARDS, TREASURE_FLEET_CARDS, TREASURE_SHIP_CARDS, buildDeck } from './cards.ts';
import { type EncounterState, type Reinforcement, createEncounter, type Range, START_RANGE } from './rules.ts';
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

/** A raid that runs into its fourth round brings the garrison's relief: a card a round, three in all. */
export const RELIEF_FROM = 4;
export const RELIEF_EVERY = 1;
export const RELIEF_COUNT = 3;

export const TARGETS: Record<TargetKind, TargetDef> = {
  merchant: { name: 'merchant', hull: 11, cargo: 12, bounty: 4, cards: MERCHANT_CARDS },
  monster: { name: 'sea monster', hull: 16, cargo: 0, bounty: 25, cards: MONSTER_CARDS },
  canoes: { name: 'war canoes', hull: 8, cargo: 4, bounty: 0, cards: CANOE_CARDS },
  privateer: { name: 'privateer', hull: 11, cargo: 8, bounty: 6, cards: PRIVATEER_CARDS },
  corsair: { name: 'corsair', hull: 11, cargo: 6, bounty: 6, cards: PRIVATEER_CARDS },
  hunter: { name: 'guard ship', hull: 14, cargo: 3, bounty: 10, cards: HUNTER_CARDS },
  'treasure-ship': { name: 'galleon', hull: 13, cargo: 30, bounty: 6, cards: TREASURE_SHIP_CARDS },
  'treasure-fleet': { name: 'treasure fleet', hull: 22, cargo: 60, bounty: 10, cards: TREASURE_FLEET_CARDS },
  armada: { name: 'armada', hull: 26, cargo: 4, bounty: 20, cards: ARMADA_CARDS },
  town: { name: 'town', hull: 12, cargo: 25, bounty: 0, cards: TOWN_CARDS, takenWhole: true, reinforce: { from: RELIEF_FROM, every: RELIEF_EVERY, count: RELIEF_COUNT, card: RELIEF }, yours: RAID_CARDS },
  fortress: { name: 'fortified port', hull: 20, cargo: 45, bounty: 0, cards: FORTRESS_CARDS, takenWhole: true, reinforce: { from: RELIEF_FROM, every: RELIEF_EVERY, count: RELIEF_COUNT, card: RELIEF }, yours: RAID_CARDS },
};

/** Your ship, as it sails into a fight. */
export const SHIP = { hull: 10, maxHull: 10 };

/** More than the usual: a veteran crew's hull, a laden hold. */
export interface Extra {
  hull?: number;
  cargo?: number;
  /** A town on its guard: its relief starts coming this many rounds sooner. */
  reliefSooner?: number;
  /** Beaten, she strikes rather than sinks, and her whole hold is yours: the treasure ship. She can still run. */
  takenWhole?: boolean;
}

/**
 * A fight with `kind`. `range` is where it starts: close when you fire
 * first, within hail; far when she comes at you, bearing down, which gives
 * you one chance to bear away before she closes.
 */
export function encounterWith(kind: TargetKind, seed: number, ship: { hull: number; maxHull: number } = SHIP, shipCards: Card[] = buildDeck('ship', SHIP_CARDS), extra: Extra = {}, range: Range = START_RANGE): EncounterState {
  const base = TARGETS[kind];
  const t = { ...base, hull: base.hull + (extra.hull ?? 0), cargo: base.cargo + (extra.cargo ?? 0) };
  return createEncounter({
    seed,
    shipCards: [...shipCards, ...buildDeck('ship', t.yours ?? [])],
    targetCards: buildDeck('target', t.cards),
    ship: { hull: ship.hull, maxHull: ship.maxHull, brace: 0 },
    // A town is taken whole, and it can't move.
    target: { name: t.name, hull: t.hull, maxHull: t.hull, cargo: t.cargo, bounty: t.bounty, ...(t.takenWhole ? { takenWhole: true, fixed: true } : extra.takenWhole ? { takenWhole: true } : {}) },
    // A town lies where it lies: always close, the boats offshore.
    range: t.takenWhole ? START_RANGE : range,
    reinforce: t.reinforce && extra.reliefSooner ? { ...t.reinforce, from: Math.max(2, t.reinforce.from - extra.reliefSooner) } : t.reinforce,
  });
}

/** The fight the encounter loop was tuned on. */
export const merchantEncounter = (seed: number) => encounterWith('merchant', seed);
