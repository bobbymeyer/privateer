/**
 * Stores and survival: what wears down on a voyage, a day at a time, and
 * what you do at a landmark to put it back. Oregon Trail's wagon, at sea.
 *
 * - The crew is a number: hands, against the ship's complement. They die
 *   of scurvy, thirst and starvation; too few, and she can't be sailed.
 * - Provisions and water are rations: a hand for a day. Both go at the
 *   ration you set, water half as fast again in the tropics.
 * - Scurvy: six weeks without fresh food and it starts to kill, slowly and
 *   then not slowly. Fresh food — foraged, bought, traded, taken — resets it.
 * - Spares (canvas, cordage, timber) take a storm's damage before the hull
 *   does, and careen her at a landmark.
 * - Powder, for the guns.
 * - Pace: easy loses a day in three and spares the ship and crew; hard gains
 *   one and wears them.
 */

import { SHIP_CLASSES } from '../outfit.ts';
import { HOME_LANDMARK, LANDMARKS } from './landmarks.ts';
import { type Roller, roll } from './random.ts';
import type { Sea } from './ships.ts';
import { wantedBy } from './ships.ts';
import type { WorldState } from './world.ts';

export interface Stores {
  /** Provisions, in rations: one hand for one day at full ration. */
  food: number;
  /** Water, in rations. */
  water: number;
  /** Canvas, cordage, timber: a storm's damage, and a careening. */
  spares: number;
  /** Barrels of powder. */
  powder: number;
}

export type Rations = 'full' | 'short' | 'starving';
export type Pace = 'easy' | 'steady' | 'hard';

/** What a ration setting eats, against full. */
export const EAT: Record<Rations, number> = { full: 1, short: 0.67, starving: 0.34 };
/** Water goes this much faster inside the tropics. */
export const TROPIC_THIRST = 1.5;
/** Days without fresh food before scurvy kills. */
export const SCURVY_DAYS = 42;
/** Hands dead of scurvy a day, per hand, per day past SCURVY_DAYS. */
export const SCURVY_RATE = 0.0006;
/** And of thirst, and of hunger, a day, per hand, when it's run out. */
export const THIRST_RATE = 0.08;
export const HUNGER_RATE = 0.03;
/** Fewer hands than this and she can't be sailed: the run is over. */
export const MIN_HANDS = 8;
/** Days at sea between a point of hull lost to weed and worm, by pace. */
export const WEAR_DAYS: Record<Pace, number> = { easy: 40, steady: 25, hard: 15 };

export const complement = (s: WorldState) => SHIP_CLASSES[s.outfit.ship].complement;
/** What she can carry, by her complement: food for 180 days, water for 90, a share of spares and powder. */
export const capacity = (s: WorldState): Stores => {
  const c = complement(s);
  return { food: c * 180, water: c * 90, spares: 4 + Math.round(c / 10), powder: Math.round(c / 4) };
};

/** Add to what's aboard, as far as there's room; never less than there was. */
export const topUp = (have: number, add: number, cap: number) => Math.max(have, Math.min(cap, have + add));

/** Days of food and water left at this crew and ration. */
export const daysOf = (s: WorldState) => ({
  food: s.crew ? Math.floor(s.stores.food / (s.crew * EAT[s.rations])) : Infinity,
  water: s.crew ? Math.floor(s.stores.water / (s.crew * EAT[s.rations])) : Infinity,
});

/** How it stands with the scurvy: none, coming on, or killing. */
export const scurvy = (s: WorldState): 'none' | 'coming' | 'killing' => (s.fresh > SCURVY_DAYS ? 'killing' : s.fresh > SCURVY_DAYS - 14 ? 'coming' : 'none');

const deaths = (r: Roller, expected: number) => Math.floor(expected) + (roll(r) < expected - Math.floor(expected) ? 1 : 0);

/** A day's eating, drinking and dying. Called by `aDay`. */
export function provisionDay(sea: Sea, s: WorldState, r: Roller): WorldState {
  let w = s;
  const log = (text: string, stop = false) => (w = { ...w, log: [...w.log, { turn: w.turn, text, ...(stop ? { stop } : {}) }] });
  const before = daysOf(s);
  const tropics = Math.abs(sea.map.nodes[s.player].lat) < 23.5;
  const food = s.stores.food - s.crew * EAT[s.rations];
  const water = s.stores.water - s.crew * EAT[s.rations] * (tropics ? TROPIC_THIRST : 1);
  w = { ...w, stores: { ...w.stores, food: Math.max(0, food), water: Math.max(0, water) }, fresh: w.fresh + 1 };

  // Warnings as they come, once each: ten days left, and none.
  const after = daysOf(w);
  if (before.water > 10 && after.water <= 10) log('ten days of water left', true);
  if (before.food > 10 && after.food <= 10) log('ten days of food left', true);
  if (s.stores.water > 0 && water <= 0) log('the water is gone', true);
  if (s.stores.food > 0 && food <= 0) log('the food is gone', true);

  // The dying.
  const mult = (s.rations === 'starving' ? 1.5 : s.rations === 'short' ? 1.2 : 1) * (s.pace === 'easy' ? 0.8 : 1);
  const lost = {
    scurvy: w.fresh > SCURVY_DAYS ? deaths(r, w.crew * (w.fresh - SCURVY_DAYS) * SCURVY_RATE * mult) : 0,
    thirst: water <= 0 ? deaths(r, w.crew * THIRST_RATE) : 0,
    hunger: food <= 0 ? deaths(r, w.crew * HUNGER_RATE) : 0,
  };
  const dead = Math.min(w.crew, lost.scurvy + lost.thirst + lost.hunger);
  if (dead) {
    const half = complement(w) / 2;
    const crew = w.crew - dead;
    const of = [lost.scurvy && 'scurvy', lost.thirst && 'thirst', lost.hunger && 'hunger'].filter(Boolean).join(' and ');
    w = { ...w, crew };
    log(`${dead === 1 ? 'a hand' : `${dead} hands`} dead of ${of}`, w.crew + dead >= half && crew < half);
    if (w.fresh === SCURVY_DAYS + 1 && lost.scurvy) log('the scurvy has begun to kill', true);
  }
  if (w.crew < MIN_HANDS) {
    log(`too few hands left to work her: the ship is lost`, true);
    return { ...w, sunk: true };
  }

  // Hunger sours the crew; short rations slowly, starvation fast.
  if ((s.rations === 'short' && w.turn % 10 === 0) || (s.rations === 'starving' && w.turn % 4 === 0) || food <= 0 || water <= 0) w = { ...w, morale: w.morale - 1 };
  if (s.pace === 'hard' && w.turn % 12 === 0) w = { ...w, morale: w.morale - 1 };

  // Weed and worm.
  if (!sea.map.nodes[s.player].port && w.turn % WEAR_DAYS[s.pace] === 0 && w.hull > 1) {
    w = { ...w, hull: w.hull - 1 };
    log('weed and worm: the hull slower and weaker by a point');
  }
  return w;
}

// --- At a landmark -----------------------------------------------------------

/** What you can do where you are: water, forage, careen. */
export interface Shore {
  water: boolean;
  forage: boolean;
  careen: boolean;
  /** Where this is, in words. */
  place: string;
}

/**
 * The shore here. Water and forage at an anchorage, a cape, an island, or
 * islanders who'll have you; water in a strait; careen anywhere quiet
 * enough — an anchorage, an island, a friendly port's yard.
 */
export function shore(sea: Sea, s: WorldState): Shore {
  const none = { water: false, forage: false, careen: false, place: '' };
  const node = sea.map.nodes[s.player];
  const mark = LANDMARKS.find((l) => sea.map.landmarks[l.key] === s.player && l.key !== HOME_LANDMARK);
  const island = s.islands.some((i) => i.found && i.node === s.player);
  if (island) return { water: true, forage: true, careen: true, place: 'an island nobody has charted' };
  if (node.port) {
    if (node.port.nation === 'native') return wantedBy(s.standing, 'native') ? none : { water: true, forage: true, careen: false, place: node.port.name };
    // A port that deals with you: water from the town, and its yard.
    return none;
  }
  if (!mark) return none;
  if (mark.kind === 'anchorage') return { water: true, forage: true, careen: true, place: mark.name };
  if (mark.kind === 'cape') return { water: true, forage: true, careen: false, place: mark.name };
  if (mark.kind === 'strait') return { water: true, forage: false, careen: false, place: mark.name };
  return { ...none, place: mark.name };
}

/** Days each costs. */
export const SHORE_DAYS = { water: 2, forage: 3, careen: 5, rest: 4 };

/**
 * Do something ashore for its days: the world goes on meanwhile. Stops early
 * if something comes alongside, a fight starts, or an event asks you.
 */
export function ashore(sea: Sea, s: WorldState, what: keyof typeof SHORE_DAYS, advance: (sea: Sea, s: WorldState, to: number) => WorldState): WorldState {
  const here = shore(sea, s);
  if (what !== 'rest' && !here[what]) throw new Error(`nothing to ${what} here`);
  const r: Roller = { rng: s.rng };
  let w: WorldState = { ...s, rng: r.rng };
  const cap = capacity(w);
  const text = { water: 'casks filled', forage: '', careen: '', rest: 'the crew rested' }[what];
  if (what === 'water') w = { ...w, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water) } };
  if (what === 'forage') {
    // Fish, fowl, seals, penguins, fruit, roots: a week's worth some days, a month's others. Fresh, whatever it is.
    const got = Math.round(w.crew * (8 + roll(r) * 22));
    w = { ...w, rng: r.rng, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, got, cap.food) }, morale: Math.min(10, w.morale + 1) };
    w = { ...w, log: [...w.log, { turn: w.turn, text: `foraging: fresh food, ${Math.round(got / Math.max(1, w.crew))} days of it` }] };
  }
  if (what === 'careen') {
    // Hauled down on a beach, scraped, caulked: two points of hull for each bundle of spares.
    const need = Math.ceil((w.maxHull - w.hull) / 2);
    const used = Math.min(need, w.stores.spares);
    w = { ...w, hull: Math.min(w.maxHull, w.hull + used * 2 + 1), stores: { ...w.stores, spares: w.stores.spares - used } };
    w = { ...w, log: [...w.log, { turn: w.turn, text: `careened: weed scraped, seams caulked${used ? `, ${used} of the spares used` : ''}` }] };
  }
  if (what === 'rest') w = { ...w, morale: Math.min(10, w.morale + 2) };
  if (text) w = { ...w, log: [...w.log, { turn: w.turn, text }] };
  for (let d = 0; d < SHORE_DAYS[what]; d++) {
    w = advance(sea, w, w.player);
    if (w.encounter || w.hail || w.spoil || w.dilemma || w.sunk || w.won) break;
  }
  return w;
}

// --- The chandler ------------------------------------------------------------

/** What a chandler sells, a lot at a time, at Plymouth's prices; dearer abroad. */
export const CHANDLER = {
  food: { lot: 300, cost: 4, name: 'biscuit and salt meat', unit: 'rations' },
  water: { lot: 300, cost: 1, name: 'casks of water', unit: 'rations' },
  spares: { lot: 1, cost: 3, name: 'canvas, cordage and timber', unit: 'bundle' },
  powder: { lot: 1, cost: 3, name: 'powder and shot', unit: 'barrel' },
  hands: { lot: 5, cost: 4, name: 'hands', unit: 'men' },
} as const;
export type Ware = keyof typeof CHANDLER;
/** Away from Plymouth, everything costs half as much again. */
export const ABROAD = 1.5;

export const price = (sea: Sea, s: WorldState, ware: Ware) => Math.ceil(CHANDLER[ware].cost * (sea.map.nodes[s.player].port?.name === 'Plymouth' ? 1 : ABROAD));

/** Room for another lot of this. */
export function room(s: WorldState, ware: Ware): boolean {
  if (ware === 'hands') return s.crew + CHANDLER.hands.lot <= complement(s);
  return s.stores[ware] + CHANDLER[ware].lot <= capacity(s)[ware];
}

/** Buy a lot at a port that deals with you. Fresh food in a port resets the scurvy, too. */
export function buy(sea: Sea, s: WorldState, ware: Ware, serves: boolean): WorldState {
  if (!sea.map.nodes[s.player].port) throw new Error('a chandler is found in port');
  if (!serves) throw new Error("they won't deal with you here");
  if (!room(s, ware)) throw new Error(ware === 'hands' ? 'no room for more hands' : 'the hold is full');
  const cost = price(sea, s, ware);
  if (s.gold < cost) throw new Error('not enough in the purse');
  const paid = { ...s, gold: s.gold - cost };
  if (ware === 'hands') return { ...paid, crew: s.crew + CHANDLER.hands.lot };
  return { ...paid, stores: { ...s.stores, [ware]: s.stores[ware] + CHANDLER[ware].lot }, ...(ware === 'food' ? { fresh: 0 } : {}) };
}

/** A new run's ship: a pinnace two thirds manned, with two months' food and a month's water. The rest is for you to buy. */
export const START_CREW = 20;
export const START_STORES: Stores = { food: START_CREW * 60, water: START_CREW * 30, spares: 2, powder: 3 };
