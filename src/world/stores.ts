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
 *   Short rations and starvation make it worse, and starvation kills besides.
 * - Spares (canvas, cordage, timber) take a storm's damage before the hull
 *   does, and careen her at a landmark.
 * - Powder, for the guns.
 * - Pace: easy loses a day in three and spares the hull; hard gains one and
 *   wears it.
 */

import { SHIP_CLASSES } from '../outfit.ts';
import { type Landmark, type ShoreWork, landmark } from './landmarks.ts';
import { type Roller, roll } from './random.ts';
import type { Sea, WorldState } from './world.ts';

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

/** What a ration setting eats and drinks, against full. */
export const EAT: Record<Rations, number> = { full: 1, short: 0.67, starving: 0.34 };
/** Water goes this much faster inside the tropics. */
export const TROPIC_THIRST = 1.5;
/** Days without fresh food before scurvy kills. */
export const SCURVY_DAYS = 42;
/** Hands dead of scurvy a day, per hand, per day past SCURVY_DAYS. */
export const SCURVY_RATE = 0.0001;
/** And of thirst, and of hunger, a day, per hand, when it's run out. */
export const THIRST_RATE = 0.08;
export const HUNGER_RATE = 0.03;
/** On starvation rations, hunger kills this share of HUNGER_RATE even with food aboard. */
export const STARVING_HUNGER = 0.05;
/** Fewer hands than this and she can't be sailed: the run is over. */
export const MIN_HANDS = 8;
/** Days at sea between a point of hull lost to weed and worm, by pace. */
export const WEAR_DAYS: Record<Pace, number> = { easy: 60, steady: 40, hard: 25 };

export const complement = (s: { ship: string }) => SHIP_CLASSES[s.ship].complement;
/** What she can carry, by her complement: food for 180 days, water for 90, a share of spares and powder. */
export const capacity = (s: { ship: string }): Stores => {
  const c = complement(s);
  return { food: c * 180, water: c * 90, spares: 4 + Math.round(c / 10), powder: Math.round(c / 4) };
};

/** A new voyage's hands: two thirds of her complement. The rest are to hire. */
export const startCrew = (ship: string) => Math.round((SHIP_CLASSES[ship].complement * 2) / 3);
/** And her stores: two months' food, a month's water, a little spare and powder. The rest is to buy. */
export const startStores = (ship: string): Stores => {
  const crew = startCrew(ship);
  return { food: crew * 60, water: crew * 30, spares: 2, powder: 3 };
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

export const deaths = (r: Roller, expected: number) => Math.floor(expected) + (roll(r) < expected - Math.floor(expected) ? 1 : 0);

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
  const hungry = food <= 0 ? HUNGER_RATE : s.rations === 'starving' ? HUNGER_RATE * STARVING_HUNGER : 0;
  const lost = {
    scurvy: w.fresh > SCURVY_DAYS ? deaths(r, w.crew * (w.fresh - SCURVY_DAYS) * SCURVY_RATE * mult) : 0,
    thirst: water <= 0 ? deaths(r, w.crew * THIRST_RATE) : 0,
    hunger: hungry ? deaths(r, w.crew * hungry) : 0,
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
    log('too few hands left to work her: the ship is lost', true);
    return { ...w, sunk: true };
  }

  // Weed and worm.
  if (!sea.map.nodes[s.player].port && w.turn % WEAR_DAYS[s.pace] === 0 && w.hull > 1) {
    w = { ...w, hull: w.hull - 1 };
    log('weed and worm: the hull slower and weaker by a point');
  }
  return w;
}

// --- At a landmark -----------------------------------------------------------

/** The landmark you're lying at, if you're at one. */
export const landmarkHere = (sea: Sea, s: WorldState): Landmark | null => (sea.map.landmarks[s.voyage.at] === s.player ? landmark(s.voyage.at) : null);

/** The shore work to be done here. */
export const shoreHere = (sea: Sea, s: WorldState): ShoreWork[] => landmarkHere(sea, s)?.offers.shore ?? [];

/** Days each takes. */
export const SHORE_DAYS: Record<ShoreWork, number> = { water: 2, forage: 3, careen: 5 };

/**
 * Work ashore for its days: the casks, the foraging, the careening. The
 * days pass meanwhile, and stop early if something asks you.
 */
export function ashore(sea: Sea, s: WorldState, what: ShoreWork, advance: (sea: Sea, s: WorldState, to: number) => WorldState): WorldState {
  if (!shoreHere(sea, s).includes(what)) throw new Error(`nothing to ${what} here`);
  const r: Roller = { rng: s.rng };
  let w: WorldState = s;
  const cap = capacity(w);
  const log = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  if (what === 'water') {
    w = { ...w, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water) } };
    log('casks filled');
  }
  if (what === 'forage') {
    // Fish, fowl, seals, penguins, fruit, roots: a week's worth some days, a month's others. Fresh, whatever it is.
    const got = Math.round(w.crew * (8 + roll(r) * 22));
    w = { ...w, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, got, cap.food) } };
    log(`foraging: fresh food, ${Math.round(got / Math.max(1, w.crew))} days of it`);
  }
  if (what === 'careen') {
    // Hauled down on a beach, scraped, caulked: two points of hull for each bundle of spares, and one for the scraping.
    const need = Math.ceil((w.maxHull - w.hull) / 2);
    const used = Math.min(need, w.stores.spares);
    w = { ...w, hull: Math.min(w.maxHull, w.hull + used * 2 + 1), stores: { ...w.stores, spares: w.stores.spares - used } };
    log(`careened: weed scraped, seams caulked${used ? `, ${used} of the spares used` : ''}`);
  }
  w = { ...w, rng: r.rng };
  for (let d = 0; d < SHORE_DAYS[what]; d++) {
    w = advance(sea, w, w.player);
    if (w.encounter || w.hail || w.dilemma || w.sunk || w.won) break;
  }
  return w;
}

// --- The market --------------------------------------------------------------

/** What a chandler sells, a lot at a time, at Plymouth's prices; dearer abroad. */
export const CHANDLER = {
  food: { lot: 300, cost: 4, name: 'biscuit and salt meat', unit: 'rations' },
  water: { lot: 300, cost: 1, name: 'water', unit: 'rations' },
  spares: { lot: 1, cost: 3, name: 'canvas, cordage and timber', unit: 'bundle' },
  powder: { lot: 1, cost: 3, name: 'powder and shot', unit: 'barrel' },
  hands: { lot: 5, cost: 4, name: 'hands', unit: 'men' },
} as const;
export type Ware = keyof typeof CHANDLER;
/** Away from Plymouth, everything costs half as much again. */
export const ABROAD = 1.5;
/** What islanders want for casks filled and three weeks of fresh food. */
export const ISLANDERS_COST = 3;
export const ISLANDERS_DAYS = 21;

/** The market where you're lying, if there is one. */
export const marketHere = (sea: Sea, s: WorldState) => landmarkHere(sea, s)?.offers.market ?? null;

export const price = (s: WorldState, ware: Ware) => Math.ceil(CHANDLER[ware].cost * (s.voyage.at === 'plymouth' ? 1 : ABROAD));

/** Room for another lot of this. */
export function room(s: WorldState, ware: Ware): boolean {
  if (ware === 'hands') return s.crew + CHANDLER.hands.lot <= complement(s);
  return s.stores[ware] + CHANDLER[ware].lot <= capacity(s)[ware];
}

/** Buy a lot from a chandler. Food bought in port is fresh, and resets the scurvy. */
export function buy(sea: Sea, s: WorldState, ware: Ware): WorldState {
  if (marketHere(sea, s) !== 'chandler') throw new Error('there is no chandler here');
  if (!room(s, ware)) throw new Error(ware === 'hands' ? 'no room for more hands' : 'the hold is full');
  const cost = price(s, ware);
  if (s.gold < cost) throw new Error('not enough in the purse');
  const paid = { ...s, gold: s.gold - cost };
  if (ware === 'hands') return { ...paid, crew: s.crew + CHANDLER.hands.lot };
  return { ...paid, stores: { ...s.stores, [ware]: s.stores[ware] + CHANDLER[ware].lot }, ...(ware === 'food' ? { fresh: 0 } : {}) };
}

/** What a ton of spice fetches on the quay at Plymouth. Drake brought home six tons of cloves; he threw three more over on a reef. */
export const SPICE_WORTH = 20;
/** Tons of spice she can stow: a ton for every five of her complement. */
export const spiceRoom = (s: WorldState) => Math.floor(complement(s) / 5);
/** Spice for sale where you're lying, if any. */
export const spiceHere = (sea: Sea, s: WorldState) => landmarkHere(sea, s)?.offers.spice ?? null;

/** Buy a ton of spice, to sell at home. */
export function buySpice(sea: Sea, s: WorldState): WorldState {
  const spice = spiceHere(sea, s);
  if (!spice) throw new Error('there is no spice to be had here');
  if (s.spice >= spiceRoom(s)) throw new Error('no room for more spice');
  if (s.gold < spice.cost) throw new Error('not enough in the purse');
  return { ...s, gold: s.gold - spice.cost, spice: s.spice + 1 };
}

/** Trade with islanders: the casks filled, and three weeks of fresh food, for a little. */
export function trade(sea: Sea, s: WorldState): WorldState {
  if (marketHere(sea, s) !== 'islanders') throw new Error('there is nobody here to trade with');
  if (s.gold < ISLANDERS_COST) throw new Error('not enough in the purse');
  const cap = capacity(s);
  return {
    ...s,
    gold: s.gold - ISLANDERS_COST,
    fresh: 0,
    stores: { ...s.stores, water: Math.max(s.stores.water, cap.water), food: topUp(s.stores.food, s.crew * ISLANDERS_DAYS, cap.food) },
    log: [...s.log, { turn: s.turn, text: 'water, fruit and fresh meat from the islanders' }],
  };
}

// --- The fight -----------------------------------------------------------------

/** Shots a barrel of powder serves. */
export const SHOTS_PER_BARREL = 3;
/** Hands killed for each point of hull she lost, a share of those aboard. */
export const KILLED_PER_HULL = 0.015;

/** What a fight cost in powder and hands: shots fired, hull lost. Returns the state and what it said. */
export function fightCost(s: WorldState, shots: number, hullLost: number, r: Roller): WorldState {
  const powder = Math.min(s.stores.powder, Math.ceil(shots / SHOTS_PER_BARREL));
  const dead = Math.min(s.crew, deaths(r, Math.max(0, hullLost) * s.crew * KILLED_PER_HULL));
  const said = [powder && `${powder} ${powder === 1 ? 'barrel' : 'barrels'} of powder`, dead && `${dead === 1 ? 'a hand' : `${dead} hands`} killed`].filter(Boolean).join(', ');
  const w = { ...s, crew: s.crew - dead, stores: { ...s.stores, powder: s.stores.powder - powder } };
  return said ? { ...w, log: [...w.log, { turn: w.turn, text: `the fight cost ${said}` }] } : w;
}

/** A prize's hold, in days of food and water for a crew like yours, bundles of spares and barrels of powder. */
const HOLDS: Record<string, { food: number; water: number; spares: number; powder: number }> = {
  merchant: { food: 25, water: 20, spares: 2, powder: 1 },
  'treasure-ship': { food: 30, water: 25, spares: 2, powder: 2 },
  privateer: { food: 15, water: 15, spares: 2, powder: 3 },
  corsair: { food: 15, water: 15, spares: 1, powder: 2 },
  town: { food: 45, water: 0, spares: 2, powder: 2 },
  fortress: { food: 45, water: 0, spares: 3, powder: 5 },
};

/**
 * Her stores, or the town's: biscuit, wine, water, canvas, powder — as much
 * as your hold has room for. A town's storehouses are fresh food, and the
 * casks filled at its well.
 */
export function prizeStores(s: WorldState, kind: string, town: boolean, r: Roller): WorldState {
  const hold = HOLDS[kind];
  if (!hold) return s;
  const cap = capacity(s);
  const crew = Math.max(s.crew, 1);
  const vary = () => 0.6 + roll(r) * 0.8;
  const stores: Stores = {
    food: topUp(s.stores.food, Math.round(hold.food * crew * vary()), cap.food),
    water: town ? Math.max(s.stores.water, cap.water) : topUp(s.stores.water, Math.round(hold.water * crew * vary()), cap.water),
    spares: topUp(s.stores.spares, hold.spares, cap.spares),
    powder: topUp(s.stores.powder, hold.powder, cap.powder),
  };
  const got = { food: Math.round((stores.food - s.stores.food) / crew), water: Math.round((stores.water - s.stores.water) / crew), spares: stores.spares - s.stores.spares, powder: stores.powder - s.stores.powder };
  const said = [got.food > 0 && `${got.food} days of food`, got.water > 0 && `${got.water} of water`, got.spares > 0 && `${got.spares} of spares`, got.powder > 0 && `${got.powder} of powder`].filter(Boolean).join(', ');
  const w = { ...s, stores, ...(town ? { fresh: 0 } : {}) };
  return said ? { ...w, log: [...w.log, { turn: w.turn, text: `${town ? 'the storehouses' : 'her hold'}: ${said}` }] } : w;
}
