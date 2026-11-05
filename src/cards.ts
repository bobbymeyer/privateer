/**
 * What a card is, and the placeholder decks for the first slice.
 *
 * The rules only read `effects`; `name` and `text` are for whoever is drawing
 * the card. Effects resolve in the order they are listed.
 */

export type Side = 'ship' | 'target';

/**
 * How far apart the ships lie. Far: long guns only, and one more stretch of
 * open water and a ship is away. Close: broadside range. Grappled: alongside
 * and made fast, where boarders go across. For a raid, the town can't move:
 * close is the boats offshore, grappled is the party ashore.
 */
export type Reach = 'grappled' | 'close' | 'far';
export const REACHES: Reach[] = ['grappled', 'close', 'far'];

type Bare =
  /** Shot into the target: its hull, at once. */
  | { kind: 'hit'; amount: number }
  /** Shot into you: your hull, at once, less any brace you're holding. */
  | { kind: 'hurt'; amount: number }
  /**
   * A lasting wound to the other side: a wound card on top of their deck.
   * See `woundCard`.
   */
  | { kind: 'wound'; what: Wound }
  /**
   * The card's own side loses this much hull — less any brace, for you.
   * What a leak or a fire does when its card comes up.
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
   * The card's own side bears away: the range opens this many steps. Opened
   * past far, that side is away and the fight is over. Not while its sails
   * are shot away.
   */
  | { kind: 'flee'; amount: number }
  /** Grapnels, boarders, the weather gauge: the range closes this many steps. */
  | { kind: 'hold'; amount: number }
  /** Pursuit: crowding on sail after her, the range closes this many steps. */
  | { kind: 'chase'; amount: number }
  /**
   * Brings this many of the card's own side's spent cards back into play,
   * the most recently spent first, under the deck. Never damage cards.
   */
  | { kind: 'recall'; amount: number }
  /**
   * Prisoners talk: a rumor of this reliability, carried out of the fight
   * and turned into a sighting on the map. Lost if you are sunk.
   */
  | { kind: 'interrogate'; reliability: number };

/**
 * An effect, and the ranges at which it works: `at` absent, at any range.
 * Long guns at far, a broadside close, boarders grappled: out of range, an
 * effect does nothing, and the fight says so.
 */
export type Effect = Bare & { at?: Reach[] };

/**
 * What kind of work a card is, for the chain: sail (chase, bear away), shot
 * (the guns), board (grapnels, boarders, the hold), hands (repairs, brace,
 * recall, a wound dealt with). A boarding action goes sail → shot → board:
 * close her, fire into her, go across. A card that follows the one before
 * it in that order scales — see `CHAIN` in rules.ts.
 */
export type CardType = 'sail' | 'shot' | 'board' | 'hands';
export const CHAIN_ORDER: CardType[] = ['sail', 'shot', 'board'];

/** A card's type, from what it does: guns make it shot, grapnels or plunder board, chase or flight sail; anything else is the hands' work. */
export function cardType(card: { effects: readonly Effect[]; damage?: true }): CardType {
  if (card.damage) return 'hands';
  const has = (...k: Effect['kind'][]) => card.effects.some((e) => k.includes(e.kind));
  if (has('hit')) return 'shot';
  if (has('plunder', 'hold')) return 'board';
  if (has('flee', 'chase')) return 'sail';
  return 'hands';
}

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
  /** Written from the effects if left out: see `cardText`. */
  text?: string;
  effects: Effect[];
  copies: number;
}

/** The wounds a ship can take that outlast the shot that made them. */
export type Wound = 'leak' | 'fire' | 'sails';

export const WOUNDS: Record<Wound, { name: string; hull: number; text: (whose: 'you' | 'they') => string }> = {
  leak: { name: 'a leak below', hull: 2, text: (w) => `${w} lose 2 hull` },
  fire: { name: 'fire aboard', hull: 3, text: (w) => `${w} lose 3 hull` },
  sails: { name: 'sails shot away', hull: 0, text: (w) => `till dealt with, ${w} can't bear away` },
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

/** One effect, in a card's words: `hit 3`, `leak`, `chase 1`. */
export function effectText(e: Effect): string {
  if (e.kind === 'wound') return e.what;
  if (e.kind === 'interrogate') return 'interrogate';
  return `${e.kind} ${e.amount}`;
}

/**
 * A card's text, written from its effects so it can't say other than it
 * does: effects at the same range run together, each range named once —
 * `far: hit 1 · close or grappled: hit 3`.
 */
export function cardText(effects: readonly Effect[]): string {
  const parts: { at: string; words: string[] }[] = [];
  for (const e of effects) {
    const at = e.at ? e.at.join(' or ') : '';
    const last = parts.at(-1);
    if (last && last.at === at) last.words.push(effectText(e));
    else parts.push({ at, words: [effectText(e)] });
  }
  return parts.map((p) => (p.at ? `${p.at}: ` : '') + p.words.join(', ')).join(' · ');
}

/** Expand definitions into individual cards with unique ids. */
export function buildDeck(side: Side, defs: readonly CardDef[]): Card[] {
  const cards: Card[] = [];
  for (const def of defs) {
    for (let n = 1; n <= def.copies; n++) {
      cards.push({ id: `${def.key}#${n}`, side, name: def.name, text: def.text ?? cardText(def.effects), effects: def.effects });
    }
  }
  return cards;
}

// Placeholder content. The numbers are what the simulator is for.

// Shorthands for the decks below.
const far: Reach[] = ['far'];
const close: Reach[] = ['close'];
const grappled: Reach[] = ['grappled'];
const near: Reach[] = ['close', 'grappled'];
const ranged: Reach[] = ['far', 'close'];

/**
 * A pinnace's deck. Three ways to fight run through it, and the decks you
 * build after: the guns (hit and wounds, best close), the boarders (close
 * the range, grapple, plunder) and the runner (open the range and go).
 */
export const SHIP_CARDS: readonly CardDef[] = [
  { key: 'broadside', name: 'broadside', effects: [{ kind: 'hit', amount: 1, at: far }, { kind: 'hit', amount: 3, at: near }, { kind: 'wound', what: 'leak', at: close }], copies: 2 },
  { key: 'raking-fire', name: 'raking fire', effects: [{ kind: 'hit', amount: 2 }], copies: 2 },
  { key: 'sweep', name: 'sweep the hold', effects: [{ kind: 'plunder', amount: 4, at: grappled }], copies: 2 },
  { key: 'boarding', name: 'boarding party', effects: [{ kind: 'hold', amount: 1, at: close }, { kind: 'plunder', amount: 3, at: grappled }, { kind: 'hurt', amount: 1, at: grappled }], copies: 1 },
  { key: 'chain-shot', name: 'chain shot', effects: [{ kind: 'hit', amount: 1, at: ranged }, { kind: 'wound', what: 'sails', at: ranged }], copies: 1 },
  { key: 'swivel', name: 'swivel guns', effects: [{ kind: 'hit', amount: 2, at: near }, { kind: 'plunder', amount: 1, at: grappled }], copies: 1 },
  { key: 'patch', name: 'patch the hull', effects: [{ kind: 'repair', amount: 2 }], copies: 1 },
  { key: 'brace', name: 'brace', effects: [{ kind: 'brace', amount: 2 }], copies: 1 },
  { key: 'bear-away', name: 'bear away', effects: [{ kind: 'flee', amount: 1 }], copies: 2 },
  { key: 'give-chase', name: 'give chase', effects: [{ kind: 'chase', amount: 1 }], copies: 2 },
];

/** A merchant: a few guns to make you pay, and every stitch of sail to get away. */
export const MERCHANT_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'grapeshot', name: 'grapeshot', effects: [{ kind: 'hurt', amount: 3, at: near }], copies: 1 },
  { key: 'crack-on', name: 'crack on sail', effects: [{ kind: 'flee', amount: 1 }], copies: 5 },
  { key: 'jettison', name: 'jettison cargo', effects: [{ kind: 'jettison', amount: 3 }, { kind: 'flee', amount: 1, at: far }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', effects: [{ kind: 'mend', amount: 2 }], copies: 1 },
  { key: 'strike', name: 'strike colours', effects: [{ kind: 'plunder', amount: 3, at: near }], copies: 1 },
  { key: 'lucky-shot', name: 'a lucky shot', effects: [{ kind: 'hurt', amount: 1 }, { kind: 'wound', what: 'leak' }], copies: 1 },
];


/** A lone galleon: great guns that ruin you close, a hold full of silver, and she runs. */
export const TREASURE_SHIP_CARDS: readonly CardDef[] = [
  { key: 'great-guns', name: 'great guns', effects: [{ kind: 'hurt', amount: 1, at: far }, { kind: 'hurt', amount: 3, at: near }, { kind: 'wound', what: 'leak', at: close }], copies: 3 },
  { key: 'return-fire', name: 'return fire', effects: [{ kind: 'hurt', amount: 2 }], copies: 2 },
  { key: 'crack-on', name: 'crack on sail', effects: [{ kind: 'flee', amount: 1 }], copies: 3 },
  { key: 'carpenters', name: 'carpenters below', effects: [{ kind: 'mend', amount: 2 }], copies: 2 },
  { key: 'strike', name: 'strike colours', effects: [{ kind: 'plunder', amount: 6, at: grappled }], copies: 1 },
];



// Towns, for raids. A town cannot move, so no flee cards and no chase:
// close is the boats offshore, grappled is the party ashore. Its people
// carry what they can inland while you fight, and if it goes on, help
// comes (see RELIEF).

/** An open town: a battery or two, the walls, and the townsfolk. */
export const TOWN_CARDS: readonly CardDef[] = [
  { key: 'battery', name: 'shore battery', effects: [{ kind: 'hurt', amount: 2 }], copies: 2 },
  { key: 'musketry', name: 'musketry from the walls', effects: [{ kind: 'hurt', amount: 1, at: close }, { kind: 'hurt', amount: 2, at: grappled }], copies: 3 },
  { key: 'inland', name: 'valuables carried inland', effects: [{ kind: 'jettison', amount: 4 }], copies: 2 },
  { key: 'barricades', name: 'barricades', effects: [{ kind: 'mend', amount: 2 }], copies: 2 },
  { key: 'ransom', name: 'the town treats', effects: [{ kind: 'plunder', amount: 5, at: grappled }], copies: 1 },
];

/** A fortified port: the fort's great guns, and walls to mend. Not for a pinnace. */
export const FORTRESS_CARDS: readonly CardDef[] = [
  { key: 'heated-shot', name: 'heated shot', effects: [{ kind: 'hurt', amount: 2 }, { kind: 'wound', what: 'fire', at: close }], copies: 2 },
  { key: 'battery', name: 'shore battery', effects: [{ kind: 'hurt', amount: 3, at: close }, { kind: 'hurt', amount: 2, at: grappled }], copies: 3 },
  { key: 'musketry', name: 'musketry from the walls', effects: [{ kind: 'hurt', amount: 2, at: grappled }], copies: 2 },
  { key: 'inland', name: 'valuables carried inland', effects: [{ kind: 'jettison', amount: 5 }], copies: 2 },
  { key: 'walls', name: 'mend the walls, man the guns', effects: [{ kind: 'mend', amount: 3 }], copies: 2 },
];

/** Help for a town under attack, arriving if the raid goes on too long. */
export const RELIEF = { side: 'target' as const, name: 'the garrison is reinforced', text: 'hurt 2', effects: [{ kind: 'hurt', amount: 2 }] as Effect[] };

/** A raiding party can always fall back to the boats, and has a way ashore: in a raid, these go into your deck. */
export const RAID_CARDS: readonly CardDef[] = [
  { key: 'to-the-boats', name: 'back to the boats', effects: [{ kind: 'flee', amount: 1 }], copies: 2 },
  { key: 'land-the-party', name: 'land the party', effects: [{ kind: 'hold', amount: 1 }], copies: 1 },
];

/** An enemy privateer: a raider like you, quick to close and grapple, and as quick to run. */
export const PRIVATEER_CARDS: readonly CardDef[] = [
  { key: 'return-fire', name: 'return fire', effects: [{ kind: 'hurt', amount: 2 }], copies: 3 },
  { key: 'chain-and-bar', name: 'chain and bar', effects: [{ kind: 'hurt', amount: 1, at: ranged }, { kind: 'wound', what: 'sails', at: ranged }], copies: 1 },
  { key: 'grapnels', name: 'grapnels', effects: [{ kind: 'hold', amount: 1, at: close }, { kind: 'hurt', amount: 1 }], copies: 2 },
  { key: 'give-chase', name: 'she gives chase', effects: [{ kind: 'chase', amount: 1 }], copies: 1 },
  { key: 'boarders', name: 'boarders away', effects: [{ kind: 'hurt', amount: 3, at: grappled }], copies: 2 },
  { key: 'crack-on', name: 'crack on sail', effects: [{ kind: 'flee', amount: 1 }], copies: 2 },
  { key: 'carpenters', name: 'carpenters below', effects: [{ kind: 'mend', amount: 2 }], copies: 1 },
  { key: 'strike', name: 'strike colours', effects: [{ kind: 'plunder', amount: 3, at: near }], copies: 1 },
];


