/**
 * What a card is, and the placeholder decks for the first slice.
 *
 * The rules only read `effects`; `name` and `text` are for whoever is drawing
 * the card. Effects resolve in the order they are listed.
 */

export type Side = 'ship' | 'target';

export type Effect =
  /** Shot into the target: its hull, at once. */
  | { kind: 'hit'; amount: number }
  /** Shot into you: your hull, at once, less any brace you're holding. */
  | { kind: 'hurt'; amount: number }
  /**
   * A lasting wound to the other side: a wound card on top of the deck,
   * marked against them. See `woundCard`.
   */
  | { kind: 'wound'; what: Wound }
  /**
   * The card's own side loses this much hull — less any brace, for you.
   * What a leak or a fire does when its card is kept.
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
   * The card's own side makes way — this many points toward breaking away.
   * At three, it's away and the fight is over. Not while its sails are shot
   * away.
   */
  | { kind: 'flee'; amount: number }
  /** Grapnels, boarders, marksmen: takes this much way from the other side. */
  | { kind: 'hold'; amount: number }
  /** Pursuit: crowding on sail after her, takes this much way from the other side. */
  | { kind: 'chase'; amount: number }
  /**
   * Brings this many of the card's own side's spent cards back into play,
   * the most recently spent first, under the deck. Never damage cards. This
   * is the only way a spent card comes back.
   */
  | { kind: 'recall'; amount: number }
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
  /** Set on a wound card: a leak, a fire, shot-away sails. */
  damage?: true;
  wound?: Wound;
}

export interface CardDef {
  key: string;
  name: string;
  text: string;
  effects: Effect[];
  copies: number;
}

/** The wounds a ship can take that outlast the shot that made them. */
export type Wound = 'leak' | 'fire' | 'sails';

export const WOUNDS: Record<Wound, { name: string; hull: number; text: (whose: 'you' | 'they') => string }> = {
  leak: { name: 'a leak below', hull: 2, text: (w) => `${w} lose 2 hull` },
  fire: { name: 'fire aboard', hull: 3, text: (w) => `${w} lose 3 hull` },
  sails: { name: 'sails shot away', hull: 0, text: (w) => `till kept, ${w} can't flee` },
};

/**
 * A wound, sitting in the deck against `side` until somebody keeps it.
 * Keeping it deals with it — pumping, fighting the fire, repairing aloft —
 * at the cost it says, and it's spent. Sent to the bottom, it comes round
 * again. Shot-away sails cost no hull, but while they're in that side's deck
 * or hand, its flee cards don't work.
 */
export function woundCard(side: Side, id: string, what: Wound): Card {
  const w = WOUNDS[what];
  return {
    id,
    side,
    name: w.name,
    text: w.text(side === 'ship' ? 'you' : 'they'),
    effects: w.hull ? [{ kind: 'breach', amount: w.hull }] : [],
    damage: true,
    wound: what,
  };
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
  { key: 'broadside', name: 'broadside', text: 'hit 3, leak', effects: [{ kind: 'hit', amount: 3 }, { kind: 'wound', what: 'leak' }], copies: 2 },
  { key: 'raking-fire', name: 'raking fire', text: 'hit 2', effects: [{ kind: 'hit', amount: 2 }], copies: 2 },
  { key: 'sweep', name: 'sweep the hold', text: 'plunder 3', effects: [{ kind: 'plunder', amount: 3 }], copies: 2 },
  { key: 'boarding', name: 'boarding party', text: 'plunder 4, hurt 1, interrogate', effects: [{ kind: 'plunder', amount: 4 }, { kind: 'hurt', amount: 1 }, { kind: 'interrogate', reliability: 0.7 }], copies: 1 },
  { key: 'chain-shot', name: 'chain shot', text: 'hit 1, sails', effects: [{ kind: 'hit', amount: 1 }, { kind: 'wound', what: 'sails' }], copies: 1 },
  { key: 'swivel', name: 'swivel guns', text: 'hit 1, plunder 1', effects: [{ kind: 'hit', amount: 1 }, { kind: 'plunder', amount: 1 }], copies: 1 },
  { key: 'patch', name: 'patch the hull', text: 'repair 2', effects: [{ kind: 'repair', amount: 2 }], copies: 1 },
  { key: 'brace', name: 'brace', text: 'brace 2', effects: [{ kind: 'brace', amount: 2 }], copies: 1 },
  { key: 'bear-away', name: 'bear away', text: 'flee 2', effects: [{ kind: 'flee', amount: 2 }], copies: 2 },
  { key: 'give-chase', name: 'give chase', text: 'chase 2', effects: [{ kind: 'chase', amount: 2 }], copies: 1 },
];

export const MERCHANT_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'stern-chasers', name: 'stern chasers', text: 'hurt 1', effects: [{ kind: 'hurt', amount: 1 }], copies: 2 },
  { key: 'grapeshot', name: 'grapeshot', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 1 },
  { key: 'jettison', name: 'jettison cargo', text: 'jettison 3', effects: [{ kind: 'jettison', amount: 3 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2, recall 1', effects: [{ kind: 'mend', amount: 2 }, { kind: 'recall', amount: 1 }], copies: 1 },
  { key: 'strike', name: 'strike colours', text: 'plunder 3, interrogate', effects: [{ kind: 'plunder', amount: 3 }, { kind: 'interrogate', reliability: 0.9 }], copies: 1 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee 2', effects: [{ kind: 'flee', amount: 2 }], copies: 3 },
  { key: 'lucky-shot', name: 'a lucky shot', text: 'hurt 1, leak', effects: [{ kind: 'hurt', amount: 1 }, { kind: 'wound', what: 'leak' }], copies: 1 },
];

// First decks for the rest of the sea. Placeholders, like the merchant's
// were; `npm run sim -- --target <kind>` is how they get tuned.

/** A guard ship: hard to shake (it grapples), little to take, a price on its head. */
export const HUNTER_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', text: 'hurt 3', effects: [{ kind: 'hurt', amount: 3 }], copies: 4 },
  { key: 'chain-and-bar', name: 'chain and bar', text: 'hurt 1, sails', effects: [{ kind: 'hurt', amount: 1 }, { kind: 'wound', what: 'sails' }], copies: 2 },
  { key: 'grapnels', name: 'grapnels', text: 'hurt 2, hold 1', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'hold', amount: 1 }], copies: 2 },
  { key: 'boarders', name: 'boarders away', text: 'hurt 3, hold 1', effects: [{ kind: 'hurt', amount: 3 }, { kind: 'hold', amount: 1 }], copies: 1 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 1 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee 2', effects: [{ kind: 'flee', amount: 2 }], copies: 1 },
  { key: 'reload', name: 'the gun crews reload', text: 'recall 2', effects: [{ kind: 'recall', amount: 2 }], copies: 1 },
  { key: 'give-chase', name: 'give chase', text: 'chase 2', effects: [{ kind: 'chase', amount: 2 }], copies: 2 },
];

/** A lone galleon: heavy guns, slow to answer, a hold full of silver, and she runs. */
export const TREASURE_SHIP_CARDS: readonly CardDef[] = [
  { key: 'great-guns', name: 'great guns', text: 'hurt 2, leak', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'wound', what: 'leak' }], copies: 2 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 2', effects: [{ kind: 'mend', amount: 2 }], copies: 2 },
  { key: 'crack-on', name: 'crack on sail', text: 'flee 2', effects: [{ kind: 'flee', amount: 2 }], copies: 3 },
  { key: 'strike', name: 'strike colours', text: 'plunder 4, interrogate', effects: [{ kind: 'plunder', amount: 4 }, { kind: 'interrogate', reliability: 0.9 }], copies: 1 },
  { key: 'reload', name: 'reload the great guns', text: 'recall 2', effects: [{ kind: 'recall', amount: 2 }], copies: 1 },
];

/** A convoy under escort: it doesn't run, it closes ranks, and a straggler is the chance. */
export const TREASURE_FLEET_CARDS: readonly CardDef[] = [
  { key: 'escort-broadside', name: "escort's broadside", text: 'hurt 2, leak', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'wound', what: 'leak' }], copies: 4 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'cut-off', name: 'cut off', text: 'hold 2', effects: [{ kind: 'hold', amount: 2 }], copies: 2 },
  { key: 'escort-chase', name: 'the escort gives chase', text: 'chase 1', effects: [{ kind: 'chase', amount: 1 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', text: 'mend 3', effects: [{ kind: 'mend', amount: 3 }], copies: 2 },
  { key: 'straggler', name: 'a straggler', text: 'plunder 5, interrogate', effects: [{ kind: 'plunder', amount: 5 }, { kind: 'interrogate', reliability: 0.8 }], copies: 2 },
  { key: 'fresh-escort', name: 'a fresh escort comes up', text: 'hurt 2, recall 1', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'recall', amount: 1 }], copies: 1 },
];

/** A squadron of the line: nothing to take, everything to lose. Run. */
export const ARMADA_CARDS: readonly CardDef[] = [
  { key: 'broadside', name: 'broadside', text: 'hurt 3, leak', effects: [{ kind: 'hurt', amount: 3 }, { kind: 'wound', what: 'leak' }], copies: 4 },
  { key: 'return-fire', name: 'return fire', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 4 },
  { key: 'weather-gauge', name: 'the weather gauge', text: 'hold 2', effects: [{ kind: 'hold', amount: 2 }], copies: 2 },
  { key: 'crowd-sail', name: 'crowd on sail', text: 'chase 2', effects: [{ kind: 'chase', amount: 2 }], copies: 1 },
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
  { key: 'militia', name: 'the militia rallies', text: 'recall 2', effects: [{ kind: 'recall', amount: 2 }], copies: 1 },
];

/** A fortified port: the fort's great guns, and walls to mend. Not for a pinnace. */
export const FORTRESS_CARDS: readonly CardDef[] = [
  { key: 'heated-shot', name: 'heated shot', text: 'hurt 2, fire', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'wound', what: 'fire' }], copies: 2 },
  { key: 'battery', name: 'shore battery', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'musketry', name: 'musketry from the walls', text: 'hurt 1', effects: [{ kind: 'hurt', amount: 1 }], copies: 2 },
  { key: 'inland', name: 'valuables carried inland', text: 'jettison 4', effects: [{ kind: 'jettison', amount: 4 }], copies: 2 },
  { key: 'walls', name: 'mend the walls, man the guns', text: 'mend 3, recall 1', effects: [{ kind: 'mend', amount: 3 }, { kind: 'recall', amount: 1 }], copies: 2 },
];

/** Help for a town under attack, arriving if the raid goes on too long. */
export const RELIEF = { side: 'target' as const, name: 'the garrison is reinforced', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }] as Effect[] };

/** A raiding party can always fall back to the boats: in a raid, these go into your deck. */
export const RAID_CARDS: readonly CardDef[] = [
  { key: 'to-the-boats', name: 'back to the boats', text: 'flee 2', effects: [{ kind: 'flee', amount: 2 }], copies: 2 },
];
