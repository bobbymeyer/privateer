/**
 * What a card is, and the placeholder decks for the first slice.
 *
 * The rules only read `effects`; `name` and `text` are for whoever is drawing
 * the card. Effects resolve in the order they are listed.
 */

export type Side = 'ship' | 'target';

export type Effect =
  /**
   * Puts this many damage cards against the target on top of the deck. Shot
   * does not touch the hull directly: it lands when a damage card is kept.
   */
  | { kind: 'hit'; amount: number }
  /** Puts this many damage cards against you on top of the deck. */
  | { kind: 'hurt'; amount: number }
  /**
   * The card's own side loses this much hull — less any brace, for you. This
   * is what a damage card does when it is kept.
   */
  | { kind: 'breach'; amount: number }
  /** Cargo moved from the target's hold to yours. Capped by what is left. */
  | { kind: 'plunder'; amount: number }
  /** Hull back on your ship, up to its maximum. */
  | { kind: 'repair'; amount: number }
  /** Soaks up the next points of `hurt`. Lasts until it is used. */
  | { kind: 'brace'; amount: number }
  /** The target throws cargo overboard: gone for both of you. */
  | { kind: 'jettison'; amount: number }
  /** Hull back on the target, up to its maximum. */
  | { kind: 'mend'; amount: number }
  /**
   * The card's own side breaks away and the encounter ends — but only when
   * that side is threatened (hull at half or less) and not held. Otherwise it
   * does nothing: a ship that is not in danger does not run.
   */
  | { kind: 'flee' }
  /** Cancels the other side's next flee. Stacks; lasts until used. */
  | { kind: 'hold'; amount: number }
  /**
   * Prisoners talk: a rumor of this reliability, carried out of the fight
   * and turned into a sighting on the map. Lost if you are sunk.
   */
  | { kind: 'interrogate'; reliability: number };

export interface Card {
  /** Unique within an encounter: `broadside#2`. */
  id: string;
  side: Side;
  name: string;
  text: string;
  effects: Effect[];
  /** Set on the damage cards that shot makes. */
  damage?: true;
}

export interface CardDef {
  key: string;
  name: string;
  text: string;
  effects: Effect[];
  copies: number;
}

/**
 * One point of damage, sitting in the deck against `side` until somebody
 * keeps it. One can be rejected per hand; two in a hand and one has to be
 * taken.
 */
export function damageCard(side: Side, id: string): Card {
  const name = side === 'ship' ? 'damage to you' : 'damage to them';
  const text = side === 'ship' ? 'you lose 1 hull' : 'they lose 1 hull';
  return { id, side, name, text, effects: [{ kind: 'breach', amount: 1 }], damage: true };
}

/** Expand definitions into individual cards with unique ids. */
export function buildDeck(side: Side, defs: readonly CardDef[]): Card[] {
  const cards: Card[] = [];
  for (const def of defs) {
    for (let n = 1; n <= def.copies; n++) {
      cards.push({ id: `${def.key}#${n}`, side, name: def.name, text: def.text, effects: def.effects });
    }
  }
  return cards;
}

// Placeholder content. The numbers are what the simulator is for.

export const SHIP_CARDS: readonly CardDef[] = [
  { key: 'broadside', name: 'broadside', text: 'hit 4', effects: [{ kind: 'hit', amount: 4 }], copies: 2 },
  { key: 'raking-fire', name: 'raking fire', text: 'hit 2', effects: [{ kind: 'hit', amount: 2 }], copies: 2 },
  { key: 'sweep', name: 'sweep the hold', text: 'plunder 3', effects: [{ kind: 'plunder', amount: 3 }], copies: 2 },
  { key: 'boarding', name: 'boarding party', text: 'plunder 4, hurt 1, interrogate', effects: [{ kind: 'plunder', amount: 4 }, { kind: 'hurt', amount: 1 }, { kind: 'interrogate', reliability: 0.7 }], copies: 1 },
  { key: 'chain-shot', name: 'chain shot', text: 'hit 1, hold 1', effects: [{ kind: 'hit', amount: 1 }, { kind: 'hold', amount: 1 }], copies: 1 },
  { key: 'swivel', name: 'swivel guns', text: 'hit 1, plunder 1', effects: [{ kind: 'hit', amount: 1 }, { kind: 'plunder', amount: 1 }], copies: 1 },
  { key: 'patch', name: 'patch the hull', text: 'repair 2', effects: [{ kind: 'repair', amount: 2 }], copies: 1 },
  { key: 'brace', name: 'brace', text: 'brace 2', effects: [{ kind: 'brace', amount: 2 }], copies: 1 },
  { key: 'bear-away', name: 'bear away', text: 'flee', effects: [{ kind: 'flee' }], copies: 2 },
];

export const MERCHANT_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'stern-chasers', name: 'stern chasers', text: 'hurt 1', effects: [{ kind: 'hurt', amount: 1 }], copies: 2 },
  { key: 'grapeshot', name: 'grapeshot', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 1 },
  { key: 'jettison', name: 'jettison cargo', text: 'jettison 3', effects: [{ kind: 'jettison', amount: 3 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 1 },
  { key: 'strike', name: 'strike colours', text: 'plunder 3, interrogate', effects: [{ kind: 'plunder', amount: 3 }, { kind: 'interrogate', reliability: 0.9 }], copies: 1 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee', effects: [{ kind: 'flee' }], copies: 3 },
];

// First decks for the rest of the sea. Placeholders, like the merchant's
// were; `npm run sim -- --target <kind>` is how they get tuned.

/** A guard ship: hard to shake (it grapples), little to take, a price on its head. */
export const HUNTER_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 5 },
  { key: 'grapeshot', name: 'grapeshot', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 3 },
  { key: 'grapnels', name: 'grapnels', text: 'hurt 1, hold 1', effects: [{ kind: 'hurt', amount: 1 }, { kind: 'hold', amount: 1 }], copies: 2 },
  { key: 'boarders', name: 'boarders away', text: 'hurt 2, hold 1', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'hold', amount: 1 }], copies: 1 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 1 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee', effects: [{ kind: 'flee' }], copies: 1 },
];

/** A lone galleon: heavy guns, slow to answer, a hold full of silver, and she runs. */
export const TREASURE_SHIP_CARDS: readonly CardDef[] = [
  { key: 'great-guns', name: 'great guns', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 2 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 2 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee', effects: [{ kind: 'flee' }], copies: 3 },
  { key: 'strike', name: 'strike colours', text: 'plunder 4, interrogate', effects: [{ kind: 'plunder', amount: 4 }, { kind: 'interrogate', reliability: 0.9 }], copies: 1 },
];

/** A convoy under escort: it doesn't run, it closes ranks, and a straggler is the chance. */
export const TREASURE_FLEET_CARDS: readonly CardDef[] = [
  { key: 'escort-broadside', name: "escort's broadside", text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 4 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'cut-off', name: 'cut off', text: 'hold 1', effects: [{ kind: 'hold', amount: 1 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 3', effects: [{ kind: 'mend', amount: 3 }], copies: 2 },
  { key: 'straggler', name: 'a straggler', text: 'plunder 5, interrogate', effects: [{ kind: 'plunder', amount: 5 }, { kind: 'interrogate', reliability: 0.8 }], copies: 2 },
];

/** A squadron of the line: nothing to take, everything to lose. Run. */
export const ARMADA_CARDS: readonly CardDef[] = [
  { key: 'broadside', name: 'broadside', text: 'hurt 4', effects: [{ kind: 'hurt', amount: 4 }], copies: 4 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'weather-gauge', name: 'the weather gauge', text: 'hold 1', effects: [{ kind: 'hold', amount: 1 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 3', effects: [{ kind: 'mend', amount: 3 }], copies: 2 },
];

// Towns, for raids. A town cannot run, so no flee cards; its people carry
// what they can inland while you fight, so the longer the raid, the less
// there is to take; and if it goes on, help comes (see RELIEF).

/** An open town: a battery or two, the walls, and the townsfolk. */
export const TOWN_CARDS: readonly CardDef[] = [
  { key: 'battery', name: 'shore battery', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 2 },
  { key: 'musketry', name: 'musketry from the walls', text: 'hurt 1', effects: [{ kind: 'hurt', amount: 1 }], copies: 3 },
  { key: 'inland', name: 'valuables carried inland', text: 'jettison 3', effects: [{ kind: 'jettison', amount: 3 }], copies: 2 },
  { key: 'barricades', name: 'barricades', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 2 },
  { key: 'ransom', name: 'the town treats', text: 'plunder 4, interrogate', effects: [{ kind: 'plunder', amount: 4 }, { kind: 'interrogate', reliability: 0.8 }], copies: 1 },
];

/** A fortified port: the fort's great guns, and walls to mend. Not for a pinnace. */
export const FORTRESS_CARDS: readonly CardDef[] = [
  { key: 'great-guns', name: "the fort's great guns", text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 2 },
  { key: 'battery', name: 'shore battery', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'musketry', name: 'musketry from the walls', text: 'hurt 1', effects: [{ kind: 'hurt', amount: 1 }], copies: 2 },
  { key: 'inland', name: 'valuables carried inland', text: 'jettison 4', effects: [{ kind: 'jettison', amount: 4 }], copies: 2 },
  { key: 'walls', name: 'mend the walls', text: 'mend 3', effects: [{ kind: 'mend', amount: 3 }], copies: 2 },
];

/** Help for a town under attack, arriving if the raid goes on too long. */
export const RELIEF = { side: 'target' as const, name: 'the garrison is reinforced', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }] as Effect[] };

/** A raiding party can always fall back to the boats: in a raid, these go into your deck. */
export const RAID_CARDS: readonly CardDef[] = [
  { key: 'to-the-boats', name: 'back to the boats', text: 'flee', effects: [{ kind: 'flee' }], copies: 2 },
];
